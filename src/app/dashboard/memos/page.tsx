import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, buildQuery, cleanSearch, fmtDate, num, parsePage, usd } from "@/lib/ledger";
import { Tile, TileEmpty } from "@/components/tiles";

export const metadata: Metadata = { title: "Memos" };
const STATUSES = ["Unpaid", "Partial", "Paid"];

export default async function MemosPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  await requirePermission("memos.view");
  const sp = await searchParams;
  const q = cleanSearch(sp.q);
  const page = parsePage(sp.page);
  const status = STATUSES.includes(sp.status ?? "") ? sp.status : undefined;
  const supabase = await createClient();
  let query = supabase.from("memo_summary").select("*", { count: "exact" });
  if (status) query = query.eq("payment_status", status);
  if (q) query = query.or(`memo_no.ilike.%${q}%,buyer.ilike.%${q}%`);
  const from = (page - 1) * PAGE_SIZE;
  const { data: rows, count } = await query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = { q: q || undefined, status };
  return (
    <div className="space-y-5">
      <div><h1 className="font-display text-3xl text-forest">Memos</h1><p className="text-ink-soft">Each memo is one buyer&apos;s bill. Open one to record or view payments.</p></div>
      <form method="get" className="grid gap-3 rounded-md border border-gold-soft bg-white p-4 sm:grid-cols-[2fr_1fr_auto]">
        <div><label htmlFor="q" className="block text-sm font-medium">Search</label><input id="q" name="q" defaultValue={q} placeholder="Memo number or buyer" className="mt-1 min-h-11 w-full rounded-md border border-gold-soft px-3" /></div>
        <div><label htmlFor="status" className="block text-sm font-medium">Payment status</label>
          <select id="status" name="status" defaultValue={status ?? ""} className="mt-1 min-h-11 w-full rounded-md border border-gold-soft bg-white px-3"><option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <button className="min-h-11 self-end rounded-md bg-forest px-5 text-sm font-semibold text-ivory hover:bg-forest-deep">Apply</button>
      </form>
      <div className="hidden overflow-x-auto rounded-md border border-gold-soft bg-white md:block">
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">Memos</caption>
          <thead className="bg-parchment"><tr className="text-left"><th className="px-3 py-2 font-medium">Memo</th><th className="px-3 py-2 font-medium">Sold To</th><th className="px-3 py-2 text-right font-medium">Pieces</th><th className="px-3 py-2 text-right font-medium">Bill</th><th className="px-3 py-2 text-right font-medium">Paid</th><th className="px-3 py-2 text-right font-medium">Balance</th><th className="px-3 py-2 font-medium">Status</th></tr></thead>
          <tbody className="divide-y divide-gold-soft">
            {(rows ?? []).map((m) => (
              <tr key={m.id} className="hover:bg-ivory">
                <td className="px-3 py-2"><Link href={`/dashboard/memos/${m.id}`} className="font-medium text-forest underline underline-offset-4">{m.memo_no}</Link><p className="text-xs text-ink-soft">{fmtDate(String(m.created_at).slice(0, 10))}</p></td>
                <td className="px-3 py-2">{m.buyer}</td><td className="px-3 py-2 text-right">{m.pieces}</td>
                <td className="px-3 py-2 text-right">{usd.format(num(m.total_bill))}</td><td className="px-3 py-2 text-right">{usd.format(num(m.total_paid))}</td>
                <td className="px-3 py-2 text-right font-medium">{usd.format(num(m.balance))}</td><td className="px-3 py-2">{m.payment_status}</td>
              </tr>
            ))}
            {(rows ?? []).length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-ink-soft">No memos yet. A memo appears when you record a sale on an order or trading item.</td></tr>}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label="Memos">
        {(rows ?? []).map((m) => (
          <Tile key={m.id} title={`Memo ${m.memo_no}`} subtitle={m.buyer}
            right={<><p className="font-medium">{usd.format(num(m.balance))}</p><p className="text-ink-soft">{m.payment_status}</p></>}
            facts={[["Pieces", m.pieces], ["Status", m.payment_status], ["Bill", usd.format(num(m.total_bill))], ["Paid", usd.format(num(m.total_paid))], ["Balance", usd.format(num(m.balance))], ["Created", fmtDate(String(m.created_at).slice(0, 10))]]}
            href={`/dashboard/memos/${m.id}`} hrefLabel="Open memo and payments" />
        ))}
        {(rows ?? []).length === 0 && <TileEmpty>No memos yet.</TileEmpty>}
      </ul>
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm"><span className="text-ink-soft">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link className="min-h-11 rounded-md border border-gold-soft bg-white px-4 py-2.5" href={`/dashboard/memos${buildQuery({ ...base, page: String(page - 1) })}`}>Previous</Link>}
            {page < pages && <Link className="min-h-11 rounded-md border border-gold-soft bg-white px-4 py-2.5" href={`/dashboard/memos${buildQuery({ ...base, page: String(page + 1) })}`}>Next</Link>}
          </div></nav>
      )}
    </div>
  );
}
