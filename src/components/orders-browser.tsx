"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowDown, ArrowUp } from "lucide-react";
import { PAGE_SIZE, buildQuery, fmtDate, inr, num, usd } from "@/lib/ledger";
import { matchCt, matchText } from "@/lib/order-search";
import { pageWindow } from "@/lib/pagination";
import { Tile, TileEmpty, type Fact } from "@/components/tiles";

export type OrderRow = {
  id: string; sr_no: number; customer: string | null; style_no: string; jewelry_type: string | null; diamond_shape: string | null;
  order_date: string | null; gross_wt: number | null; dia_qty: number | null; in_ct: number | null; colour_stone: number | null;
  net_wt: number | null; multiplier: number | null; pg_wt: number | null; sold_to: string | null; sale_price: number | null;
  date_sold: string | null; memo_id: string | null; memo_no: string | null; memo_paid: number | null; memo_balance: number | null;
  payment_status: string; style_thumb_path: string | null;
};
export type CostRow = Record<string, number>;
export type SortKey = "sr_no" | "order_date" | "style_no" | "in_ct" | "sale_price" | "date_sold";
export type Dir = "asc" | "desc";
export type Initial = { q: string; ct: string; status: string; type: string; sort: SortKey; dir: Dir; page: number };

const STATUSES = ["Not Sold", "Unpaid", "Partial", "Paid"];
const HEAD = "sticky top-0 z-20 bg-parchment";
const HEAD_FIRST = "sticky left-0 top-0 z-30 bg-parchment shadow-[1px_0_0_var(--color-gold-soft)]";
const CELL_FIRST = "sticky left-0 z-10 bg-white shadow-[1px_0_0_var(--color-gold-soft)] group-hover:bg-ivory";
const input = "mt-1 min-h-11 w-full rounded-md border border-gold-soft bg-white px-3";
const box = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border px-3 text-sm";

