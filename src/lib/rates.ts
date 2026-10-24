import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Rates = { goldRate: number; usdRate: number; defaultMultiplier: number; defaultLabor: number };

/** Only the owner can read the rates; everyone else gets null. */
export async function getRates(): Promise<Rates | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("business_settings").select("gold_rate,usd_rate,default_multiplier,default_labor").maybeSingle();
  if (!data) return null;
  return { goldRate: Number(data.gold_rate), usdRate: Number(data.usd_rate), defaultMultiplier: Number(data.default_multiplier), defaultLabor: Number(data.default_labor) };
}
