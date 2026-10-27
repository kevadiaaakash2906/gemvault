import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, buildQuery, cleanSearch, fmtDate, num, parsePage, pickSort, usd } from "@/lib/ledger";
import { fmtPct, marginPct, monthLabel } from "@/lib/reports";
import { Tile, TileEmpty } from "@/components/tiles";

export const metadata: Metadata = { title: "Profit" };
const VIEWS = ["piece", "month", "buyer"] as const;
const VIEW_LABEL = { piece: "Per piece", month: "By month", buyer: "By buyer" } as const;
type SP = { view?: string; q?: string; kind?: string; missing?: string; page?: string };

const money = (n: number) => <span className={n < 0 ? "text-danger" : ""}>{usd.format(n)}</span>;
const th = (label: string, right?: boolean) => <th key={label} scope="col" className={`px-3 py-2 font-medium whitespace-nowrap ${right ? "text-right" : "text-left"}`}>{label}</th>;
const pageLink = "min-h-11 rounded-md border border-gold-soft bg-white px-4 py-2.5";

export default async function ProfitPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePermission("reports.profit");
  const sp = await searchParams;
  const view = pickSort(sp.view, VIEWS, "piece");
  const q = cleanSearch(sp.q);
  const kind = sp.kind === "Order" || sp.kind === "Trade" ? sp.kind : undefined;
  const missing = sp.missing === "1";
  const page = parsePage(sp.page);
  const supabase = await createClient();

  // Everything this page needs is asked for at the same time, so you wait for ONE database round trip, not two.
  const from = (page - 1) * PAGE_SIZE;
  let pieceQuery = null;
  if (view === "piece") {
    let query = supabase.from("piece_profit").select("*", { count: "exact" });
    if (kind) query = query.eq("kind", kind);
    if (missing) query = query.eq("cost_known", false);
    if (q) query = query.or(`label.ilike.%${q}%,buyer.ilike.%${q}%,memo_no.ilike.%${q}%`);
    pieceQuery = query.order("date_sold", { ascending: false, nullsFirst: false }).order("sr_no", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  }
  const buyerQuery = view === "buyer" ? supabase.from("buyer_profit").select("*").order("profit", { ascending: false }).order("buyer") : null;
  // Month totals feed the summary cards on every tab.
  const [{ data: monthRows, error: monthError }, pieceRes, buyerRes] = await Promise.all([
    supabase.from("monthly_profit").select("*").order("month", { ascending: false, nullsFirst: false }),
    pieceQuery,
    buyerQuery,
  ]);
  const months = monthRows ?? [];
  const sum = (k: string) => months.reduce((n, m) => n + num((m as Record<string, unknown>)[k]), 0);
  const orderProfit = sum("order_profit");
  const tradeProfit = sum("trade_profit");
  const expenses = sum("expenses");
  const net = orderProfit + tradeProfit - expenses;
  const noCost = sum("no_cost_pieces");
  const cards = [
    { label: "Sales", value: usd.format(sum("sales")), tone: "" },
    { label: "Order profit", value: usd.format(orderProfit), tone: orderProfit < 0 ? "text-danger" : "" },
    { label: "Trading profit", value: usd.format(tradeProfit), tone: tradeProfit < 0 ? "text-danger" : "" },
    { label: "Expenses", value: usd.format(expenses), tone: "" },
    { label: "Net profit", value: usd.format(net), tone: net < 0 ? "text-danger" : "" },
    { label: "Margin on costed sales", value: fmtPct(marginPct(orderProfit + tradeProfit, sum("costed_sales"))), tone: "" },
  ];

  const pieces: Record<string, unknown>[] = pieceRes?.data ?? [];
  const buyers: Record<string, unknown>[] = buyerRes?.data ?? [];
  const pieceCount = pieceRes?.count ?? 0;
  const viewError = !!(pieceRes?.error || buyerRes?.error);
  const pages = Math.max(1, Math.ceil(pieceCount / PAGE_SIZE));
  const base = { view, q: q || undefined, kind, missing: missing ? "1" : undefined };
  const costMissing = <span className="font-medium text-amber-700">Cost missing</span>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-forest">Profit</h1>
        <p className="text-ink-soft">Owner only. All figures in US dollars. Profit is counted when a piece is sold, whether or not it has been paid for yet.</p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-md border border-gold-soft bg-white p-4"><dt className="text-sm text-ink-soft">{c.label}</dt><dd className={clsx("font-display text-3xl text-forest", c.tone)}>{c.value}</dd></div>
        ))}
      </dl>
      {noCost > 0 && (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {noCost} sold {noCost === 1 ? "piece has" : "pieces have"} no cost on file ({usd.format(sum("no_cost_sales"))} of sales). {noCost === 1 ? "It is" : "They are"} left out of profit until a cost is entered.{" "}
          <Link href={`/dashboard/profit${buildQuery({ view: "piece", missing: "1" })}`} className="font-medium underline underline-offset-4">Show them</Link>
        </p>
      )}
      {(monthError || viewError) && <p role="alert" className="rounded-md border border-danger/40 bg-red-50 p-3 text-danger">Could not load the report. Please refresh the page.</p>}

      <nav aria-label="Report view" className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link key={v} href={`/dashboard/profit${buildQuery({ view: v })}`} aria-current={v === view ? "page" : undefined}
            className={clsx("inline-flex min-h-11 items-center rounded-md px-4 text-sm font-semibold", v === view ? "bg-forest text-ivory" : "border border-gold-soft bg-white hover:bg-parchment")}>{VIEW_LABEL[v]}</Link>
        ))}
      </nav>

      {view === "piece" && (
        <>
          <form method="get" className="grid gap-3 rounded-md border border-gold-soft bg-white p-4 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <input type="hidden" name="view" value="piece" />
            <div><label htmlFor="q" className="block text-sm font-medium">Search</label><input id="q" name="q" defaultValue={q} placeholder="Style, item, buyer or memo" className="mt-1 min-h-11 w-full rounded-md border border-gold-soft px-3" /></div>
            <div><label htmlFor="kind" className="block text-sm font-medium">Type</label>
              <select id="kind" name="kind" defaultValue={kind ?? ""} className="mt-1 min-h-11 w-full rounded-md border border-gold-soft bg-white px-3"><option value="">Orders and trades</option><option value="Order">Orders</option><option value="Trade">Trades</option></select></div>
            <div><label htmlFor="missing" className="block text-sm font-medium">Cost</label>
              <select id="missing" name="missing" defaultValue={missing ? "1" : ""} className="mt-1 min-h-11 w-full rounded-md border border-gold-soft bg-white px-3"><option value="">All sold pieces</option><option value="1">Cost missing</option></select></div>
            <button className="min-h-11 self-end rounded-md bg-forest px-5 text-sm font-semibold text-ivory hover:bg-forest-deep">Apply</button>
          </form>
          <p className="text-sm text-ink-soft">{pieceCount} sold {pieceCount === 1 ? "piece" : "pieces"}. Profit = sale price minus cost.</p>
          <div className="hidden overflow-x-auto rounded-md border border-gold-soft bg-white md:block">
            <table className="w-full min-w-[56rem] text-sm">
              <caption className="sr-only">Profit per piece</caption>
              <thead className="bg-parchment"><tr>{th("Type")}{th("Sr. No.")}{th("Style / item")}{th("Sold to")}{th("Memo")}{th("Date sold")}{th("Sale price", true)}{th("Cost", true)}{th("Profit", true)}{th("Margin", true)}</tr></thead>
              <tbody className="divide-y divide-gold-soft">
                {pieces.map((p) => {
                  const known = p.cost_known === true;
                  const href = `/dashboard/${p.kind === "Order" ? "orders" : "trading"}/${p.piece_id}`;
                  return (
                    <tr key={`${p.kind}-${p.piece_id}`} className="hover:bg-ivory">
                      <td className="px-3 py-2">{String(p.kind)}</td>
                      <td className="px-3 py-2"><Link href={href} className="font-medium text-forest underline underline-offset-4">{String(p.sr_no)}</Link></td>
                      <td className="px-3 py-2">{String(p.label)}</td><td className="px-3 py-2">{String(p.buyer)}</td><td className="px-3 py-2">{String(p.memo_no)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(p.date_sold as string | null)}</td>
                      <td className="px-3 py-2 text-right">{usd.format(num(p.sale_price))}</td>
                      <td className="px-3 py-2 text-right">{known ? usd.format(num(p.cost)) : "—"}</td>
                      <td className="px-3 py-2 text-right font-medium">{known ? money(num(p.profit)) : costMissing}</td>
                      <td className="px-3 py-2 text-right">{known ? fmtPct(marginPct(num(p.profit), num(p.sale_price))) : "—"}</td>
                    </tr>
                  );
                })}
                {pieces.length === 0 && !viewError && <tr><td colSpan={10} className="px-3 py-10 text-center text-ink-soft">No sold pieces match.</td></tr>}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 md:hidden" aria-label="Profit per piece">
            {pieces.map((p) => {
              const known = p.cost_known === true;
              return (
                <Tile key={`${p.kind}-${p.piece_id}`} title={`${p.kind} #${p.sr_no} · ${p.label}`} subtitle={String(p.buyer)}
                  right={<p className="font-medium">{known ? money(num(p.profit)) : costMissing}</p>}
                  facts={[["Sold to", String(p.buyer)], ["Memo", String(p.memo_no)], ["Date sold", fmtDate(p.date_sold as string | null)], ["Sale price", usd.format(num(p.sale_price))], ["Cost", known ? usd.format(num(p.cost)) : "—"], ["Margin", known ? fmtPct(marginPct(num(p.profit), num(p.sale_price))) : "—"]]}
                  href={`/dashboard/${p.kind === "Order" ? "orders" : "trading"}/${p.piece_id}`} hrefLabel="Open / edit" />
              );
            })}
            {pieces.length === 0 && !viewError && <TileEmpty>No sold pieces match.</TileEmpty>}
          </ul>
          {pages > 1 && (
            <nav aria-label="Pages" className="flex items-center justify-between text-sm"><span className="text-ink-soft">Page {page} of {pages}</span>
              <div className="flex gap-2">
                {page > 1 && <Link className={pageLink} href={`/dashboard/profit${buildQuery({ ...base, page: String(page - 1) })}`}>Previous</Link>}
                {page < pages && <Link className={pageLink} href={`/dashboard/profit${buildQuery({ ...base, page: String(page + 1) })}`}>Next</Link>}
              </div></nav>
          )}
        </>
      )}

      {view === "month" && (
        <>
          <div className="hidden overflow-x-auto rounded-md border border-gold-soft bg-white md:block">
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">Profit by month</caption>
              <thead className="bg-parchment"><tr>{th("Month")}{th("Pieces sold", true)}{th("Sales", true)}{th("Order profit", true)}{th("Trading profit", true)}{th("Expenses", true)}{th("Net profit", true)}</tr></thead>
              <tbody className="divide-y divide-gold-soft">
                {months.map((m) => (
                  <tr key={String(m.month)} className="hover:bg-ivory">
                    <td className="px-3 py-2 font-medium">{monthLabel(m.month)}{num(m.no_cost_pieces) > 0 && <span className="ml-2 text-xs font-normal text-amber-700">{num(m.no_cost_pieces)} without cost</span>}</td>
                    <td className="px-3 py-2 text-right">{num(m.pieces_sold)}</td><td className="px-3 py-2 text-right">{usd.format(num(m.sales))}</td>
                    <td className="px-3 py-2 text-right">{money(num(m.order_profit))}</td><td className="px-3 py-2 text-right">{money(num(m.trade_profit))}</td>
                    <td className="px-3 py-2 text-right">{usd.format(num(m.expenses))}</td><td className="px-3 py-2 text-right font-medium">{money(num(m.net_profit))}</td>
                  </tr>
                ))}
                {months.length === 0 && !monthError && <tr><td colSpan={7} className="px-3 py-10 text-center text-ink-soft">No sales or expenses yet.</td></tr>}
              </tbody>
              {months.length > 0 && (
                <tfoot className="border-t-2 border-gold-soft bg-parchment font-medium"><tr>
                  <td className="px-3 py-2">Total</td><td className="px-3 py-2 text-right">{sum("pieces_sold")}</td><td className="px-3 py-2 text-right">{usd.format(sum("sales"))}</td>
                  <td className="px-3 py-2 text-right">{money(orderProfit)}</td><td className="px-3 py-2 text-right">{money(tradeProfit)}</td><td className="px-3 py-2 text-right">{usd.format(expenses)}</td><td className="px-3 py-2 text-right">{money(net)}</td>
                </tr></tfoot>
              )}
            </table>
          </div>
          <ul className="space-y-3 md:hidden" aria-label="Profit by month">
            {months.map((m) => (
              <Tile key={String(m.month)} title={monthLabel(m.month)} subtitle={`${num(m.pieces_sold)} pieces sold`}
                right={<><p className="font-medium">{money(num(m.net_profit))}</p><p className="text-ink-soft">net</p></>}
                facts={[["Sales", usd.format(num(m.sales))], ["Order profit", money(num(m.order_profit))], ["Trading profit", money(num(m.trade_profit))], ["Expenses", usd.format(num(m.expenses))], ["Net profit", money(num(m.net_profit))], ["Without cost", num(m.no_cost_pieces)]]} />
            ))}
            {months.length === 0 && !monthError && <TileEmpty>No sales or expenses yet.</TileEmpty>}
          </ul>
          <p className="text-sm text-ink-soft">Sales and profit fall in the month of Date Sold; expenses in the month of their date. Net profit = order profit + trading profit − expenses.</p>
        </>
      )}

      {view === "buyer" && (
        <>
          <div className="hidden overflow-x-auto rounded-md border border-gold-soft bg-white md:block">
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">Profit by buyer</caption>
              <thead className="bg-parchment"><tr>{th("Buyer")}{th("Pieces sold", true)}{th("Sales", true)}{th("Order profit", true)}{th("Trading profit", true)}{th("Total profit", true)}{th("Margin", true)}</tr></thead>
              <tbody className="divide-y divide-gold-soft">
                {buyers.map((b) => (
                  <tr key={String(b.buyer_id)} className="hover:bg-ivory">
                    <td className="px-3 py-2 font-medium">{String(b.buyer)}{num(b.no_cost_pieces) > 0 && <span className="ml-2 text-xs font-normal text-amber-700">{num(b.no_cost_pieces)} without cost</span>}</td>
                    <td className="px-3 py-2 text-right">{num(b.pieces_sold)}</td><td className="px-3 py-2 text-right">{usd.format(num(b.sales))}</td>
                    <td className="px-3 py-2 text-right">{money(num(b.order_profit))}</td><td className="px-3 py-2 text-right">{money(num(b.trade_profit))}</td>
                    <td className="px-3 py-2 text-right font-medium">{money(num(b.profit))}</td><td className="px-3 py-2 text-right">{fmtPct(marginPct(num(b.profit), num(b.costed_sales)))}</td>
                  </tr>
                ))}
                {buyers.length === 0 && !viewError && <tr><td colSpan={7} className="px-3 py-10 text-center text-ink-soft">No sales yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 md:hidden" aria-label="Profit by buyer">
            {buyers.map((b) => (
              <Tile key={String(b.buyer_id)} title={String(b.buyer)} subtitle={`${num(b.pieces_sold)} pieces sold`}
                right={<p className="font-medium">{money(num(b.profit))}</p>}
                facts={[["Sales", usd.format(num(b.sales))], ["Order profit", money(num(b.order_profit))], ["Trading profit", money(num(b.trade_profit))], ["Total profit", money(num(b.profit))], ["Margin", fmtPct(marginPct(num(b.profit), num(b.costed_sales)))], ["Without cost", num(b.no_cost_pieces)]]} />
            ))}
            {buyers.length === 0 && !viewError && <TileEmpty>No sales yet.</TileEmpty>}
          </ul>
          <p className="text-sm text-ink-soft">Expenses are not tied to a buyer, so they appear only in the cards above and the month totals. Margin = profit ÷ sales of pieces that have a cost.</p>
        </>
      )}
    </div>
  );
}
