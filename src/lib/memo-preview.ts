import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MemoPiece = { kind: "Order" | "Trade"; label: string; price: number; isThis: boolean };
export type MemoPreview =
  | { found: false }
  | { found: true; memo_no: string; buyer: string; bill: number; paid: number; balance: number; status: string; pieces: MemoPiece[]; thisPrice: number };

/** A memo's buyer, money and pieces, for the sale form. `orderId` marks the order being edited so it is not counted twice. */
export async function getMemoPreview(supabase: SupabaseClient, memoNo: string, orderId?: string): Promise<MemoPreview> {
  const { data: m } = await supabase.from("memo_summary").select("id,memo_no,buyer,total_bill,total_paid,balance,payment_status")
    .eq("memo_no", memoNo.trim().toUpperCase()).maybeSingle();   // memo numbers are stored in capitals
  if (!m) return { found: false };
  const [{ data: orders }, { data: trades }] = await Promise.all([
    supabase.from("orders").select("id,style_no,sale_price").eq("memo_id", m.id).order("sr_no"),
    supabase.from("trades").select("item,sale_price").eq("memo_id", m.id).order("sr_no"),
  ]);
  const pieces: MemoPiece[] = [
    ...(orders ?? []).map((o) => ({ kind: "Order" as const, label: String(o.style_no), price: Number(o.sale_price), isThis: o.id === orderId })),
    ...(trades ?? []).map((t) => ({ kind: "Trade" as const, label: String(t.item), price: Number(t.sale_price), isThis: false })),
  ];
  return {
    found: true, memo_no: String(m.memo_no), buyer: String(m.buyer), bill: Number(m.total_bill), paid: Number(m.total_paid),
    balance: Number(m.balance), status: String(m.payment_status), pieces, thisPrice: pieces.find((p) => p.isThis)?.price ?? 0,
  };
}
