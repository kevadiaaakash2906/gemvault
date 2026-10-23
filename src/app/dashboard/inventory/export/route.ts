import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !can(session.role, "inventory.view")) return new NextResponse("Not allowed", { status: 403 });
  const status = new URL(request.url).searchParams.get("status");
  const owner = can(session.role, "costs.view");
  const supabase = await createClient();

  const all: Record<string, unknown>[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    let q = supabase
      .from("product_overview")
      .select("id,sku,barcode,name,category,collection,metal_type,purity,gross_weight_g,net_metal_weight_g,tracking,retail_price,hsn_code,gst_rate,low_stock_threshold,total_quantity,is_archived")
      .order("sku")
      .range(from, from + 999);
    if (status === "archived") q = q.eq("is_archived", true);
    else if (status !== "all") q = q.eq("is_archived", false);
    const { data, error } = await q;
    if (error) return new NextResponse("Could not read products", { status: 500 });
    all.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }

  const costs = new Map<string, { purchase_cost: number; additional_cost: number; making_charges: number }>();
  if (owner) {
    for (let from = 0; from < 20000; from += 1000) {
      const { data } = await supabase.from("product_costs").select("product_id,purchase_cost,additional_cost,making_charges").range(from, from + 999);
      (data ?? []).forEach((c) => costs.set(c.product_id, c));
      if ((data ?? []).length < 1000) break;
    }
  }

  const head = ["SKU", "Barcode", "Name", "Category", "Collection", "Metal", "Purity", "Gross weight (g)", "Net metal weight (g)", "Tracking", "Retail price", "HSN", "GST %", "Low-stock level", "In stock", "Archived"];
  if (owner) head.push("Purchase cost", "Additional cost", "Making charges");
  const rows = all.map((r) => {
    const base = [r.sku, r.barcode, r.name, r.category, r.collection, r.metal_type, r.purity, r.gross_weight_g, r.net_metal_weight_g, r.tracking, r.retail_price, r.hsn_code, r.gst_rate, r.low_stock_threshold, r.total_quantity, r.is_archived ? "yes" : "no"] as (string | number | null)[];
    if (owner) {
      const c = costs.get(r.id as string);
      base.push(c?.purchase_cost ?? "", c?.additional_cost ?? "", c?.making_charges ?? "");
    }
    return base;
  });
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse("\uFEFF" + toCsv([head, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gemvault-inventory-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
