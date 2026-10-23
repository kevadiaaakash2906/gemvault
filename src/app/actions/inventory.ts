"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EXT, MAX_UPLOAD_BYTES, MIME, detectFileType } from "@/lib/inventory";
import {
  adjustSchema, locationSchema, openingSchema, productSchema, transferSchema, locationActiveSchema,
} from "@/lib/validation";
import type { ActionResult } from "@/app/actions/auth";

export type SaveResult = ActionResult & { id?: string };

function friendly(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    if (error.message.includes("products_sku")) return "That SKU is already used by another product.";
    if (error.message.includes("products_barcode")) return "That barcode is already used by another product.";
    if (error.message.includes("certificates_unique")) return "That certificate number is already recorded for this issuer.";
    if (error.message.includes("locations_name")) return "A location with that name already exists.";
    return "That value is already in use.";
  }
  if (error.code === "23514") return "One of the values is outside the allowed range. Check weights, prices and lengths.";
  if (error.code === "42501" || error.code === "P0001" || error.code === "P0002") return error.message;
  return error.message.length < 200 ? error.message : "Something went wrong. Please try again.";
}

export async function saveProduct(values: unknown): Promise<SaveResult> {
  const session = await requirePermission("inventory.edit");
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const { stones, costs, opening, ...product } = parsed.data;

  const supabase = await createClient();
  const sendCosts = session.role === "owner" && costs ? costs : null;
  const { data, error } = await supabase.rpc("save_product", { p: product, p_stones: stones, p_cost: sendCosts });
  if (error) return { error: friendly(error) };
  const id = data as string;

  if (!product.id && opening && opening.quantity && opening.locationId) {
    const qty = openingSchema.safeParse({ productId: id, locationId: opening.locationId, quantity: opening.quantity, key: `open-${id}` });
    if (!qty.success) return { id, error: `Product saved, but opening stock was not recorded: ${qty.error.issues[0]?.message}` };
    const { error: e2 } = await supabase.rpc("record_opening_stock", {
      p_product: id, p_location: qty.data.locationId, p_qty: Number(qty.data.quantity), p_key: qty.data.key,
    });
    if (e2) return { id, error: `Product saved, but opening stock was not recorded: ${friendly(e2)}` };
  }
  revalidatePath("/dashboard/inventory");
  return { id, success: "Saved." };
}

export async function recordOpeningStock(values: unknown): Promise<ActionResult> {
  await requirePermission("inventory.edit");
  const p = openingSchema.safeParse(values);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_opening_stock", {
    p_product: p.data.productId, p_location: p.data.locationId, p_qty: Number(p.data.quantity), p_key: p.data.key ?? null,
  });
  if (error) return { error: friendly(error) };
  revalidatePath(`/dashboard/inventory/${p.data.productId}`);
  return { success: "Opening stock recorded." };
}

export async function adjustStock(values: unknown): Promise<ActionResult> {
  await requirePermission("stock.adjust");
  const p = adjustSchema.safeParse(values);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_stock", {
    p_product: p.data.productId, p_location: p.data.locationId, p_delta: Number(p.data.delta),
    p_reason: p.data.reason, p_key: p.data.key ?? null,
  });
  if (error) return { error: friendly(error) };
  revalidatePath(`/dashboard/inventory/${p.data.productId}`);
  return { success: "Stock adjusted." };
}

export async function transferStock(values: unknown): Promise<ActionResult> {
  await requirePermission("inventory.edit");
  const p = transferSchema.safeParse(values);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_stock", {
    p_product: p.data.productId, p_from: p.data.fromId, p_to: p.data.toId, p_qty: Number(p.data.quantity), p_key: p.data.key ?? null,
  });
  if (error) return { error: friendly(error) };
  revalidatePath(`/dashboard/inventory/${p.data.productId}`);
  return { success: "Stock moved." };
}

