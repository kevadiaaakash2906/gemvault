import { createClient } from "@/lib/supabase/server";
import { sanitizeHidden, type TableKey } from "@/lib/columns";

/** The signed-in person's hidden columns for a table. Empty (show everything) if nothing is saved or the database update has not been run yet. */
export async function getHiddenColumns(supabase: Awaited<ReturnType<typeof createClient>>, table: TableKey): Promise<string[]> {
  const { data } = await supabase.from("user_table_prefs").select("hidden_columns").eq("table_key", table).maybeSingle();
  return sanitizeHidden(table, data?.hidden_columns);
}
