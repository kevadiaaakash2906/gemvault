import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, Download, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, buildQuery, cleanSearch, fmtDate, inr, num, parsePage, pickSort, usd } from "@/lib/ledger";
import { Tile, TileEmpty, type Fact } from "@/components/tiles";
import { KpiStrip, type Kpi } from "@/components/kpi";
import { signedUsd } from "@/lib/reports";

export const metadata: Metadata = { title: "Orders" };
const SORTS = ["sr_no", "order_date", "style_no", "sale_price", "date_sold"] as const;
type SP = { q?: string; status?: string; type?: string; sort?: string; dir?: string; page?: string };
const STATUSES = ["Not Sold", "Unpaid", "Partial", "Paid"];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requirePermission("orders.view");
  const sp = await searchParams;
  const owner = can(session.role, "costs.view");
  const q = cleanSearch(sp.q);
  const sort = pickSort(sp.sort, SORTS, "sr_no");
  const dir = sp.dir === "asc" ? "asc" : sp.dir === "desc" ? "desc" : sort === "sr_no" ? "desc" : "asc";
  const page = parsePage(sp.page);
  const status = STATUSES.includes(sp.status ?? "") ? sp.status : undefined;
  const supabase = await createClient();
  const kpiRequest = Promise.resolve(supabase.from("orders_kpi").select("*").maybeSingle());   // starts now, so it runs alongside the list

  let query = supabase.from("order_overview").select("*", { count: "exact" });
  if (status) query = query.eq("payment_status", status);
  if (sp.type) query = query.eq("jewelry_type", sp.type);
  if (q) query = query.or(`style_no.ilike.%${q}%,customer.ilike.%${q}%,sold_to.ilike.%${q}%,memo_no.ilike.%${q}%`);
  const from = (page - 1) * PAGE_SIZE;
  const { data: rows, count, error } = await query.order(sort, { ascending: dir === "asc", nullsFirst: false }).order("id").range(from, from + PAGE_SIZE - 1);

  const { data: types } = await supabase.from("orders").select("jewelry_type").not("jewelry_type", "is", null).limit(2000);
  const typeList = [...new Set((types ?? []).map((t) => t.jewelry_type as string))].sort();

  const costs = new Map<string, Record<string, number>>();
  const thumbUrls = new Map<string, string>();
  const thumbPaths = [...new Set((rows ?? []).map((r) => r.style_thumb_path).filter((p): p is string => !!p))];
  const [costRes, signed] = await Promise.all([
    owner && rows?.length ? supabase.from("order_costs").select("*").in("order_id", rows.map((r) => r.id)) : Promise.resolve({ data: null }),
    thumbPaths.length ? supabase.storage.from("style-photos").createSignedUrls(thumbPaths, 3600) : Promise.resolve({ data: null }),
  ]);
  (costRes.data ?? []).forEach((c: Record<string, number> & { order_id: string }) => costs.set(c.order_id, c));
  (signed.data ?? []).forEach((x) => { if (x.path && x.signedUrl) thumbUrls.set(x.path, x.signedUrl); });

  const { data: k } = await kpiRequest;
  const cards: Kpi[] = !k ? [] : owner ? [
    { label: "Total revenue", value: usd.format(num(k.revenue)), sub: `from ${num(k.sold_items)} sold items` },
    { label: "Total cost", value: usd.format(num(k.cost)), sub: "manufacturing + labor" },
    { label: "Gross profit / loss", value: signedUsd(num(k.profit)), sub: "sold pieces with a cost on file", tone: num(k.profit) < 0 ? "bad" : "good" },
    { label: "Amount collected", value: usd.format(num(k.collected)), sub: "payments received" },
    { label: "Outstanding balance", value: usd.format(num(k.outstanding)), sub: "across all orders", tone: "warn" },
    { label: "Stock on hand", value: String(num(k.stock_items)), sub: `unsold items worth ${usd.format(num(k.stock_value))} at cost` },
  ] : [
    { label: "Total revenue", value: usd.format(num(k.revenue)), sub: `from ${num(k.sold_items)} sold items` },
    { label: "Amount collected", value: usd.format(num(k.collected)), sub: "payments received" },
    { label: "Outstanding balance", value: usd.format(num(k.outstanding)), sub: "across all orders", tone: "warn" },
    { label: "Stock on hand", value: String(num(k.stock_items)), sub: "pieces not sold yet" },
  ];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = { q: q || undefined, status, type: sp.type, sort: sp.sort, dir: sp.dir };
  const th = (k: string, label: string, right?: boolean) => {
    const nextDir = sort === k && dir === "asc" ? "desc" : "asc";
    return (
      <th key={k} scope="col" aria-sort={sort === k ? (dir === "asc" ? "ascending" : "descending") : "none"} className={`px-2 py-2 font-medium whitespace-nowrap ${right ? "text-right" : "text-left"}`}>
        <Link href={`/dashboard/orders${buildQuery({ ...base, sort: k, dir: nextDir })}`} className="inline-flex items-center gap-1 hover:text-gold-deep">
          {label}
          {sort === k && (dir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
        </Link>
      </th>
    );
  };
  const plain = (label: string, right?: boolean) => <th key={label} scope="col" className={`px-2 py-2 font-medium whitespace-nowrap ${right ? "text-right" : "text-left"}`}>{label}</th>;
  const badge = (s: string) => {
    const c = s === "Paid" ? "bg-emerald-100 text-emerald-900" : s === "Partial" ? "bg-amber-100 text-amber-900" : s === "Unpaid" ? "bg-red-100 text-red-900" : "bg-parchment text-ink-soft";
    return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${c}`}>{s}</span>;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-forest">Orders</h1>
          <p className="text-ink-soft">{total} {total === 1 ? "piece" : "pieces"}</p>
        </div>
        <div className="flex gap-2">
          <a href="/dashboard/export?sheet=orders" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-gold-soft bg-white px-4 text-sm font-semibold hover:bg-parchment"><Download className="size-4" aria-hidden /> Export CSV</a>
          {can(session.role, "orders.edit") && (
            <Link href="/dashboard/orders/new" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-forest px-4 text-sm font-semibold text-ivory hover:bg-forest-deep"><Plus className="size-4" aria-hidden /> Add order</Link>
          )}
        </div>
      </div>

      {cards.length > 0 && <KpiStrip cards={cards} label="Orders summary" />}

      <form method="get" className="grid gap-3 rounded-md border border-gold-soft bg-white p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
        <div><label htmlFor="q" className="block text-sm font-medium">Search</label>
          <input id="q" name="q" defaultValue={q} placeholder="Style no, customer, sold to, memo" className="mt-1 min-h-11 w-full rounded-md border border-gold-soft px-3" /></div>
        <div><label htmlFor="status" className="block text-sm font-medium">Payment status</label>
          <select id="status" name="status" defaultValue={status ?? ""} className="mt-1 min-h-11 w-full rounded-md border border-gold-soft bg-white px-3">
            <option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label htmlFor="type" className="block text-sm font-medium">Jewelry type</label>
          <select id="type" name="type" defaultValue={sp.type ?? ""} className="mt-1 min-h-11 w-full rounded-md border border-gold-soft bg-white px-3">
            <option value="">All</option>{typeList.map((t) => <option key={t}>{t}</option>)}</select></div>
        <button className="min-h-11 self-end rounded-md bg-forest px-5 text-sm font-semibold text-ivory hover:bg-forest-deep">Apply</button>
      </form>

      {error && <p role="alert" className="rounded-md border border-danger/40 bg-red-50 p-3 text-danger">Could not load orders. Please refresh the page.</p>}

      <div className="hidden overflow-x-auto rounded-md border border-gold-soft bg-white lg:block">
        <table className="w-full text-xs">
          <caption className="sr-only">Orders</caption>
          <thead className="bg-parchment">
            <tr>
              {plain("Photo")}{th("sr_no", "Sr. No.")}{plain("Customer")}{th("style_no", "Style No.")}{plain("Jewelry Type")}{plain("Diamond Shape")}{th("order_date", "Date")}
              {plain("Gross Wt", true)}{plain("Dia Qty", true)}{plain("IN CT", true)}{plain("Colour Stone", true)}{plain("Net Wt", true)}{plain("Multiplier", true)}{plain("Pg Wt", true)}
              {owner && <>{plain("Gold Amount", true)}{plain("Diam Amount", true)}{plain("L Charges", true)}{plain("Labor Amount", true)}{plain("Sub Total", true)}{plain("$", true)}</>}
              {plain("Sold To")}{th("sale_price", "Sale Price", true)}{th("date_sold", "Date Sold")}{plain("Memo")}{plain("Memo Paid", true)}{plain("Memo Balance", true)}{plain("Payment Status")}
            </tr>
          </thead>
          <tbody className="divide-y divide-gold-soft">
            {(rows ?? []).map((r) => {
              const c = costs.get(r.id);
              return (
                <tr key={r.id} className="hover:bg-ivory">
                  <td className="px-2 py-2">
                    {r.style_thumb_path && thumbUrls.get(r.style_thumb_path)
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={thumbUrls.get(r.style_thumb_path)} alt="" className="size-10 rounded object-cover" />
                      : <div className="size-10 rounded bg-parchment" aria-hidden />}
                  </td>
                  <td className="px-2 py-2"><Link href={`/dashboard/orders/${r.id}`} className="font-medium text-forest underline underline-offset-4">{r.sr_no}</Link></td>
                  <td className="px-2 py-2">{r.customer ?? "—"}</td>
                  <td className="px-2 py-2 font-mono">{r.style_no}</td>
                  <td className="px-2 py-2">{r.jewelry_type ?? "—"}</td>
                  <td className="px-2 py-2">{r.diamond_shape ?? "—"}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{fmtDate(r.order_date)}</td>
                  <td className="px-2 py-2 text-right">{r.gross_wt ?? "—"}</td>
                  <td className="px-2 py-2 text-right">{r.dia_qty ?? "—"}</td>
                  <td className="px-2 py-2 text-right">{r.in_ct ?? "—"}</td>
                  <td className="px-2 py-2 text-right">{r.colour_stone ?? "—"}</td>
                  <td className="px-2 py-2 text-right">{r.net_wt ?? "—"}</td>
                  <td className="px-2 py-2 text-right">{r.multiplier ?? "—"}</td>
                  <td className="px-2 py-2 text-right">{r.pg_wt ?? "—"}</td>
                  {owner && (<>
                    <td className="px-2 py-2 text-right">{c ? inr.format(num(c.gold_amount)) : "—"}</td>
                    <td className="px-2 py-2 text-right">{c ? inr.format(num(c.diam_amount)) : "—"}</td>
                    <td className="px-2 py-2 text-right">{c ? num(c.l_charges) : "—"}</td>
                    <td className="px-2 py-2 text-right">{c ? inr.format(num(c.labor_amount)) : "—"}</td>
                    <td className="px-2 py-2 text-right">{c ? inr.format(num(c.sub_total)) : "—"}</td>
                    <td className="px-2 py-2 text-right">{c ? usd.format(num(c.usd_cost)) : "—"}</td>
                  </>)}
                  <td className="px-2 py-2">{r.sold_to ?? "—"}</td>
                  <td className="px-2 py-2 text-right">{r.sale_price !== null ? usd.format(num(r.sale_price)) : "—"}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{fmtDate(r.date_sold)}</td>
                  <td className="px-2 py-2">{r.memo_id ? <Link href={`/dashboard/memos/${r.memo_id}`} className="underline underline-offset-4">{r.memo_no}</Link> : "—"}</td>
                  <td className="px-2 py-2 text-right">{r.memo_paid !== null ? usd.format(num(r.memo_paid)) : "—"}</td>
                  <td className="px-2 py-2 text-right">{r.memo_balance !== null ? usd.format(num(r.memo_balance)) : "—"}</td>
                  <td className="px-2 py-2">{badge(r.payment_status)}</td>
                </tr>
              );
            })}
            {(rows ?? []).length === 0 && !error && (
              <tr><td colSpan={owner ? 27 : 21} className="px-3 py-10 text-center text-ink-soft">No orders match. {total === 0 && !q && !status && !sp.type ? "Add your first order to begin." : "Try clearing the filters."}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 lg:hidden" aria-label="Orders">
        {(rows ?? []).map((r) => {
          const c = costs.get(r.id);
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
            <Tile key={r.id} image={r.style_thumb_path ? thumbUrls.get(r.style_thumb_path) ?? null : null} title={`#${r.sr_no} · ${r.style_no}`}
              subtitle={[r.jewelry_type, fmtDate(r.order_date)].filter((x) => x && x !== "—").join(" · ")}
              right={<><p className="font-medium">{r.sale_price !== null ? usd.format(num(r.sale_price)) : "Not sold"}</p>{badge(r.payment_status)}</>}
              facts={facts} href={`/dashboard/orders/${r.id}`} hrefLabel="Open / edit" />
          );
        })}
        {(rows ?? []).length === 0 && !error && <TileEmpty>No orders match.</TileEmpty>}
      </ul>

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm">
          <span className="text-ink-soft">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link className="min-h-11 rounded-md border border-gold-soft bg-white px-4 py-2.5" href={`/dashboard/orders${buildQuery({ ...base, page: String(page - 1) })}`}>Previous</Link>}
            {page < pages && <Link className="min-h-11 rounded-md border border-gold-soft bg-white px-4 py-2.5" href={`/dashboard/orders${buildQuery({ ...base, page: String(page + 1) })}`}>Next</Link>}
          </div>
        </nav>
      )}
      <p className="text-xs text-ink-soft">Memo Paid and Memo Balance are for the whole memo, because one payment can cover several pieces.</p>
    </div>
  );
}
