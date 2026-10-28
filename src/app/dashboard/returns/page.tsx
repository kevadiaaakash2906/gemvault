import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, buildQuery, cleanSearch, fmtDate, num, parsePage, usd } from "@/lib/ledger";
import { KpiStrip } from "@/components/kpi";
import { Notice } from "@/components/ui";
import { Tile, TileEmpty } from "@/components/tiles";

export const metadata: Metadata = { title: "Returns" };

export default async function ReturnsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; done?: string }> }) {
  await requirePermission("returns.view");
  const sp = await searchParams;
  const q = cleanSearch(sp.q);
  const page = parsePage(sp.page);
  const done = /^[0-9a-f-]{36}$/i.test(sp.done ?? "") ? sp.done : undefined;
  const supabase = await createClient();

  let query = supabase.from("returns").select("*", { count: "exact" });
  if (q) query = query.or(`label.ilike.%${q}%,buyer.ilike.%${q}%,memo_no.ilike.%${q}%,reason.ilike.%${q}%`);
  const from = (page - 1) * PAGE_SIZE;
  const [{ data: rows, count, error }, { data: totals }, { data: just }] = await Promise.all([
    query.order("returned_on", { ascending: false }).order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1),
    supabase.from("returns_summary").select("*").maybeSingle(),
    done ? supabase.from("returns").select("label,buyer,refund").eq("id", done).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = { q: q || undefined };
  const cards = [
    { label: "Pieces returned", value: String(num(totals?.returns)), sub: "all time" },
    { label: "Sales reversed", value: usd.format(num(totals?.sales_reversed)), sub: "taken out of sales and profit" },
    { label: "Refunds given", value: usd.format(num(totals?.refunds)), sub: "money handed back to buyers", tone: num(totals?.refunds) > 0 ? ("warn" as const) : undefined },
  ];
  const href = (r: { kind: string; piece_id: string }) => `/dashboard/${r.kind === "order" ? "orders" : "trading"}/${r.piece_id}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-forest">Returns</h1>
        <p className="text-ink-soft">Pieces that came back after being sold. To record a return, open the piece and choose Return this piece.</p>
      </div>
      {just && (
        <Notice tone="success">
          Return recorded: {just.label} from {just.buyer}. {num(just.refund) > 0 ? `Hand back ${usd.format(num(just.refund))} to the buyer.` : "No refund is due."}
        </Notice>
      )}
      <KpiStrip cards={cards} label="Returns summary" />

      <form method="get" className="grid gap-3 rounded-md border border-gold-soft bg-white p-4 sm:grid-cols-[1fr_auto]">
        <div><label htmlFor="q" className="block text-sm font-medium">Search</label><input id="q" name="q" defaultValue={q} placeholder="Style, item, buyer, memo or reason" className="mt-1 min-h-11 w-full rounded-md border border-gold-soft px-3" /></div>
        <button className="min-h-11 self-end rounded-md bg-forest px-5 text-sm font-semibold text-ivory hover:bg-forest-deep">Search</button>
      </form>
      {error && <p role="alert" className="rounded-md border border-danger/40 bg-red-50 p-3 text-danger">Could not load returns. Please refresh the page.</p>}

      <div className="hidden overflow-x-auto rounded-md border border-gold-soft bg-white md:block">
        <table className="w-full min-w-[52rem] text-sm">
          <caption className="sr-only">Returns</caption>
          <thead className="bg-parchment"><tr className="text-left">
            <th scope="col" className="px-3 py-2 font-medium">Returned</th><th scope="col" className="px-3 py-2 font-medium">Piece</th><th scope="col" className="px-3 py-2 font-medium">Buyer</th><th scope="col" className="px-3 py-2 font-medium">Memo</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Sale price</th><th scope="col" className="px-3 py-2 text-right font-medium">Refund</th><th scope="col" className="px-3 py-2 font-medium">Reason</th>
          </tr></thead>
          <tbody className="divide-y divide-gold-soft">
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="align-top hover:bg-ivory">
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.returned_on)}</td>
                <td className="px-3 py-2"><Link href={href(r)} className="font-medium text-forest underline underline-offset-4">{r.label}</Link><p className="text-xs text-ink-soft">{r.kind === "order" ? "Order" : "Trade"} #{r.sr_no}</p></td>
                <td className="px-3 py-2">{r.buyer}</td><td className="px-3 py-2">{r.memo_no}</td>
                <td className="px-3 py-2 text-right">{usd.format(num(r.sale_price))}</td>
                <td className="px-3 py-2 text-right">{num(r.refund) > 0 ? usd.format(num(r.refund)) : "—"}</td>
                <td className="px-3 py-2">{r.reason}</td>
              </tr>
            ))}
            {(rows ?? []).length === 0 && !error && <tr><td colSpan={7} className="px-3 py-10 text-center text-ink-soft">{q ? "No returns match." : "No returns yet."}</td></tr>}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label="Returns">
        {(rows ?? []).map((r) => (
          <Tile key={r.id} title={`${r.label} · ${r.buyer}`} subtitle={`${r.kind === "order" ? "Order" : "Trade"} #${r.sr_no} · returned ${fmtDate(r.returned_on)}`}
            right={<p className="font-medium">{usd.format(num(r.sale_price))}</p>}
            facts={[["Buyer", r.buyer], ["Memo", r.memo_no], ["Sold on", fmtDate(r.date_sold)], ["Returned", fmtDate(r.returned_on)], ["Sale price", usd.format(num(r.sale_price))], ["Refund", num(r.refund) > 0 ? usd.format(num(r.refund)) : "—"], ["Reason", r.reason]]}
            href={href(r)} hrefLabel="Open piece" />
        ))}
        {(rows ?? []).length === 0 && !error && <TileEmpty>{q ? "No returns match." : "No returns yet."}</TileEmpty>}
      </ul>

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm"><span className="text-ink-soft">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link className="min-h-11 rounded-md border border-gold-soft bg-white px-4 py-2.5" href={`/dashboard/returns${buildQuery({ ...base, page: String(page - 1) })}`}>Previous</Link>}
            {page < pages && <Link className="min-h-11 rounded-md border border-gold-soft bg-white px-4 py-2.5" href={`/dashboard/returns${buildQuery({ ...base, page: String(page + 1) })}`}>Next</Link>}
          </div></nav>
      )}
    </div>
  );
}
