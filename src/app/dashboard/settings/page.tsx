import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { getRates } from "@/lib/rates";
import { RatesForm } from "./rates-form";

export const metadata: Metadata = { title: "Rates" };

export default async function SettingsPage() {
  await requirePermission("settings.edit");
  const rates = await getRates();
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-3xl text-forest">Rates</h1>
        <p className="mt-1 text-ink-soft">New orders use these to work out Gold Amount, Labor Amount and the dollar cost. Old orders keep the amounts they were saved with.</p>
      </div>
      <p className="text-sm"><a href="/dashboard/speed" className="text-gold-deep underline underline-offset-4">Speed check</a></p>
      {rates && <RatesForm initial={{ gold_rate: String(rates.goldRate), usd_rate: String(rates.usdRate), default_multiplier: String(rates.defaultMultiplier), default_labor: String(rates.defaultLabor) }} />}
    </div>
  );
}
