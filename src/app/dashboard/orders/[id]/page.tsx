import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getRates } from "@/lib/rates";
import { DeleteButton } from "@/components/delete-button";
import { ReturnPiece } from "@/components/return-piece";
import { OrderForm } from "../order-form";
import type { OrderValues } from "@/lib/validation";

export const metadata: Metadata = { title: "Edit order" };
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("orders.edit");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const owner = can(session.role, "costs.view");
  const supabase = await createClient();
  const [{ data: o }, { data: buyers }, { data: types }, rates, costRes] = await Promise.all([
    supabase.from("order_overview").select("*").eq("id", id).maybeSingle(),
    supabase.from("buyers").select("name").order("name").limit(500),
    supabase.from("orders").select("jewelry_type").not("jewelry_type", "is", null).limit(2000),
    owner ? getRates() : Promise.resolve(null),
    owner ? supabase.from("order_costs").select("*").eq("order_id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!o) notFound();
  const c = costRes.data;
  const pg = Number(o.net_wt) * Number(o.multiplier);
  const impliedRate = c && pg > 0 ? String(Math.round(Number(c.gold_amount) / pg)) : String(rates?.goldRate ?? "");
  const flat = !!c && Number(c.labor_amount) === Number(c.l_charges) && Math.round(Number(o.net_wt) * Number(c.l_charges)) !== Number(c.l_charges);

  const initial: OrderValues = {
    id: o.id, customer: s(o.customer), style_no: o.style_no, jewelry_type: s(o.jewelry_type), diamond_shape: s(o.diamond_shape),
    order_date: s(o.order_date), gross_wt: s(o.gross_wt), dia_qty: s(o.dia_qty), in_ct: s(o.in_ct), colour_stone: s(o.colour_stone),
    net_wt: s(o.net_wt), multiplier: s(o.multiplier), sold_to: s(o.sold_to), memo_no: s(o.memo_no), sale_price: s(o.sale_price), date_sold: s(o.date_sold),
    cost: owner ? { gold_rate: impliedRate, diam_amount: s(c?.diam_amount), l_charges: s(c?.l_charges ?? rates?.defaultLabor), flat_labor: flat } : undefined,
  };
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-forest">Order {o.sr_no}</h1>
      <OrderForm initial={initial} isOwner={owner} usdRate={rates?.usdRate ?? null}
        buyers={(buyers ?? []).map((b) => b.name)} types={[...new Set((types ?? []).map((t) => t.jewelry_type as string))].sort()} />
      {o.sale_price !== null && can(session.role, "returns.record") && (
        <ReturnPiece kind="order" id={id} label={o.style_no} buyer={o.sold_to} salePrice={Number(o.sale_price)}
          memoPaid={Number(o.memo_paid)} memoBill={Number(o.memo_paid) + Number(o.memo_balance)} />
      )}
      {can(session.role, "records.delete") && o.sale_price === null && (
        <DeleteButton kind="order" id={id} redirectTo="/dashboard/orders" label="Delete this order" />
      )}
    </div>
  );
}
