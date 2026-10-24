import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { TradeForm, emptyTrade } from "../trade-form";

export const metadata: Metadata = { title: "Add trading item" };

export default async function NewTradePage() {
  const session = await requirePermission("trades.edit");
  const owner = can(session.role, "costs.view");
  const supabase = await createClient();
  const { data: buyers } = await supabase.from("buyers").select("name").order("name").limit(500);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-forest">Add trading item</h1>
      <TradeForm initial={emptyTrade(owner)} isOwner={owner} buyers={(buyers ?? []).map((b) => b.name)} />
    </div>
  );
}
