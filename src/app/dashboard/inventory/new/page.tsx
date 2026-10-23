import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { ProductForm, emptyProduct } from "../product-form";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  const session = await requirePermission("inventory.edit");
  const supabase = await createClient();
  const { data: locations } = await supabase.from("stock_locations").select("id,name").eq("is_active", true).order("name");
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-forest">Add product</h1>
      <ProductForm initial={emptyProduct} canSeeCosts={can(session.role, "costs.view")} locations={locations ?? []} isNew />
    </div>
  );
}
