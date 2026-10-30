"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { confirmDeleteSchema, deleteSchema, expenseSchema, orderSchema, paymentSchema, ratesSchema, returnSchema, saleSchema, tradeSchema, voidSchema } from "@/lib/validation";
import type { ActionResult } from "@/app/actions/auth";

export type SaveResult = ActionResult & { id?: string };

function friendly(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    if (error.message.includes("memos_no")) return "That memo number already exists for another buyer.";
    return "That value is already in use.";
  }
  if (error.code === "23514") return "One of the values is outside the allowed range. Check the weights, prices and dates.";
  if (error.code === "22007" || error.code === "22008") return "One of the dates is not valid.";
  if (error.code === "42501" || error.code === "P0001" || error.code === "P0002") return error.message;
  return error.message.length < 200 ? error.message : "Something went wrong. Please try again.";
}

export async function saveOrder(values: unknown): Promise<SaveResult> {
  await requirePermission("orders.edit");
  const parsed = orderSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const { cost, ...order } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_order", { p: order, p_cost: cost ?? null });
  if (error) return { error: friendly(error) };
  revalidatePath("/dashboard", "layout");
  return { id: data as string, success: "Saved." };
}

/** Sellers (and staff/owner) record or change the sale part of an existing order. Nothing else on the order can change. */
export async function saveOrderSale(values: unknown): Promise<SaveResult> {
  await requirePermission("orders.sale");
  const parsed = saleSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_order_sale", { p: parsed.data });
  if (error) return { error: friendly(error) };
  revalidatePath("/dashboard", "layout");
  return { id: data as string, success: "Sale saved." };
}

export async function saveTrade(values: unknown): Promise<SaveResult> {
  await requirePermission("trades.edit");
  const parsed = tradeSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const { cost, ...trade } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_trade", { p: trade, p_cost: cost ?? null });
  if (error) return { error: friendly(error) };
  revalidatePath("/dashboard", "layout");
  return { id: data as string, success: "Saved." };
}

export async function saveExpense(values: unknown): Promise<SaveResult> {
  await requirePermission("expenses.manage");
  const parsed = expenseSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_expense", { p: parsed.data });
  if (error) return { error: friendly(error) };
  revalidatePath("/dashboard", "layout");
  return { id: data as string, success: "Saved." };
}

export async function recordPayment(values: unknown): Promise<ActionResult> {
  await requirePermission("payments.record");
  const p = paymentSchema.safeParse(values);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the payment and try again." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_payment", { p_memo: p.data.memoId, p_amount: Number(p.data.amount), p_paid_on: p.data.paidOn, p_key: p.data.key ?? null });
  if (error) return { error: friendly(error) };
  revalidatePath("/dashboard", "layout");
  return { success: "Payment recorded." };
}

export async function voidPayment(values: unknown): Promise<ActionResult> {
  await requirePermission("payments.void");
  const p = voidSchema.safeParse(values);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Give a reason." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_payment", { p_payment: p.data.paymentId, p_reason: p.data.reason });
  if (error) return { error: friendly(error) };
  revalidatePath("/dashboard", "layout");
  return { success: "Payment cancelled." };
}

export type ReturnResult = ActionResult & { id?: string; refund?: number };

/** A sold piece comes back. The database checks the person's own login password, so this cannot be skipped. */
export async function returnPiece(values: unknown): Promise<ReturnResult> {
  await requirePermission("returns.record");
  const p = returnSchema.safeParse(values);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the form and try again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("return_piece", {
    p_kind: p.data.kind, p_id: p.data.id, p_reason: p.data.reason, p_password: p.data.password, p_returned_on: p.data.returnedOn || null,
  });
  if (error) return { error: friendly(error) };
  revalidatePath("/dashboard", "layout");
  const r = data as { id: string; refund: number };
  return { success: "Return recorded.", id: r.id, refund: Number(r.refund) };
}

/** Permanently delete an empty memo. The database checks the person's own password and that no pieces are on it. */
export async function deleteMemo(values: unknown): Promise<ActionResult> {
  await requirePermission("memos.delete");
  const p = confirmDeleteSchema.safeParse(values);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the form and try again." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_memo", { p_memo: p.data.id, p_password: p.data.password });
  if (error) return { error: friendly(error) };
  revalidatePath("/dashboard", "layout");
  return { success: "Memo deleted." };
}

/** Permanently delete one return record (the piece stays in stock). Needs the person's own password. */
export async function deleteReturn(values: unknown): Promise<ActionResult> {
  await requirePermission("returns.delete");
  const p = confirmDeleteSchema.safeParse(values);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the form and try again." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_return", { p_return: p.data.id, p_password: p.data.password });
  if (error) return { error: friendly(error) };
  revalidatePath("/dashboard", "layout");
  return { success: "Return deleted." };
}

export async function deleteRecord(values: unknown): Promise<ActionResult> {
  await requirePermission("records.delete");
  const p = deleteSchema.safeParse(values);
  if (!p.success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_record", { p_kind: p.data.kind, p_id: p.data.id });
  if (error) return { error: friendly(error) };
  revalidatePath("/dashboard", "layout");
  return { success: "Deleted. A copy is kept in the audit log." };
}

export async function saveRates(values: unknown): Promise<ActionResult> {
  await requirePermission("settings.edit");
  const p = ratesSchema.safeParse(values);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the rates and try again." };
  const supabase = await createClient();
  const { error } = await supabase.from("business_settings").update({
    gold_rate: Number(p.data.gold_rate), usd_rate: Number(p.data.usd_rate),
    default_multiplier: Number(p.data.default_multiplier), default_labor: Number(p.data.default_labor),
  }).eq("id", true);
  if (error) return { error: friendly(error) };
  revalidatePath("/dashboard", "layout");
  return { success: "Rates saved. New orders will use them." };
}
