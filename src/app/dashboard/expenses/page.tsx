import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, buildQuery, cleanSearch, fmtDate, num, parsePage, usd } from "@/lib/ledger";
import { Tile, TileEmpty } from "@/components/tiles";
import { KpiStrip, type Kpi } from "@/components/kpi";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; page?: string }> }) {
  await requirePermission("expenses.manage");
  const sp = await searchParams;
  const q = cleanSearch(sp.q);
  const page = parsePage(sp.page);
  const supabase = await createClient();
  let query = supabase.from("expenses").select("*", { count: "exact" });
  if (sp.category) query = query.eq("category", sp.category);
  if (q) query = query.or(`description.ilike.%${q}%,seller.ilike.%${q}%,notes.ilike.%${q}%,category.ilike.%${q}%`);
  const from = (page - 1) * PAGE_SIZE;
  const [{ data: rows, count }, { data: all }, { data: k }] = await Promise.all([
    query.order("expense_date", { ascending: false }).order("sr_no", { ascending: false }).range(from, from + PAGE_SIZE - 1),
    supabase.from("expenses").select("category,amount").limit(5000),
    supabase.from("expenses_kpi").select("*").maybeSingle(),
  ]);
  const cards: Kpi[] = !k ? [] : [
    { label: "Total expenses", value: usd.format(num(k.total)), sub: "all time spend" },
    { label: "Record count", value: String(num(k.entries)), sub: "expense entries" },
    { label: "Top category", value: k.top_category ?? "—", sub: "highest spend area" },
    { label: "Avg per entry", value: usd.format(num(k.avg_amount)), sub: "mean expense size" },
  ];
  const cats = [...new Set((all ?? []).map((e) => e.category as string))].sort();
  const grand = (all ?? []).reduce((n, e) => n + num(e.amount), 0);
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = { q: q || undefined, category: sp.category };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-3xl text-forest">Expenses</h1><p className="text-ink-soft">{total} {total === 1 ? "entry" : "entries"} · all entries total {usd.format(grand)}</p></div>
        <div className="flex gap-2">
          <a href="/dashboard/export?sheet=expenses" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-gold-soft bg-white px-4 text-sm font-semibold hover:bg-parchment"><Download className="size-4" aria-hidden /> Export CSV</a>
          <Link href="/dashboard/expenses/new" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-forest px-4 text-sm font-semibold text-ivory hover:bg-forest-deep"><Plus className="size-4" aria-hidden /> Add expense</Link>
        </div>
      </div>
      {cards.length > 0 && <KpiStrip cards={cards} label="Expenses summary" />}
      <form method="get" className="grid gap-3 rounded-md border border-gold-soft bg-white p-4 sm:grid-cols-[2fr_1fr_auto]">
        <div><label htmlFor="q" className="block text-sm font-medium">Search</label><input id="q" name="q" defaultValue={q} className="mt-1 min-h-11 w-full rounded-md border border-gold-soft px-3" /></div>
        <div><label htmlFor="category" className="block text-sm font-medium">Category</label>
          <select id="category" name="category" defaultValue={sp.category ?? ""} className="mt-1 min-h-11 w-full rounded-md border border-gold-soft bg-white px-3"><option value="">All</option>{cats.map((c) => <option key={c}>{c}</option>)}</select></div>
        <button className="min-h-11 self-end rounded-md bg-forest px-5 text-sm font-semibold text-ivory hover:bg-forest-deep">Apply</button>
      </form>
      <div className="hidden overflow-x-auto rounded-md border border-gold-soft bg-white md:block">
        <table className="w-full min-w-[44rem] text-sm">
          <caption className="sr-only">Expenses</caption>
          <thead className="bg-parchment"><tr className="text-left"><th className="px-3 py-2 font-medium">Sr. No.</th><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Category</th><th className="px-3 py-2 font-medium">Description</th><th className="px-3 py-2 text-right font-medium">Amount</th><th className="px-3 py-2 font-medium">Seller</th><th className="px-3 py-2 font-medium">Notes</th></tr></thead>
          <tbody className="divide-y divide-gold-soft">
            {(rows ?? []).map((e) => (
              <tr key={e.id} className="hover:bg-ivory">
                <td className="px-3 py-2"><Link href={`/dashboard/expenses/${e.id}`} className="font-medium text-forest underline underline-offset-4">{e.sr_no}</Link></td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(e.expense_date)}</td><td className="px-3 py-2">{e.category}</td><td className="px-3 py-2">{e.description}</td>
                <td className="px-3 py-2 text-right">{usd.format(num(e.amount))}</td><td className="px-3 py-2">{e.seller ?? "—"}</td><td className="px-3 py-2">{e.notes ?? ""}</td>
              </tr>
            ))}
            {(rows ?? []).length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-ink-soft">No expenses yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label="Expenses">
        {(rows ?? []).map((e) => (
          <Tile key={e.id} title={e.description} subtitle={`${e.category} · ${fmtDate(e.expense_date)}`}
            right={<p className="font-medium">{usd.format(num(e.amount))}</p>}
            facts={[["Sr. No.", e.sr_no], ["Seller", e.seller ?? "—"], ["Notes", e.notes ?? "—"]]}
            href={`/dashboard/expenses/${e.id}`} hrefLabel="Open / edit" />
        ))}
        {(rows ?? []).length === 0 && <TileEmpty>No expenses yet.</TileEmpty>}
      </ul>
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm"><span className="text-ink-soft">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link className="min-h-11 rounded-md border border-gold-soft bg-white px-4 py-2.5" href={`/dashboard/expenses${buildQuery({ ...base, page: String(page - 1) })}`}>Previous</Link>}
            {page < pages && <Link className="min-h-11 rounded-md border border-gold-soft bg-white px-4 py-2.5" href={`/dashboard/expenses${buildQuery({ ...base, page: String(page + 1) })}`}>Next</Link>}
          </div></nav>
      )}
    </div>
  );
}
