"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/auth";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { confirmDeleteSchema, moneyCancelSchema, moneyIdSchema, moneyReasonSchema, moneySendSchema } from "@/lib/validation";

function friendly(error: { code?: string; message: string }): string {
  if (error.code === "42501" || error.code === "P0001" || error.code === "P0002") return error.message;
  return error.message.length < 200 ? error.message : "Something went wrong. Please try again.";
}
const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "Check the form and try again.";
const done = (success: string): ActionResult => { revalidatePath("/dashboard", "layout"); return { success }; };

/** A seller records money they sent to a staff member. It stays waiting until that person accepts it. */
export async function sendMoney(values: unknown): Promise<ActionResult> {
  await requirePermission("money.send");
  const p = moneySendSchema.safeParse(values);
  if (!p.success) return { error: firstIssue(p.error) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_money", { p_to: p.data.to, p_amount: Number(p.data.amount), p_sent_on: p.data.sent_on || null, p_note: p.data.note || null });
  return error ? { error: friendly(error) } : done("Sent. It is waiting for them to accept it.");
}

/** Only the person the money was sent to can accept it (the database checks this). Accepting logs it. */
export async function acceptMoney(values: unknown): Promise<ActionResult> {
  await requirePermission("money.respond");
  const p = moneyIdSchema.safeParse(values);
  if (!p.success) return { error: firstIssue(p.error) };
  const { error } = await (await createClient()).rpc("accept_money", { p_id: p.data.id });
  return error ? { error: friendly(error) } : done("Accepted and logged.");
}

export async function rejectMoney(values: unknown): Promise<ActionResult> {
  await requirePermission("money.respond");
  const p = moneyReasonSchema.safeParse(values);
  if (!p.success) return { error: firstIssue(p.error) };
  const { error } = await (await createClient()).rpc("reject_money", { p_id: p.data.id, p_reason: p.data.reason });
  return error ? { error: friendly(error) } : done("Rejected. It is not logged.");
}

/** The sender withdraws a pending transfer; the owner can clear any pending one (with a reason). */
export async function cancelMoney(values: unknown): Promise<ActionResult> {
  const session = await requirePermission("money.view");
  if (!can(session.role, "money.send") && !can(session.role, "money.reverse")) return { error: "You cannot cancel transfers." };
  const p = moneyCancelSchema.safeParse(values);
  if (!p.success) return { error: firstIssue(p.error) };
  const { error } = await (await createClient()).rpc("cancel_money", { p_id: p.data.id, p_reason: p.data.reason || null });
  return error ? { error: friendly(error) } : done("Cancelled.");
}

/** The owner removes a transfer from the ledger altogether (a mistake or a test). Needs the owner's own password. */
export async function deleteMoney(values: unknown): Promise<ActionResult> {
  await requirePermission("money.delete");
  const p = confirmDeleteSchema.safeParse(values);
  if (!p.success) return { error: firstIssue(p.error) };
  const { error } = await (await createClient()).rpc("delete_money", { p_id: p.data.id, p_password: p.data.password });
  return error ? { error: friendly(error) } : done("Deleted from the ledger.");
}

export async function reverseMoney(values: unknown): Promise<ActionResult> {
  await requirePermission("money.reverse");
  const p = moneyReasonSchema.safeParse(values);
  if (!p.success) return { error: firstIssue(p.error) };
  const { error } = await (await createClient()).rpc("reverse_money", { p_id: p.data.id, p_reason: p.data.reason });
  return error ? { error: friendly(error) } : done("Reversed. It is no longer in the logged total.");
}
