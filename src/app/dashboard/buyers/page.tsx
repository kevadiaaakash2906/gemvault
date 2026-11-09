import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { cleanSearch, num, usd } from "@/lib/ledger";
import { duplicateGroups } from "@/lib/similar-buyers";
import { MergeBuyers } from "@/components/buyer-tools";

export const metadata: Metadata = { title: "Buyers" };

export default async function BuyersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requirePermission("buyers.view");
  const sp = await searchParams;
  const q = cleanSearch(sp.q).toLowerCase();
  const supabase = await createClient();
  const [{ data: buyers, error }, { data: money }] = await Promise.all([
    supabase.from("buyers").select("id,name").order("name").limit(1000),
    supabase.from("buyer_receivables").select("buyer_id,memos,total_billed,total_paid,balance_due").limit(1000),
  ]);
  const all = (buyers ?? []) as { id: string; name: string }[];
  type Money = { buyer_id: string; memos: number; total_billed: number; total_paid: number; balance_due: number };
  const byId = new Map(((money ?? []) as Money[]).map((m) => [String(m.buyer_id), m] as const));
  const shown = q ? all.filter((b) => b.name.toLowerCase().includes(q)) : all;
  const groups = duplicateGroups(all);
  const owner = can(session.role, "buyers.manage");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-forest">Buyers</h1>
        <p className="text-ink-soft">{all.length} buyers. Open one to see everything they have bought, paid and still owe, and to print a statement.</p>
      </div>

      {groups.length > 0 && (
        <section aria-labelledby="dupes" className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4 sm:p-5">
          <h2 id="dupes" className="font-display text-xl text-forest">Possible duplicates</h2>
          <p className="text-sm">These names look alike. If they are the same business, merge them so their memos and balances are in one place.</p>
          {groups.map((g) => (
            <div key={g[0].id} className="space-y-2 rounded-md border border-gold-soft bg-white p-3">
              <p className="font-medium">{g.map((b) => b.name).join("  ·  ")}</p>
              {owner ? g.slice(1).map((other) => (
                <div key={other.id} className="flex flex-wrap gap-3">
                  <MergeBuyers from={other} into={g[0]} />
                  <MergeBuyers from={g[0]} into={other} />
                </div>
              )) : <p className="text-sm text-ink-soft">Only an owner can merge buyers.</p>}
            </div>
          ))}
        </section>
      )}

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-md border border-gold-soft bg-white p-4">
        <div className="min-w-[14rem] flex-1"><label htmlFor="q" className="block text-sm font-medium">Search buyer</label><input id="q" name="q" defaultValue={q} className="mt-1 min-h-11 w-full rounded-md border border-gold-soft px-3" /></div>
        <button className="min-h-11 rounded-md bg-forest px-5 text-sm font-semibold text-ivory hover:bg-forest-deep">Search</button>
      </form>
      {error && <p role="alert" className="rounded-md border border-danger/40 bg-red-50 p-3 text-danger">Could not load buyers. Please refresh the page.</p>}

      <div className="overflow-x-auto rounded-md border border-gold-soft bg-white">
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">Buyers</caption>
          <thead className="bg-parchment"><tr className="text-left">
            <th scope="col" className="px-3 py-2 font-medium">Buyer</th><th scope="col" className="px-3 py-2 text-right font-medium">Memos</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Total billed</th><th scope="col" className="px-3 py-2 text-right font-medium">Total paid</th><th scope="col" className="px-3 py-2 text-right font-medium">Balance due</th>
          </tr></thead>
          <tbody className="divide-y divide-gold-soft">
            {shown.map((b) => {
              const m = byId.get(b.id);
              const due = num(m?.balance_due);
              return (
                <tr key={b.id}>
                  <td className="px-3 py-2"><Link href={`/dashboard/buyers/${b.id}`} className="font-medium text-forest underline underline-offset-4">{b.name}</Link></td>
                  <td className="px-3 py-2 text-right">{num(m?.memos)}</td>
                  <td className="px-3 py-2 text-right">{usd.format(num(m?.total_billed))}</td>
                  <td className="px-3 py-2 text-right">{usd.format(num(m?.total_paid))}</td>
                  <td className={`px-3 py-2 text-right ${due > 0 ? "font-semibold text-amber-700" : ""}`}>{usd.format(due)}</td>
                </tr>
              );
            })}
            {shown.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-soft">No buyers match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
