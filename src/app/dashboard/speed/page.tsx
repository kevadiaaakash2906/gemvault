import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { measureSpeed } from "@/lib/speed";

export const metadata: Metadata = { title: "Speed check" };
export const dynamic = "force-dynamic";

export default async function SpeedPage() {
  await requirePermission("settings.edit");
  const supabase = await createClient();
  const { runs, login } = await measureSpeed(supabase);
  const region = process.env.VERCEL_REGION ?? "not running on Vercel";
  const worst = Math.max(...runs);
  const verdict = worst < 120 ? "Fast. The website and the database are close together." : worst < 350 ? "Slow-ish. They are probably in different parts of the world. Moving the Vercel region next to Supabase should help." : "Very slow. They are far apart or the database is busy. Moving the Vercel region next to Supabase should help a lot.";
  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-forest">Speed check</h1>
        <p className="mt-1 text-ink-soft">Measured from the website&apos;s server to your database, right now.</p>
      </div>
      <dl className="grid gap-3 rounded-md border border-gold-soft bg-white p-5 sm:grid-cols-2">
        <div><dt className="text-sm text-ink-soft">Website server region</dt><dd className="text-xl font-medium">{region}</dd></div>
        <div><dt className="text-sm text-ink-soft">Login check</dt><dd className="text-xl font-medium">{login} ms</dd></div>
        <div className="sm:col-span-2"><dt className="text-sm text-ink-soft">Three database questions in a row</dt><dd className="text-xl font-medium">{runs.join(" ms, ")} ms</dd></div>
      </dl>
      <p className="rounded-md bg-parchment p-4">{verdict}</p>
      <p className="text-sm text-ink-soft">Each page asks the database several questions one after another, so every extra 100 ms here adds up. Send me a screenshot of this page and the region shown in Supabase under Project Settings, General.</p>
    </div>
  );
}
