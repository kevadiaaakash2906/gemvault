"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { IMAGE_EXT, IMAGE_MIME, MAX_MAIN_BYTES, MAX_THUMB_BYTES, detectImageType } from "@/lib/files";
import { styleSchema } from "@/lib/validation";
import type { ActionResult } from "@/app/actions/auth";

export type StyleSaveResult = ActionResult & { id?: string };
export type StyleLookup = { found: boolean; id?: string; jewelry_type?: string; diamond_shape?: string; thumbUrl?: string | null };

function friendly(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "That style number already exists.";
  if (error.code === "42501" || error.code === "P0001" || error.code === "P0002") return error.message;
  return error.message.length < 200 ? error.message : "Something went wrong. Please try again.";
}

export async function saveStyle(values: unknown): Promise<StyleSaveResult> {
  await requirePermission("styles.edit");
  const parsed = styleSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_style", { p: parsed.data });
  if (error) return { error: friendly(error) };
  revalidatePath("/dashboard/styles");
  return { id: data as string, success: "Saved." };
}

async function readImage(file: FormDataEntryValue | null, maxBytes: number, label: string) {
  if (!(file instanceof File) || file.size === 0) return { error: `Choose a ${label} first.` } as const;
  if (file.size > maxBytes) return { error: `The ${label} is too large. Try again.` } as const;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectImageType(bytes);
  if (!kind) return { error: "That file is not a photo (JPG, PNG or WebP)." } as const;
  return { bytes, kind } as const;
}

export async function uploadStylePhoto(formData: FormData): Promise<ActionResult> {
  await requirePermission("styles.edit");
  const styleId = String(formData.get("styleId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(styleId)) return { error: "Invalid style." };
  const main = await readImage(formData.get("photo"), MAX_MAIN_BYTES, "photo");
  if ("error" in main) return { error: main.error };
  const thumb = await readImage(formData.get("thumb"), MAX_THUMB_BYTES, "small picture");
  if ("error" in thumb) return { error: thumb.error };

  const supabase = await createClient();
  const base = `${styleId}/${randomUUID()}`;
  const photoPath = `${base}.${IMAGE_EXT[main.kind]}`;
  const thumbPath = `${base}-t.${IMAGE_EXT[thumb.kind]}`;
  const up1 = await supabase.storage.from("style-photos").upload(photoPath, main.bytes, { contentType: IMAGE_MIME[main.kind] });
  if (up1.error) return { error: "The photo could not be uploaded. Please try again." };
  const up2 = await supabase.storage.from("style-photos").upload(thumbPath, thumb.bytes, { contentType: IMAGE_MIME[thumb.kind] });
  if (up2.error) {
    await supabase.storage.from("style-photos").remove([photoPath]);
    return { error: "The photo could not be uploaded. Please try again." };
  }
  const { data: old, error } = await supabase.rpc("set_style_photo", { p_style: styleId, p_photo: photoPath, p_thumb: thumbPath });
  if (error) {
    await supabase.storage.from("style-photos").remove([photoPath, thumbPath]);
    return { error: friendly(error) };
  }
  const stale = ((old as (string | null)[] | null) ?? []).filter((p): p is string => !!p);
  if (stale.length) await supabase.storage.from("style-photos").remove(stale);
  revalidatePath("/dashboard", "layout");
  return { success: "Photo saved." };
}

export async function deleteStyle(styleId: string): Promise<ActionResult> {
  await requirePermission("styles.delete");
  if (!/^[0-9a-f-]{36}$/i.test(styleId)) return { error: "Invalid style." };
  const supabase = await createClient();
  const { data: old, error } = await supabase.rpc("delete_style", { p_style: styleId });
  if (error) return { error: friendly(error) };
  const stale = ((old as (string | null)[] | null) ?? []).filter((p): p is string => !!p);
  if (stale.length) await supabase.storage.from("style-photos").remove(stale);
  revalidatePath("/dashboard", "layout");
  return { success: "Style deleted." };
}

/** Used by the order form: finds a style by its number so type, shape and photo can be filled in. */
export async function lookupStyle(styleNo: string): Promise<StyleLookup> {
  await requirePermission("styles.view");
  const key = String(styleNo ?? "").trim().toUpperCase();
  if (!key || key.length > 120) return { found: false };
  const supabase = await createClient();
  const { data } = await supabase.from("styles").select("id,jewelry_type,diamond_shape,thumb_path").eq("style_key", key).maybeSingle();
  if (!data) return { found: false };
  let thumbUrl: string | null = null;
  if (data.thumb_path) {
    const { data: signed } = await supabase.storage.from("style-photos").createSignedUrl(data.thumb_path, 3600);
    thumbUrl = signed?.signedUrl ?? null;
  }
  return { found: true, id: data.id, jewelry_type: data.jewelry_type ?? "", diamond_shape: data.diamond_shape ?? "", thumbUrl };
}