const badge = (s: string) => {
  const c = s === "Paid" ? "bg-emerald-100 text-emerald-900" : s === "Partial" ? "bg-amber-100 text-amber-900" : s === "Unpaid" ? "bg-red-100 text-red-900" : "bg-parchment text-ink-soft";
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${c}`}>{s}</span>;
};

/** The Orders list. All orders are loaded once; search, filters, sorting and paging happen here in the browser, so they are instant. */
export function OrdersBrowser({ rows, costs, thumbs, owner, initial }: {
  rows: OrderRow[]; costs: Record<string, CostRow>; thumbs: Record<string, string>; owner: boolean; initial: Initial;
}) {
  const [q, setQ] = useState(initial.q);
  const [ct, setCt] = useState(initial.ct);
  const [status, setStatus] = useState(initial.status);
  const [type, setType] = useState(initial.type);
  const [sort, setSort] = useState<SortKey>(initial.sort);
  const [dir, setDir] = useState<Dir>(initial.dir);
  const [page, setPage] = useState(initial.page);

  const types = useMemo(() => [...new Set(rows.map((r) => r.jewelry_type).filter((t): t is string => !!t))].sort(), [rows]);

  const filtered = useMemo(() => {
    const list = rows.filter((r) =>
      (!status || r.payment_status === status) &&
      (!type || r.jewelry_type === type) &&
      matchCt(r.in_ct === null ? null : num(r.in_ct), ct) &&
      matchText([r.style_no, r.customer, r.sold_to, r.memo_no], q));
    const sign = dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const x = a[sort], y = b[sort];
      if (x === null && y === null) return 0;
      if (x === null) return 1;     // empty values always go last
      if (y === null) return -1;
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return c * sign;
    });
  }, [rows, q, ct, status, type, sort, dir]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const anyFilter = !!(q || ct || status || type);

  // Keep the address bar in step (no server call), so a refresh or a shared link shows the same view.
  useEffect(() => {
    const defaultDir: Dir = sort === "sr_no" ? "desc" : "asc";
    const qs = buildQuery({
      q: q.trim() || undefined, ct: ct.trim() || undefined, status: status || undefined, type: type || undefined,
      sort: sort !== "sr_no" ? sort : undefined, dir: dir !== defaultDir ? dir : undefined, page: current > 1 ? String(current) : undefined,
    });
    window.history.replaceState(null, "", `/dashboard/orders${qs}`);
  }, [q, ct, status, type, sort, dir, current]);

  const change = (fn: () => void) => { fn(); setPage(1); };
  const toggle = (k: SortKey) => { if (sort === k && dir === "asc") setDir("desc"); else { setSort(k); setDir("asc"); } setPage(1); };
  const clear = () => change(() => { setQ(""); setCt(""); setStatus(""); setType(""); });

  const sortTh = (k: SortKey, label: string, right?: boolean) => (
    <th key={k} data-col={k} scope="col" aria-sort={sort === k ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={`px-2 py-1.5 font-medium whitespace-nowrap ${k === "sr_no" ? HEAD_FIRST : HEAD} ${right ? "text-right" : "text-left"}`}>
      <button type="button" onClick={() => toggle(k)} className="inline-flex items-center gap-1 hover:text-gold-deep">
        {label}
        {sort === k && (dir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
      </button>
    </th>
  );
  const plain = (key: string, label: string, right?: boolean) => <th key={key} data-col={key} scope="col" className={`px-2 py-1.5 font-medium whitespace-nowrap ${HEAD} ${right ? "text-right" : "text-left"}`}>{label}</th>;

  const step = (symbol: string, label: string, n: number, enabled: boolean) => (
    <button type="button" disabled={!enabled} onClick={() => setPage(n)} className={clsx(box, "border-gold-soft bg-white hover:bg-parchment disabled:opacity-40 disabled:hover:bg-white")}>
      <span aria-hidden>{symbol}</span><span className="sr-only">{label}</span>
    </button>
  );

  return (
    <>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="grid gap-3 rounded-md border border-gold-soft bg-white p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <div><label htmlFor="q" className="block text-sm font-medium">Search</label>
          <input id="q" value={q} autoComplete="off" placeholder="Style no, customer, sold to, memo" onChange={(e) => change(() => setQ(e.target.value))} className={input} /></div>
        <div><label htmlFor="ct" className="block text-sm font-medium">IN CT</label>
          <input id="ct" value={ct} autoComplete="off" inputMode="decimal" placeholder="5.15 or 3-5" onChange={(e) => change(() => setCt(e.target.value))} className={input} /></div>
        <div><label htmlFor="status" className="block text-sm font-medium">Payment status</label>
          <select id="status" value={status} onChange={(e) => change(() => setStatus(e.target.value))} className={input}>
            <option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label htmlFor="type" className="block text-sm font-medium">Jewelry type</label>
          <select id="type" value={type} onChange={(e) => change(() => setType(e.target.value))} className={input}>
            <option value="">All</option>{types.map((t) => <option key={t}>{t}</option>)}</select></div>
        <button type="button" onClick={clear} disabled={!anyFilter} className="min-h-11 self-end rounded-md border border-gold-soft bg-white px-4 text-sm font-semibold hover:bg-parchment disabled:opacity-40">Clear</button>
      </form>

      <p role="status" aria-live="polite" className="text-sm text-ink-soft">{filtered.length === rows.length ? `${rows.length} ${rows.length === 1 ? "piece" : "pieces"}` : `Showing ${filtered.length} of ${rows.length} pieces`}</p>

      <div className="hidden max-h-[calc(100dvh-2rem)] overflow-auto rounded-md border border-gold-soft bg-white lg:block">
        <table data-table="orders" className="w-full text-xs">
          <caption className="sr-only">Orders</caption>
          <thead>
            <tr>
              {plain("photo", "Photo")}{sortTh("sr_no", "Sr. No.")}{plain("customer", "Customer")}{sortTh("style_no", "Style No.")}{plain("jewelry_type", "Jewelry Type")}{plain("diamond_shape", "Diamond Shape")}{sortTh("order_date", "Date")}
              {plain("gross_wt", "Gross Wt", true)}{plain("dia_qty", "Dia Qty", true)}{sortTh("in_ct", "IN CT", true)}{plain("colour_stone", "Colour Stone", true)}{plain("net_wt", "Net Wt", true)}{plain("multiplier", "Multiplier", true)}{plain("pg_wt", "Pg Wt", true)}
              {owner && <>{plain("gold_amount", "Gold Amount", true)}{plain("diam_amount", "Diam Amount", true)}{plain("l_charges", "L Charges", true)}{plain("labor_amount", "Labor Amount", true)}{plain("sub_total", "Sub Total", true)}{plain("usd_cost", "$", true)}</>}
              {plain("sold_to", "Sold To")}{sortTh("sale_price", "Sale Price", true)}{sortTh("date_sold", "Date Sold")}{plain("memo", "Memo")}{plain("memo_paid", "Memo Paid", true)}{plain("memo_balance", "Memo Balance", true)}{plain("payment_status", "Payment Status")}
            </tr>
          </thead>
          <tbody className="divide-y divide-gold-soft">
            {visible.map((r) => {
              const c = costs[r.id];
              const thumb = r.style_thumb_path ? thumbs[r.style_thumb_path] : undefined;
              return (
                <tr key={r.id} className="group hover:bg-ivory">
                  <td data-col="photo" className="px-2 py-1.5">
                    {thumb
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={thumb} alt="" loading="lazy" className="size-8 rounded object-cover" />
                      : <div className="size-8 rounded bg-parchment" aria-hidden />}
                  </td>
                  <td data-col="sr_no" className={`px-2 py-1.5 ${CELL_FIRST}`}><Link href={`/dashboard/orders/${r.id}`} className="font-medium text-forest underline underline-offset-4">{r.sr_no}</Link></td>
                  <td data-col="customer" className="px-2 py-1.5">{r.customer ?? "—"}</td>
                  <td data-col="style_no" className="px-2 py-1.5 font-mono">{r.style_no}</td>
                  <td data-col="jewelry_type" className="px-2 py-1.5">{r.jewelry_type ?? "—"}</td>
                  <td data-col="diamond_shape" className="px-2 py-1.5">{r.diamond_shape ?? "—"}</td>
                  <td data-col="order_date" className="px-2 py-1.5 whitespace-nowrap">{fmtDate(r.order_date)}</td>
                  <td data-col="gross_wt" className="px-2 py-1.5 text-right">{r.gross_wt ?? "—"}</td>
                  <td data-col="dia_qty" className="px-2 py-1.5 text-right">{r.dia_qty ?? "—"}</td>
                  <td data-col="in_ct" className="px-2 py-1.5 text-right">{r.in_ct ?? "—"}</td>
                  <td data-col="colour_stone" className="px-2 py-1.5 text-right">{r.colour_stone ?? "—"}</td>
                  <td data-col="net_wt" className="px-2 py-1.5 text-right">{r.net_wt ?? "—"}</td>
                  <td data-col="multiplier" className="px-2 py-1.5 text-right">{r.multiplier ?? "—"}</td>
                  <td data-col="pg_wt" className="px-2 py-1.5 text-right">{r.pg_wt ?? "—"}</td>
                  {owner && (<>
                    <td data-col="gold_amount" className="px-2 py-1.5 text-right">{c ? inr.format(num(c.gold_amount)) : "—"}</td>
                    <td data-col="diam_amount" className="px-2 py-1.5 text-right">{c ? inr.format(num(c.diam_amount)) : "—"}</td>
                    <td data-col="l_charges" className="px-2 py-1.5 text-right">{c ? num(c.l_charges) : "—"}</td>
                    <td data-col="labor_amount" className="px-2 py-1.5 text-right">{c ? inr.format(num(c.labor_amount)) : "—"}</td>
                    <td data-col="sub_total" className="px-2 py-1.5 text-right">{c ? inr.format(num(c.sub_total)) : "—"}</td>
                    <td data-col="usd_cost" className="px-2 py-1.5 text-right">{c ? usd.format(num(c.usd_cost)) : "—"}</td>
                  </>)}
                  <td data-col="sold_to" className="px-2 py-1.5">{r.sold_to ?? "—"}</td>
                  <td data-col="sale_price" className="px-2 py-1.5 text-right">{r.sale_price !== null ? usd.format(num(r.sale_price)) : "—"}</td>
                  <td data-col="date_sold" className="px-2 py-1.5 whitespace-nowrap">{fmtDate(r.date_sold)}</td>
                  <td data-col="memo" className="px-2 py-1.5">{r.memo_id ? <Link href={`/dashboard/memos/${r.memo_id}`} className="underline underline-offset-4">{r.memo_no}</Link> : "—"}</td>
                  <td data-col="memo_paid" className="px-2 py-1.5 text-right">{r.memo_paid !== null ? usd.format(num(r.memo_paid)) : "—"}</td>
                  <td data-col="memo_balance" className="px-2 py-1.5 text-right">{r.memo_balance !== null ? usd.format(num(r.memo_balance)) : "—"}</td>
                  <td data-col="payment_status" className="px-2 py-1.5">{badge(r.payment_status)}</td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={owner ? 27 : 21} className="px-3 py-10 text-center text-ink-soft">No orders match. {rows.length === 0 ? "Add your first order to begin." : "Try clearing the filters."}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 lg:hidden" aria-label="Orders">
        {visible.map((r) => {
          const c = costs[r.id];
          const thumb = r.style_thumb_path ? thumbs[r.style_thumb_path] : undefined;
          const facts: Fact[] = [
            ["Customer", r.customer ?? "—"], ["Diamond Shape", r.diamond_shape ?? "—"], ["Gross Wt", r.gross_wt ?? "—"], ["Net Wt", r.net_wt ?? "—"],
            ["Multiplier", r.multiplier ?? "—"], ["Pg Wt", r.pg_wt ?? "—"], ["Dia Qty", r.dia_qty ?? "—"], ["IN CT", r.in_ct ?? "—"], ["Colour Stone", r.colour_stone ?? "—"],
          ];
          if (owner) facts.push(
            ["Gold Amount", c ? inr.format(num(c.gold_amount)) : "—"], ["Diam Amount", c ? inr.format(num(c.diam_amount)) : "—"],
            ["L Charges", c ? num(c.l_charges) : "—"], ["Labor Amount", c ? inr.format(num(c.labor_amount)) : "—"],
            ["Sub Total", c ? inr.format(num(c.sub_total)) : "—"], ["$", c ? usd.format(num(c.usd_cost)) : "—"],
          );
          facts.push(
            ["Sold To", r.sold_to ?? "—"], ["Date Sold", fmtDate(r.date_sold)],
            ["Memo", r.memo_id ? <Link key="m" href={`/dashboard/memos/${r.memo_id}`} className="underline underline-offset-4">{r.memo_no}</Link> : "—"],
            ["Memo Paid", r.memo_paid !== null ? usd.format(num(r.memo_paid)) : "—"], ["Memo Balance", r.memo_balance !== null ? usd.format(num(r.memo_balance)) : "—"],
          );
          return (
            <Tile key={r.id} image={thumb ?? null} title={`#${r.sr_no} · ${r.style_no}`}
              subtitle={[r.jewelry_type, fmtDate(r.order_date)].filter((x) => x && x !== "—").join(" · ")}
              right={<><p className="font-medium">{r.sale_price !== null ? usd.format(num(r.sale_price)) : "Not sold"}</p>{badge(r.payment_status)}</>}
              facts={facts} href={`/dashboard/orders/${r.id}`} hrefLabel="Open / edit" />
          );
        })}
        {visible.length === 0 && <TileEmpty>No orders match.</TileEmpty>}
      </ul>

      {pages > 1 && (
        <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-ink-soft">Page {current} of {pages}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {step("«", "First page", 1, current > 1)}
            {step("‹", "Previous page", current - 1, current > 1)}
            <div className="hidden items-center gap-1.5 sm:flex">
              {pageWindow(current, pages).map((n, i) =>
                n === "…" ? <span key={`gap-${i}`} aria-hidden className="px-1 text-ink-soft">…</span> : (
                  <button key={n} type="button" onClick={() => setPage(n)} aria-current={n === current ? "page" : undefined} aria-label={`Page ${n}`}
                    className={clsx(box, n === current ? "border-forest bg-forest font-semibold text-ivory" : "border-gold-soft bg-white hover:bg-parchment")}>{n}</button>
                ),
              )}
            </div>
            {step("›", "Next page", current + 1, current < pages)}
            {step("»", "Last page", pages, current < pages)}
          </div>
        </nav>
      )}
    </>
  );
}
