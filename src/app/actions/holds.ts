"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/auth";

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function friendly(error: { code?: string; message: string }): string {
  if (error.code === "42501" || error.code === "P0001" || error.code === "P0002") return error.message;
  if (error.code === "42883" || error.code === "PGRST202") return "This feature needs its database update first (supabase/migrations/20261109000010_buyers_and_holds.sql).";
  return error.message.length < 200 ? error.message : "Something went wrong. Please try again.";
}

/** Marks an unsold piece as out with a customer. It stays in stock and is not counted as a sale. */
export async function setOrderHold(values: { order_id: string; held_by: string; since?: string; note?: string }): Promise<ActionResult> {
  await requirePermission("orders.hold");
  if (!UUID.test(values.order_id)) return { error: "That order does not exist." };
  const held_by = (values.held_by ?? "").trim();
  if (held_by.length < 1 || held_by.length > 120) return { error: "Enter who has the piece (up to 120 characters)." };
  const since = (values.since ?? "").trim();
  if (since && !DATE.test(since)) return { error: "The date is not valid." };
  const note = (values.note ?? "").trim();
  if (note.length > 300) return { error: "The note is too long (300 characters at most)." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_hold", { p_order: values.order_id, p_held_by: held_by, p_since: since || null, p_note: note || null });
  if (error) return { error: friendly(error) };
  revalidatePath("/dashboard", "layout");
  return { success: "Saved." };
}

export async function clearOrderHold(values: { order_id: string }): Promise<ActionResult> {
  await requirePermission("orders.hold");
  if (!UUID.test(values.order_id)) return { error: "That order does not exist." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_order_hold", { p_order: values.order_id });
  if (error) return { error: friendly(error) };
  revalidatePath("/dashboard", "layout");
  return { success: "Back in stock." };
}
