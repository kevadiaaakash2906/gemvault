import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { num, parsePage, pickSort, usd } from "@/lib/ledger";
import { KpiStrip, type Kpi } from "@/components/kpi";
import { signedUsd } from "@/lib/reports";
import { ColumnPicker } from "@/components/column-picker";
import { OrdersBrowser, type CostRow, type OrderRow } from "@/components/orders-browser";
import { COLUMNS } from "@/lib/columns";
import { getHiddenColumns } from "@/lib/column-prefs";

export const metadata: Metadata = { title: "Orders" };
const SORTS = ["sr_no", "order_date", "style_no", "in_ct", "sale_price", "date_sold"] as const;
const STATUSES = ["Not Sold", "Unpaid", "Partial", "Paid"];
type SP = { q?: string; ct?: string; status?: string; type?: string; sort?: string; dir?: string; page?: string };
type Client = Awaited<ReturnType<typeof createClient>>;

/** Reads a whole table, 1000 rows at a time (the database returns at most 1000 per request). */
async function fetchAll(supabase: Client, table: string, order: string): Promise<{ rows: Record<string, unknown>[]; failed: boolean }> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").order(order, { ascending: false }).range(from, from + 999);
    if (error) return { rows, failed: true };
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return { rows, failed: false };
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requirePermission("orders.view");
  const sp = await searchParams;
  const owner = can(session.role, "costs.view");
  const sort = pickSort(sp.sort, SORTS, "sr_no");
  const dir = sp.dir === "asc" ? "asc" : sp.dir === "desc" ? "desc" : sort === "sr_no" ? "desc" : "asc";
  const supabase = await createClient();

  // Everything is asked for at the same time, once. After this, searching never calls the server.
  const [orders, costs, kRes, stockRes, hidden] = await Promise.all([
    fetchAll(supabase, "order_overview", "sr_no"),
    owner ? fetchAll(supabase, "order_costs", "order_id") : Promise.resolve({ rows: [] as Record<string, unknown>[], failed: false }),
    Promise.resolve(supabase.from("orders_kpi").select("*").maybeSingle()),
    Promise.resolve(supabase.rpc("live_stock_value")),   // stock at cost, re-priced at today's rates
    getHiddenColumns(supabase, "orders"),
  ]);
  const rows = orders.rows as unknown as OrderRow[];

  const paths = [...new Set(rows.map((r) => r.style_thumb_path).filter((p): p is string => !!p))];
  const thumbs: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("style-photos").createSignedUrls(paths, 3600);
    (signed ?? []).forEach((x) => { if (x.path && x.signedUrl) thumbs[x.path] = x.signedUrl; });
  }
  const costMap: Record<string, CostRow> = {};
  costs.rows.forEach((c) => { costMap[String(c.order_id)] = c as unknown as CostRow; });

  const k = kRes.data;
  const stockValue = num(stockRes.data ?? k?.stock_value);   // falls back to the saved cost if the database update has not run yet
  const cards: Kpi[] = !k ? [] : owner ? [
    { label: "Total revenue", value: usd.format(num(k.revenue)), sub: `from ${num(k.sold_items)} sold items` },
    { label: "Total cost", value: usd.format(num(k.cost)), sub: "manufacturing + labor" },
    { label: "Gross profit / loss", value: signedUsd(num(k.profit)), sub: "sold pieces with a cost on file", tone: num(k.profit) < 0 ? "bad" : "good" },
    { label: "Amount collected", value: usd.format(num(k.collected)), sub: "payments received" },
    { label: "Outstanding balance", value: usd.format(num(k.outstanding)), sub: "across all orders", tone: "warn" },
    { label: "Stock on hand", value: String(num(k.stock_items)), sub: `unsold items worth ${usd.format(stockValue)} at cost` },
  ] : [
    { label: "Total revenue", value: usd.format(num(k.revenue)), sub: `from ${num(k.sold_items)} sold items` },
    { label: "Amount collected", value: usd.format(num(k.collected)), sub: "payments received" },
    { label: "Outstanding balance", value: usd.format(num(k.outstanding)), sub: "across all orders", tone: "warn" },
    { label: "Stock on hand", value: String(num(k.stock_items)), sub: "pieces not sold yet" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl text-forest">Orders</h1>
        <div className="flex flex-wrap gap-2">
          <div className="hidden lg:block"><ColumnPicker table="orders" columns={COLUMNS.orders.filter((c) => owner || !c.ownerOnly)} initialHidden={hidden} /></div>
          <a href="/dashboard/export?sheet=orders" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-gold-soft bg-white px-4 text-sm font-semibold hover:bg-parchment"><Download className="size-4" aria-hidden /> Download Excel</a>
          {can(session.role, "orders.edit") && (
            <Link href="/dashboard/orders/new" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-forest px-4 text-sm font-semibold text-ivory hover:bg-forest-deep"><Plus className="size-4" aria-hidden /> Add order</Link>
          )}
        </div>
      </div>

      {cards.length > 0 && <KpiStrip cards={cards} label="Orders summary" />}

      {(orders.failed || costs.failed) && <p role="alert" className="rounded-md border border-danger/40 bg-red-50 p-3 text-danger">Could not load all orders. Please refresh the page.</p>}

      <OrdersBrowser rows={rows} costs={costMap} thumbs={thumbs} owner={owner}
        initial={{
          q: (sp.q ?? "").slice(0, 80), ct: (sp.ct ?? "").slice(0, 20), status: STATUSES.includes(sp.status ?? "") ? (sp.status as string) : "",
          type: sp.type ?? "", sort, dir, page: parsePage(sp.page),
        }} />
    </div>
  );
}
