import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { can, type Role } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getRates } from "@/lib/rates";
import { DeleteButton } from "@/components/delete-button";
import { ReturnPiece } from "@/components/return-piece";
import { OrderForm } from "../order-form";
import { OrderSaleForm } from "@/components/order-sale-form";
import { usd } from "@/lib/ledger";
import type { OrderValues } from "@/lib/validation";

export const metadata: Metadata = { title: "Edit order" };
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("orders.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  if (!can(session.role, "orders.edit")) return <SaleOnlyPage id={id} role={session.role} />;
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

/** What a seller sees: the order's details to read, and the sale to fill in. */
async function SaleOnlyPage({ id, role }: { id: string; role: Role }) {
  if (!can(role, "orders.sale")) notFound();
  const supabase = await createClient();
  const showCost = can(role, "costs.view");
  const [{ data: o }, { data: buyers }, costRes] = await Promise.all([
    supabase.from("order_overview").select("*").eq("id", id).maybeSingle(),
    supabase.from("buyers").select("name").order("name").limit(500),
    showCost ? supabase.from("order_costs").select("usd_cost").eq("order_id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!o) notFound();
  const facts: [string, string][] = [
    ["Style", s(o.style_no)], ["Customer", s(o.customer)], ["Type", s(o.jewelry_type)], ["Diamond shape", s(o.diamond_shape)],
    ["Order date", s(o.order_date)], ["Gross wt", s(o.gross_wt)], ["Net wt", s(o.net_wt)], ["Pg wt", s(o.pg_wt)],
    ...(showCost && costRes.data ? [["Cost", usd.format(Number(costRes.data.usd_cost))] as [string, string]] : []),
  ];
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-forest">Order {o.sr_no}</h1>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border border-gold-soft bg-white p-4 text-sm sm:grid-cols-4">
        {facts.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-ink-soft">{k}</dt><dd className="break-words font-medium">{v || "—"}</dd></div>)}
      </dl>
      <OrderSaleForm id={id} alreadySold={o.sale_price !== null} buyers={(buyers ?? []).map((b) => b.name)}
        initial={{ sold_to: s(o.sold_to), memo_no: s(o.memo_no), sale_price: s(o.sale_price), date_sold: s(o.date_sold) }} />
    </div>
  );
}
