import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { measureSpeed } from "@/lib/speed";

export const metadata: Metadata = { title: "Speed check" };
export const dynamic = "force-dynamic";

export default async function SpeedPage() {
  await requirePermission("settings.edit");
  const supabase = await createClient();
  const { runs, loginServer, loginLocal } = await measureSpeed(supabase);
  const region = process.env.VERCEL_REGION ?? "not running on Vercel";
  const dbWorst = Math.max(...runs.slice(1));
  const dbVerdict = dbWorst < 60 ? "Database questions are fast: the website and the database are close together." : "Database questions are slow: the website and the database are far apart. Moving the Vercel region next to Supabase should help.";
  const loginVerdict = loginLocal < 50
    ? "The login check is done on the website's own server, so it is fast."
    : "The login check still goes to Supabase every time, which is slow. Supabase needs its newer signing keys switched on (Project Settings, JWT Keys).";
  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="font-display text-3xl text-forest">Speed check</h1>
        <p className="mt-1 text-ink-soft">Measured from the website&apos;s server, right now.</p>
      </div>
      <dl className="grid gap-3 rounded-md border border-gold-soft bg-white p-5 sm:grid-cols-2">
        <div><dt className="text-sm text-ink-soft">Website server region</dt><dd className="text-xl font-medium">{region}</dd></div>
        <div><dt className="text-sm text-ink-soft">Login check used by the site now</dt><dd className="text-xl font-medium">{loginLocal} ms</dd></div>
        <div><dt className="text-sm text-ink-soft">Login check the slow way</dt><dd className="text-xl font-medium">{loginServer} ms</dd></div>
        <div><dt className="text-sm text-ink-soft">Three database questions in a row</dt><dd className="text-xl font-medium">{runs.join(" ms, ")} ms</dd></div>
      </dl>
      <p className="rounded-md bg-parchment p-4">{dbVerdict}</p>
      <p className="rounded-md bg-parchment p-4">{loginVerdict}</p>
      <p className="text-sm text-ink-soft">The first database question is always slower because it opens the connection. Send me a screenshot of this page.</p>
    </div>
  );
}