export async function setProductArchived(productId: string, archived: boolean): Promise<ActionResult> {
  await requirePermission("products.archive");
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return { error: "Invalid product." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_product_archived", { target: productId, archived });
  if (error) return { error: friendly(error) };
  revalidatePath("/dashboard/inventory");
  revalidatePath(`/dashboard/inventory/${productId}`);
  return { success: archived ? "Product archived." : "Product restored." };
}

async function readUpload(file: FormDataEntryValue | null, allowed: string[]) {
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file first." } as const;
  if (file.size > MAX_UPLOAD_BYTES) return { error: "That file is larger than 3.5 MB. Please use a smaller file." } as const;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectFileType(bytes);
  if (!kind || !allowed.includes(kind)) return { error: `Unsupported file. Allowed: ${allowed.join(", ").toUpperCase()}.` } as const;
  return { bytes, kind } as const;
}

export async function uploadProductImage(formData: FormData): Promise<ActionResult> {
  await requirePermission("inventory.edit");
  const productId = String(formData.get("productId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return { error: "Invalid product." };
  const up = await readUpload(formData.get("file"), ["jpeg", "png", "webp"]);
  if ("error" in up) return { error: up.error };

  const supabase = await createClient();
  const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
  if ((count ?? 0) >= 12) return { error: "A product can have up to 12 photos." };

  const path = `${productId}/${randomUUID()}.${EXT[up.kind]}`;
  const { error: e1 } = await supabase.storage.from("product-images").upload(path, up.bytes, { contentType: MIME[up.kind] });
  if (e1) return { error: "The photo could not be uploaded. Please try again." };
  const { error: e2 } = await supabase.from("product_images").insert({ product_id: productId, storage_path: path, is_primary: (count ?? 0) === 0 });
  if (e2) {
    await supabase.storage.from("product-images").remove([path]);
    return { error: friendly(e2) };
  }
  revalidatePath(`/dashboard/inventory/${productId}`);
  return { success: "Photo added." };
}

export async function deleteProductImage(imageId: string): Promise<ActionResult> {
  await requirePermission("inventory.edit");
  const supabase = await createClient();
  const { data: row } = await supabase.from("product_images").select("storage_path,product_id,is_primary").eq("id", imageId).maybeSingle();
  if (!row) return { error: "Photo not found." };
  await supabase.storage.from("product-images").remove([row.storage_path]);
  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) return { error: friendly(error) };
  if (row.is_primary) {
    const { data: next } = await supabase.from("product_images").select("id").eq("product_id", row.product_id).order("created_at").limit(1);
    if (next?.[0]) await supabase.from("product_images").update({ is_primary: true }).eq("id", next[0].id);
  }
  revalidatePath(`/dashboard/inventory/${row.product_id}`);
  return { success: "Photo removed." };
}

export async function setPrimaryImage(imageId: string): Promise<ActionResult> {
  await requirePermission("inventory.edit");
  const supabase = await createClient();
  const { data: row } = await supabase.from("product_images").select("product_id").eq("id", imageId).maybeSingle();
  if (!row) return { error: "Photo not found." };
  await supabase.from("product_images").update({ is_primary: false }).eq("product_id", row.product_id);
  const { error } = await supabase.from("product_images").update({ is_primary: true }).eq("id", imageId);
  if (error) return { error: friendly(error) };
  revalidatePath(`/dashboard/inventory/${row.product_id}`);
  return { success: "Main photo changed." };
}

export async function addCertificate(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("inventory.edit");
  const productId = String(formData.get("productId") ?? "");
  const issuer = String(formData.get("issuer") ?? "").trim();
  const number = String(formData.get("certificate_number") ?? "").trim();
  const issuedOn = String(formData.get("issued_on") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return { error: "Invalid product." };
  if (!issuer || issuer.length > 80) return { error: "Enter the issuer, for example GIA." };
  if (!number || number.length > 80) return { error: "Enter the certificate number." };
  if (issuedOn && !/^\d{4}-\d{2}-\d{2}$/.test(issuedOn)) return { error: "Enter the date as day, month, year." };

  const supabase = await createClient();
  let path: string | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const up = await readUpload(file, ["pdf", "jpeg", "png"]);
    if ("error" in up) return { error: up.error };
    path = `${productId}/${randomUUID()}.${EXT[up.kind]}`;
    const { error: e1 } = await supabase.storage.from("certificates").upload(path, up.bytes, { contentType: MIME[up.kind] });
    if (e1) return { error: "The certificate file could not be uploaded. Please try again." };
  }
  const { error } = await supabase.from("certificates").insert({
    product_id: productId, issuer, certificate_number: number, issued_on: issuedOn || null, file_path: path, created_by: session.userId,
  });
  if (error) {
    if (path) await supabase.storage.from("certificates").remove([path]);
    return { error: friendly(error) };
  }
  revalidatePath(`/dashboard/inventory/${productId}`);
  return { success: "Certificate added." };
}

export async function deleteCertificate(certId: string): Promise<ActionResult> {
  await requirePermission("inventory.edit");
  const supabase = await createClient();
  const { data: row } = await supabase.from("certificates").select("file_path,product_id").eq("id", certId).maybeSingle();
  if (!row) return { error: "Certificate not found." };
  if (row.file_path) await supabase.storage.from("certificates").remove([row.file_path]);
  const { error } = await supabase.from("certificates").delete().eq("id", certId);
  if (error) return { error: friendly(error) };
  revalidatePath(`/dashboard/inventory/${row.product_id}`);
  return { success: "Certificate removed." };
}

export async function createLocation(values: unknown): Promise<ActionResult> {
  await requirePermission("locations.manage");
  const p = locationSchema.safeParse(values);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.from("stock_locations").insert({ name: p.data.name });
  if (error) return { error: friendly(error) };
  revalidatePath("/dashboard/locations");
  return { success: "Location added." };
}

export async function setLocationActive(values: unknown): Promise<ActionResult> {
  await requirePermission("locations.manage");
  const p = locationActiveSchema.safeParse(values);
  if (!p.success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.from("stock_locations").update({ is_active: p.data.active }).eq("id", p.data.id);
  if (error) return { error: friendly(error) };
  revalidatePath("/dashboard/locations");
  return { success: p.data.active ? "Location switched on." : "Location switched off." };
}
