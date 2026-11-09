"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/auth";

const UUID = /^[0-9a-f-]{36}$/i;

function friendly(error: { code?: string; message: string }): string {
  if (error.code === "42501" || error.code === "P0001" || error.code === "P0002") return error.message;
  if (error.code === "23503") return "Something else still points to this buyer, so it could not be changed.";
  return error.message.length < 200 ? error.message : "Something went wrong. Please try again.";
}

export async function renameBuyer(values: { id: string; name: string }): Promise<ActionResult> {
  await requirePermission("buyers.manage");
  if (!UUID.test(values.id)) return { error: "That buyer does not exist." };
  const name = (values.name ?? "").trim();
  if (name.length < 1 || name.length > 120) return { error: "Enter a name of up to 120 characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_buyer", { p_id: values.id, p_name: name });
  if (error) return { error: friendly(error) };
  revalidatePath("/dashboard", "layout");
  return { success: "Renamed." };
}

/** Moves all memos of `from` to `into` and removes `from`. */
export async function mergeBuyers(values: { from: string; into: string }): Promise<ActionResult> {
  await requirePermission("buyers.manage");
  if (!UUID.test(values.from) || !UUID.test(values.into)) return { error: "That buyer does not exist." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("merge_buyers", { p_from: values.from, p_into: values.into });
  if (error) return { error: friendly(error) };
  revalidatePath("/dashboard", "layout");
  return { success: "Merged." };
}
