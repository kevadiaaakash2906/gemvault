import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getRates } from "@/lib/rates";
import { OrderForm, emptyOrder } from "../order-form";

export const metadata: Metadata = { title: "Add order" };

export default async function NewOrderPage() {
  const session = await requirePermission("orders.edit");
  const owner = can(session.role, "costs.view");
  const supabase = await createClient();
  const [rates, { data: buyers }, { data: types }] = await Promise.all([
    owner ? getRates() : Promise.resolve(null),
    supabase.from("buyers").select("name").order("name").limit(500),
    supabase.from("orders").select("jewelry_type").not("jewelry_type", "is", null).limit(2000),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-forest">Add order</h1>
      <OrderForm initial={emptyOrder(rates)} isOwner={owner} usdRate={rates?.usdRate ?? null}
        buyers={(buyers ?? []).map((b) => b.name)} types={[...new Set((types ?? []).map((t) => t.jewelry_type as string))].sort()} />
    </div>
  );
}
