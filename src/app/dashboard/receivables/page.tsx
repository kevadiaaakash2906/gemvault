import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, buildQuery, cleanSearch, fmtDate, num, parsePage, pickSort, usd } from "@/lib/ledger";
import { AMBER_AFTER_DAYS, RED_AFTER_DAYS, ageTone, daysWaiting, waitingLabel, type AgeTone } from "@/lib/reports";
import { Tile, TileEmpty } from "@/components/tiles";

export const metadata: Metadata = { title: "Who owes me" };
const SORTS = ["balance", "oldest", "buyer"] as const;
const TONE: Record<AgeTone, string> = { ok: "", amber: "font-medium text-amber-700", red: "font-semibold text-danger" };

export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<{ q?: string; show?: string; sort?: string; page?: string }> }) {
  await requirePermission("receivables.view");
  const sp = await searchParams;
  const q = cleanSearch(sp.q);
  const show = sp.show === "all" ? "all" : "owing";
  const sort = pickSort(sp.sort, SORTS, "balance");
  const page = parsePage(sp.page);
  const supabase = await createClient();

  let query = supabase.from("buyer_receivables").select("*", { count: "exact" });
  if (show === "owing") query = query.gt("balance_due", 0);
  for (const word of q.split(" ").filter(Boolean)) query = query.ilike("buyer", `%${word}%`);
  if (sort === "balance") query = query.order("balance_due", { ascending: false }).order("buyer");
  else if (sort === "oldest") query = query.order("oldest_unpaid_on", { ascending: true, nullsFirst: false }).order("buyer");
  else query = query.order("buyer");
  const from = (page - 1) * PAGE_SIZE;

  const [{ data: rows, count, error }, { data: totals }] = await Promise.all([
    query.range(from, from + PAGE_SIZE - 1),
    supabase.from("receivables_summary").select("*").maybeSingle(),
  ]);
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = { q: q || undefined, show: show === "all" ? "all" : undefined, sort: sort === "balance" ? undefined : sort };
  const longest = daysWaiting(totals?.oldest_unpaid_on);
  const cards = [
    { label: "Billed to buyers", value: usd.format(num(totals?.total_billed)) },
    { label: "Collected", value: usd.format(num(totals?.total_paid)) },
    { label: "Still owed to you", value: usd.format(num(totals?.balance_due)) },
    { label: "Buyers who owe you", value: String(num(totals?.buyers_owing)) },
    { label: "Longest wait", value: waitingLabel(longest) },
  ];
  const memosHref = (buyer: string) => `/dashboard/memos${buildQuery({ buyer })}`;
  const wait = (since: string | null) => {
    const d = daysWaiting(since);
    return <span className={TONE[ageTone(d)]}>{waitingLabel(d)}</span>;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-forest">Who owes me</h1>
        <p className="text-ink-soft">Each buyer&apos;s total billed, total paid and balance due, and how long their oldest unpaid bill has been waiting.</p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-md border border-gold-soft bg-white p-4"><dt className="text-sm text-ink-soft">{c.label}</dt><dd className="font-display text-2xl text-forest">{c.value}</dd></div>
        ))}
      </dl>

      <form method="get" className="grid gap-3 rounded-md border border-gold-soft bg-white p-4 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <div><label htmlFor="q" className="block text-sm font-medium">Search buyer</label><input id="q" name="q" defaultValue={q} className="mt-1 min-h-11 w-full rounded-md border border-gold-soft px-3" /></div>
        <div><label htmlFor="show" className="block text-sm font-medium">Show</label>
          <select id="show" name="show" defaultValue={show} className="mt-1 min-h-11 w-full rounded-md border border-gold-soft bg-white px-3"><option value="owing">Buyers who owe me</option><option value="all">All buyers</option></select></div>
        <div><label htmlFor="sort" className="block text-sm font-medium">Sort by</label>
          <select id="sort" name="sort" defaultValue={sort} className="mt-1 min-h-11 w-full rounded-md border border-gold-soft bg-white px-3"><option value="balance">Biggest balance</option><option value="oldest">Longest waiting</option><option value="buyer">Buyer name</option></select></div>
        <button className="min-h-11 self-end rounded-md bg-forest px-5 text-sm font-semibold text-ivory hover:bg-forest-deep">Apply</button>
      </form>
      {error && <p role="alert" className="rounded-md border border-danger/40 bg-red-50 p-3 text-danger">Could not load buyers. Please refresh the page.</p>}

      <div className="hidden overflow-x-auto rounded-md border border-gold-soft bg-white md:block">
        <table className="w-full min-w-[44rem] text-sm">
          <caption className="sr-only">Who owes me</caption>
          <thead className="bg-parchment"><tr className="text-left">
            <th scope="col" className="px-3 py-2 font-medium">Buyer</th><th scope="col" className="px-3 py-2 text-right font-medium">Total billed</th><th scope="col" className="px-3 py-2 text-right font-medium">Total paid</th><th scope="col" className="px-3 py-2 text-right font-medium">Balance due</th><th scope="col" className="px-3 py-2 font-medium">Oldest unpaid bill</th><th scope="col" className="px-3 py-2 font-medium">Waiting</th>
          </tr></thead>
          <tbody className="divide-y divide-gold-soft">
            {(rows ?? []).map((r) => (
              <tr key={r.buyer_id} className="hover:bg-ivory">
                <td className="px-3 py-2"><Link href={memosHref(r.buyer)} className="font-medium text-forest underline underline-offset-4">{r.buyer}</Link><p className="text-xs text-ink-soft">{r.open_memos} open {r.open_memos === 1 ? "memo" : "memos"} of {r.memos}</p></td>
                <td className="px-3 py-2 text-right">{usd.format(num(r.total_billed))}</td><td className="px-3 py-2 text-right">{usd.format(num(r.total_paid))}</td>
                <td className="px-3 py-2 text-right font-medium">{usd.format(num(r.balance_due))}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.oldest_unpaid_on)}</td><td className="px-3 py-2 whitespace-nowrap">{wait(r.oldest_unpaid_on)}</td>
              </tr>
            ))}
            {(rows ?? []).length === 0 && !error && <tr><td colSpan={6} className="px-3 py-10 text-center text-ink-soft">{show === "owing" && !q ? "Nobody owes you anything right now." : "No buyers match."}</td></tr>}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label="Who owes me">
        {(rows ?? []).map((r) => (
          <Tile key={r.buyer_id} title={r.buyer} subtitle={`${r.open_memos} open ${r.open_memos === 1 ? "memo" : "memos"}`}
            right={<><p className="font-medium">{usd.format(num(r.balance_due))}</p><p>{wait(r.oldest_unpaid_on)}</p></>}
            facts={[["Total billed", usd.format(num(r.total_billed))], ["Total paid", usd.format(num(r.total_paid))], ["Balance due", usd.format(num(r.balance_due))], ["Oldest unpaid bill", fmtDate(r.oldest_unpaid_on)], ["Waiting", wait(r.oldest_unpaid_on)], ["Memos", r.memos]]}
            href={memosHref(r.buyer)} hrefLabel="View memos and record payment" />
        ))}
        {(rows ?? []).length === 0 && !error && <TileEmpty>{show === "owing" && !q ? "Nobody owes you anything right now." : "No buyers match."}</TileEmpty>}
      </ul>

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm"><span className="text-ink-soft">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link className="min-h-11 rounded-md border border-gold-soft bg-white px-4 py-2.5" href={`/dashboard/receivables${buildQuery({ ...base, page: String(page - 1) })}`}>Previous</Link>}
            {page < pages && <Link className="min-h-11 rounded-md border border-gold-soft bg-white px-4 py-2.5" href={`/dashboard/receivables${buildQuery({ ...base, page: String(page + 1) })}`}>Next</Link>}
          </div></nav>
      )}
      <p className="text-sm text-ink-soft">Payments are recorded against a whole memo, so a part-paid memo counts as waiting from the date of its earliest sale. Amber: {AMBER_AFTER_DAYS}+ days. Red: {RED_AFTER_DAYS}+ days.</p>
    </div>
  );
}
