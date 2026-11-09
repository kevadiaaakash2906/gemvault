"use server";

import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sanitizeHidden, type TableKey } from "@/lib/columns";
import type { ActionResult } from "@/app/actions/auth";

/** Saves which columns the signed-in person hides on Orders or Trading. Stored on their account, so it follows them to any computer. */
export async function saveColumns(values: { table: string; hidden: string[] }): Promise<ActionResult> {
  if (values.table !== "orders" && values.table !== "trading") return { error: "Unknown table." };
  const table: TableKey = values.table;
  await requirePermission(table === "orders" ? "orders.view" : "trades.view");
  const hidden = sanitizeHidden(table, values.hidden);
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_column_prefs", { p_table: table, p_hidden: hidden });
  if (error) {
    if (error.code === "42883" || error.code === "PGRST202") return { error: "Saving columns needs its database update first (20261109000011_column_prefs.sql)." };
    return { error: "Could not save your columns. Please try again." };
  }
  return { success: "Saved." };
}
