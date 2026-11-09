import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/ledger";
import { daysWaiting } from "@/lib/reports";

export const metadata: Metadata = { title: "Out with customers" };

type Row = { order_id: string; held_by: string; held_since: string; note: string | null; orders: { sr_no: number; style_no: string; jewelry_type: string | null } | { sr_no: number; style_no: string; jewelry_type: string | null }[] | null };

export default async function OutWithCustomersPage() {
  await requirePermission("orders.view");
  const supabase = await createClient();
  const { data, error } = await supabase.from("order_holds").select("order_id,held_by,held_since,note,orders(sr_no,style_no,jewelry_type)").order("held_since").limit(1000);
  const rows = ((data ?? []) as unknown as Row[]).map((r) => ({ ...r, piece: Array.isArray(r.orders) ? r.orders[0] : r.orders }));
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.held_by, [...(groups.get(r.held_by) ?? []), r]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-forest">Out with customers</h1>
        <p className="text-ink-soft">Pieces a customer has but has not bought. They are not sales, so they are not in revenue, profit or Who owes me, and they still count as stock.</p>
      </div>
      {error && <p role="alert" className="rounded-md border border-danger/40 bg-red-50 p-3 text-danger">Could not load this list. If you have not yet run the database update 20261109000010_buyers_and_holds.sql, run it first.</p>}
      {!error && rows.length === 0 && <p className="rounded-md border border-gold-soft bg-white p-5 text-ink-soft">No pieces are out. To mark one, open an unsold order and use “Out with a customer”.</p>}
      {[...groups.entries()].map(([who, list]) => (
        <section key={who} aria-label={who} className="space-y-2 rounded-md border border-gold-soft bg-white p-5">
          <h2 className="font-display text-xl text-forest">{who} <span className="text-base text-ink-soft">· {list.length} {list.length === 1 ? "piece" : "pieces"}</span></h2>
          <ul className="divide-y divide-gold-soft text-sm">
            {list.map((r) => (
              <li key={r.order_id} className="flex flex-wrap justify-between gap-3 py-2">
                <Link href={`/dashboard/orders/${r.order_id}`} className="underline underline-offset-4">Order {r.piece?.sr_no} · {r.piece?.style_no}{r.piece?.jewelry_type ? ` · ${r.piece.jewelry_type}` : ""}</Link>
                <span className="text-ink-soft">Since {fmtDate(r.held_since)} ({daysWaiting(r.held_since) ?? 0} days){r.note ? ` · ${r.note}` : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
