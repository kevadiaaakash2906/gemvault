import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { ReturnPiece } from "@/components/return-piece";
import { TradeForm } from "../trade-form";
import type { TradeValues } from "@/lib/validation";

export const metadata: Metadata = { title: "Edit trading item" };
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function EditTradePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("trades.edit");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const owner = can(session.role, "costs.view");
  const supabase = await createClient();
  const [{ data: t }, { data: buyers }, costRes] = await Promise.all([
    supabase.from("trade_overview").select("*").eq("id", id).maybeSingle(),
    supabase.from("buyers").select("name").order("name").limit(500),
    owner ? supabase.from("trade_costs").select("*").eq("trade_id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!t) notFound();
  const initial: TradeValues = {
    id: t.id, trade_date: s(t.trade_date), item: t.item, notes: s(t.notes), sold_to: s(t.sold_to), memo_no: s(t.memo_no),
    sale_price: s(t.sale_price), date_sold: s(t.date_sold),
    cost: owner ? { vendor: s(costRes.data?.vendor), purchase_price: s(costRes.data?.purchase_price) } : undefined,
  };
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-forest">Trading item {t.sr_no}</h1>
      <TradeForm initial={initial} isOwner={owner} buyers={(buyers ?? []).map((b) => b.name)} />
      {t.sale_price !== null && can(session.role, "returns.record") && (
        <ReturnPiece kind="trade" id={id} label={t.item} buyer={t.sold_to} salePrice={Number(t.sale_price)}
          memoPaid={Number(t.memo_paid)} memoBill={Number(t.memo_paid) + Number(t.memo_balance)} />
      )}
      {can(session.role, "records.delete") && t.sale_price === null && <DeleteButton kind="trade" id={id} redirectTo="/dashboard/trading" label="Delete this item" />}
    </div>
  );
}
