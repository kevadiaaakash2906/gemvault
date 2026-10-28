import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, buildQuery, cleanSearch, fmtDate, num, parsePage, usd } from "@/lib/ledger";
import { Tile, TileEmpty, type Fact } from "@/components/tiles";
import { KpiStrip, type Kpi } from "@/components/kpi";
import { signedUsd } from "@/lib/reports";

export const metadata: Metadata = { title: "Trading" };
const STATUSES = ["Not Sold", "Unpaid", "Partial", "Paid"];
type SP = { q?: string; status?: string; page?: string };

export default async function TradingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requirePermission("trades.view");
  const sp = await searchParams;
  const owner = can(session.role, "costs.view");
  const q = cleanSearch(sp.q);
  const page = parsePage(sp.page);
  const status = STATUSES.includes(sp.status ?? "") ? sp.status : undefined;
  const supabase = await createClient();
  const kpiRequest = Promise.resolve(supabase.from("trades_kpi").select("*").maybeSingle());   // starts now, so it runs alongside the list

  let query = supabase.from("trade_overview").select("*", { count: "exact" });
  if (status) query = query.eq("payment_status", status);
  if (q) query = query.or(`item.ilike.%${q}%,sold_to.ilike.%${q}%,memo_no.ilike.%${q}%,notes.ilike.%${q}%`);
  const from = (page - 1) * PAGE_SIZE;
  const { data: rows, count, error } = await query.order("sr_no", { ascending: false }).range(from, from + PAGE_SIZE - 1);

  const costs = new Map<string, { vendor: string | null; purchase_price: number }>();
  if (owner && rows?.length) {
    const { data } = await supabase.from("trade_costs").select("*").in("trade_id", rows.map((r) => r.id));
    (data ?? []).forEach((c) => costs.set(c.trade_id, c));
  }
  const { data: k } = await kpiRequest;
  const cards: Kpi[] = !k ? [] : owner ? [
    { label: "Total trades", value: String(num(k.total_trades)), sub: "buy & sell records" },
    { label: "Total invested", value: usd.format(num(k.invested)), sub: "capital deployed" },
    { label: "Total sales", value: usd.format(num(k.sales)), sub: "revenue from sold items" },
    { label: "Net P/L", value: signedUsd(num(k.net_pl)), sub: "closed trades only", tone: num(k.net_pl) < 0 ? "bad" : "good" },
    { label: "Collected", value: usd.format(num(k.collected)), sub: "payments received" },
    { label: "Outstanding", value: usd.format(num(k.outstanding)), sub: "balance due across all", tone: "warn" },
  ] : [
    { label: "Total trades", value: String(num(k.total_trades)), sub: "buy & sell records" },
    { label: "Total sales", value: usd.format(num(k.sales)), sub: "revenue from sold items" },
    { label: "Collected", value: usd.format(num(k.collected)), sub: "payments received" },
    { label: "Outstanding", value: usd.format(num(k.outstanding)), sub: "balance due across all", tone: "warn" },
  ];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = { q: q || undefined, status };
  const badge = (s: string) => {
    const c = s === "Paid" ? "bg-emerald-100 text-emerald-900" : s === "Partial" ? "bg-amber-100 text-amber-900" : s === "Unpaid" ? "bg-red-100 text-red-900" : "bg-parchment text-ink-soft";
    return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${c}`}>{s}</span>;
  };
  const h = (label: string, right?: boolean) => <th key={label} scope="col" className={`px-2 py-2 font-medium whitespace-nowrap ${right ? "text-right" : "text-left"}`}>{label}</th>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-3xl text-forest">Trading</h1><p className="text-ink-soft">{total} {total === 1 ? "item" : "items"}</p></div>
        <div className="flex gap-2">
          <a href="/dashboard/export?sheet=trading" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-gold-soft bg-white px-4 text-sm font-semibold hover:bg-parchment"><Download className="size-4" aria-hidden /> Export CSV</a>
          {can(session.role, "trades.edit") && <Link href="/dashboard/trading/new" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-forest px-4 text-sm font-semibold text-ivory hover:bg-forest-deep"><Plus className="size-4" aria-hidden /> Add item</Link>}
        </div>
      </div>
      {cards.length > 0 && <KpiStrip cards={cards} label="Trading summary" />}
      <form method="get" className="grid gap-3 rounded-md border border-gold-soft bg-white p-4 sm:grid-cols-[2fr_1fr_auto]">
        <div><label htmlFor="q" className="block text-sm font-medium">Search</label><input id="q" name="q" defaultValue={q} placeholder="Item, sold to, memo, notes" className="mt-1 min-h-11 w-full rounded-md border border-gold-soft px-3" /></div>
        <div><label htmlFor="status" className="block text-sm font-medium">Payment status</label>
          <select id="status" name="status" defaultValue={status ?? ""} className="mt-1 min-h-11 w-full rounded-md border border-gold-soft bg-white px-3"><option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <button className="min-h-11 self-end rounded-md bg-forest px-5 text-sm font-semibold text-ivory hover:bg-forest-deep">Apply</button>
      </form>
      {error && <p role="alert" className="rounded-md border border-danger/40 bg-red-50 p-3 text-danger">Could not load trades. Please refresh the page.</p>}
      <div className="hidden overflow-x-auto rounded-md border border-gold-soft bg-white lg:block">
        <table className="w-full text-xs">
          <caption className="sr-only">Trading</caption>
          <thead className="bg-parchment"><tr>
            {h("Sr. No.")}{h("Date")}{h("Item")}{owner && <>{h("Vendor")}{h("Purchase Price", true)}</>}{h("Sale Price", true)}{h("Date Sold")}{h("Sold To")}{h("Memo")}{h("Memo Paid", true)}{h("Memo Balance", true)}{h("Payment Status")}{owner && h("Profit/Loss", true)}{h("Notes")}
          </tr></thead>
          <tbody className="divide-y divide-gold-soft">
            {(rows ?? []).map((r) => {
              const c = costs.get(r.id);
              const profit = c && r.sale_price !== null ? num(r.sale_price) - num(c.purchase_price) : null;
              return (
                <tr key={r.id} className="hover:bg-ivory">
                  <td className="px-2 py-2"><Link href={`/dashboard/trading/${r.id}`} className="font-medium text-forest underline underline-offset-4">{r.sr_no}</Link></td>
                  <td className="px-2 py-2 whitespace-nowrap">{fmtDate(r.trade_date)}</td>
                  <td className="px-2 py-2">{r.item}</td>
                  {owner && <><td className="px-2 py-2">{c?.vendor ?? "—"}</td><td className="px-2 py-2 text-right">{c ? usd.format(num(c.purchase_price)) : "—"}</td></>}
                  <td className="px-2 py-2 text-right">{r.sale_price !== null ? usd.format(num(r.sale_price)) : "—"}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{fmtDate(r.date_sold)}</td>
                  <td className="px-2 py-2">{r.sold_to ?? "—"}</td>
                  <td className="px-2 py-2">{r.memo_id ? <Link href={`/dashboard/memos/${r.memo_id}`} className="underline underline-offset-4">{r.memo_no}</Link> : "—"}</td>
                  <td className="px-2 py-2 text-right">{r.memo_paid !== null ? usd.format(num(r.memo_paid)) : "—"}</td>
                  <td className="px-2 py-2 text-right">{r.memo_balance !== null ? usd.format(num(r.memo_balance)) : "—"}</td>
                  <td className="px-2 py-2">{badge(r.payment_status)}</td>
                  {owner && <td className={`px-2 py-2 text-right ${profit !== null && profit < 0 ? "text-danger" : ""}`}>{profit !== null ? usd.format(profit) : "—"}</td>}
                  <td className="px-2 py-2">{r.notes ?? ""}</td>
                </tr>
              );
            })}
            {(rows ?? []).length === 0 && !error && <tr><td colSpan={owner ? 14 : 10} className="px-3 py-10 text-center text-ink-soft">No items yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 lg:hidden" aria-label="Trading items">
        {(rows ?? []).map((r) => {
          const c = costs.get(r.id);
          const profit = c && r.sale_price !== null ? num(r.sale_price) - num(c.purchase_price) : null;
          const facts: Fact[] = [["Date", fmtDate(r.trade_date)]];
          if (owner) facts.push(["Vendor", c?.vendor ?? "—"], ["Purchase Price", c ? usd.format(num(c.purchase_price)) : "—"], ["Profit/Loss", profit !== null ? usd.format(profit) : "—"]);
          facts.push(
            ["Date Sold", fmtDate(r.date_sold)], ["Sold To", r.sold_to ?? "—"],
            ["Memo", r.memo_id ? <Link key="m" href={`/dashboard/memos/${r.memo_id}`} className="underline underline-offset-4">{r.memo_no}</Link> : "—"],
            ["Memo Paid", r.memo_paid !== null ? usd.format(num(r.memo_paid)) : "—"], ["Memo Balance", r.memo_balance !== null ? usd.format(num(r.memo_balance)) : "—"],
            ["Notes", r.notes ?? "—"],
          );
          return (
            <Tile key={r.id} title={`#${r.sr_no} · ${r.item}`} subtitle={fmtDate(r.trade_date)}
              right={<><p className="font-medium">{r.sale_price !== null ? usd.format(num(r.sale_price)) : "Not sold"}</p>{badge(r.payment_status)}</>}
              facts={facts} href={`/dashboard/trading/${r.id}`} hrefLabel="Open / edit" />
          );
        })}
        {(rows ?? []).length === 0 && !error && <TileEmpty>No items yet.</TileEmpty>}
      </ul>
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm"><span className="text-ink-soft">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link className="min-h-11 rounded-md border border-gold-soft bg-white px-4 py-2.5" href={`/dashboard/trading${buildQuery({ ...base, page: String(page - 1) })}`}>Previous</Link>}
            {page < pages && <Link className="min-h-11 rounded-md border border-gold-soft bg-white px-4 py-2.5" href={`/dashboard/trading${buildQuery({ ...base, page: String(page + 1) })}`}>Next</Link>}
          </div></nav>
      )}
    </div>
  );
}
