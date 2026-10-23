import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "../../product-form";
import type { ProductValues } from "@/lib/validation";

export const metadata: Metadata = { title: "Edit product" };
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("inventory.edit");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const owner = can(session.role, "costs.view");

  const [{ data: p }, { data: stones }, { data: cost }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("product_stones").select("*").eq("product_id", id).order("created_at"),
    owner ? supabase.from("product_costs").select("*").eq("product_id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!p) notFound();

  const initial: ProductValues = {
    id: p.id, sku: p.sku, barcode: s(p.barcode), name: p.name, description: s(p.description), category: p.category,
    collection: s(p.collection), metal_type: s(p.metal_type) as ProductValues["metal_type"], purity: s(p.purity),
    gross_weight_g: s(p.gross_weight_g), net_metal_weight_g: s(p.net_metal_weight_g), tracking: p.tracking,
    retail_price: s(p.retail_price), hsn_code: s(p.hsn_code), gst_rate: s(p.gst_rate), low_stock_threshold: s(p.low_stock_threshold),
    stones: (stones ?? []).map((x) => ({
      stone_type: x.stone_type, shape: s(x.shape), cut: s(x.cut), colour: s(x.colour), clarity: s(x.clarity),
      carat_weight: s(x.carat_weight), length_mm: s(x.length_mm), width_mm: s(x.width_mm), depth_mm: s(x.depth_mm),
      origin: s(x.origin), treatment: s(x.treatment), piece_count: s(x.piece_count),
    })),
    costs: owner ? { purchase_cost: s(cost?.purchase_cost), additional_cost: s(cost?.additional_cost), making_charges: s(cost?.making_charges) } : undefined,
  };
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-forest">Edit {p.name}</h1>
      <ProductForm initial={initial} canSeeCosts={owner} locations={[]} isNew={false} />
    </div>
  );
}
