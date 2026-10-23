import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, Download, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, buildQuery, cleanSearch, parsePage, parseSort } from "@/lib/inventory";

export const metadata: Metadata = { title: "Inventory" };
type SP = { q?: string; category?: string; status?: string; low?: string; sort?: string; dir?: string; page?: string };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requirePermission("inventory.view");
  const sp = await searchParams;
  const q = cleanSearch(sp.q);
  const status = sp.status === "archived" || sp.status === "all" ? sp.status : "active";
  const sort = parseSort(sp.sort);
  const dir = sp.dir === "asc" ? "asc" : sp.dir === "desc" ? "desc" : sort === "created_at" ? "desc" : "asc";
  const page = parsePage(sp.page);
  const supabase = await createClient();

  let query = supabase
    .from("product_overview")
    .select("id,sku,name,category,collection,metal_type,purity,retail_price,tracking,total_quantity,is_low_stock,is_archived", { count: "exact" });
  if (status !== "all") query = query.eq("is_archived", status === "archived");
  if (sp.category) query = query.eq("category", sp.category);
  if (sp.low === "1") query = query.eq("is_low_stock", true);
  if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%,category.ilike.%${q}%,collection.ilike.%${q}%`);
  const from = (page - 1) * PAGE_SIZE;
  const { data: rows, count, error } = await query.order(sort, { ascending: dir === "asc" }).order("id").range(from, from + PAGE_SIZE - 1);

  const { data: cats } = await supabase.from("products").select("category").limit(2000);
  const categories = [...new Set((cats ?? []).map((c) => c.category as string))].sort();

  const ids = (rows ?? []).map((r) => r.id as string);
  const thumbs = new Map<string, string>();
  if (ids.length) {
    const { data: imgs } = await supabase.from("product_images").select("product_id,storage_path").eq("is_primary", true).in("product_id", ids);
    if (imgs?.length) {
      const { data: signed } = await supabase.storage.from("product-images").createSignedUrls(imgs.map((i) => i.storage_path), 3600);
      imgs.forEach((i, n) => {
        const url = signed?.[n]?.signedUrl;
        if (url) thumbs.set(i.product_id as string, url);
      });
    }
  }

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = { q: q || undefined, category: sp.category, status: status === "active" ? undefined : status, low: sp.low, sort: sp.sort, dir: sp.dir };
  const sortLink = (key: string) => {
    const nextDir = sort === key && dir === "asc" ? "desc" : "asc";
    return `/dashboard/inventory${buildQuery({ ...base, sort: key, dir: nextDir })}`;
  };
  const th = (k: string, label: string, right?: boolean) => (
    <th key={k} scope="col" aria-sort={sort === k ? (dir === "asc" ? "ascending" : "descending") : "none"} className={`px-3 py-2 font-medium ${right ? "text-right" : "text-left"}`}>
      <Link href={sortLink(k)} className="inline-flex items-center gap-1 hover:text-gold-deep">
        {label}
        {sort === k && (dir === "asc" ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />)}
      </Link>
    </th>
  );
  const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-forest">Inventory</h1>
          <p className="text-ink-soft">{total} {total === 1 ? "product" : "products"}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/dashboard/inventory/export${buildQuery({ status: base.status })}`} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-gold-soft bg-white px-4 text-sm font-semibold hover:bg-parchment">
            <Download className="size-4" aria-hidden /> Export CSV
          </a>
          {can(session.role, "inventory.edit") && (
            <Link href="/dashboard/inventory/new" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-forest px-4 text-sm font-semibold text-ivory hover:bg-forest-deep">
              <Plus className="size-4" aria-hidden /> Add product
            </Link>
          )}
        </div>
      </div>

      <form method="get" className="grid gap-3 rounded-md border border-gold-soft bg-white p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto_auto]">
        <div>
          <label htmlFor="q" className="block text-sm font-medium">Search</label>
          <input id="q" name="q" defaultValue={q} placeholder="Name, SKU, barcode, category" className="mt-1 min-h-11 w-full rounded-md border border-gold-soft px-3" />
        </div>
        <div>
          <label htmlFor="category" className="block text-sm font-medium">Category</label>
          <select id="category" name="category" defaultValue={sp.category ?? ""} className="mt-1 min-h-11 w-full rounded-md border border-gold-soft bg-white px-3">
            <option value="">All</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium">Show</label>
          <select id="status" name="status" defaultValue={status} className="mt-1 min-h-11 w-full rounded-md border border-gold-soft bg-white px-3">
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm">
          <input type="checkbox" name="low" value="1" defaultChecked={sp.low === "1"} className="size-5" /> Low stock only
        </label>
        <button className="min-h-11 self-end rounded-md bg-forest px-5 text-sm font-semibold text-ivory hover:bg-forest-deep">Apply</button>
      </form>

      {error && <p role="alert" className="rounded-md border border-danger/40 bg-red-50 p-3 text-danger">Could not load products. Please refresh the page.</p>}

      <div className="overflow-x-auto rounded-md border border-gold-soft bg-white">
        <table className="w-full min-w-[44rem] text-sm">
          <caption className="sr-only">Products</caption>
          <thead className="bg-parchment">
            <tr>
              <th scope="col" className="w-16 px-3 py-2"><span className="sr-only">Photo</span></th>
              {th("name", "Product")}
              {th("sku", "SKU")}
              <th scope="col" className="px-3 py-2 text-left font-medium">Metal</th>
              {th("retail_price", "Price", true)}
              {th("total_quantity", "In stock", true)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gold-soft">
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="hover:bg-ivory">
                <td className="px-3 py-2">
                  {thumbs.get(r.id) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbs.get(r.id)} alt="" className="size-12 rounded object-cover" />
                  ) : (
                    <div className="size-12 rounded bg-parchment" aria-hidden />
                  )}
                </td>
                <td className="px-3 py-2">
                  <Link href={`/dashboard/inventory/${r.id}`} className="font-medium text-forest underline-offset-4 hover:underline">{r.name}</Link>
                  <p className="text-ink-soft">{r.category}{r.collection ? ` · ${r.collection}` : ""}{r.is_archived ? " · Archived" : ""}</p>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.sku}</td>
                <td className="px-3 py-2 capitalize">{[r.metal_type, r.purity].filter(Boolean).join(" ") || "—"}</td>
                <td className="px-3 py-2 text-right">{inr.format(Number(r.retail_price))}</td>
                <td className="px-3 py-2 text-right">
                  {r.total_quantity}
                  {r.is_low_stock && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">Low</span>}
                </td>
              </tr>
            ))}
            {(rows ?? []).length === 0 && !error && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-ink-soft">No products match. {total === 0 && !q && !sp.category ? "Add your first product to begin." : "Try clearing the filters."}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm">
          <span className="text-ink-soft">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link className="min-h-11 rounded-md border border-gold-soft bg-white px-4 py-2.5" href={`/dashboard/inventory${buildQuery({ ...base, page: String(page - 1) })}`}>Previous</Link>}
            {page < pages && <Link className="min-h-11 rounded-md border border-gold-soft bg-white px-4 py-2.5" href={`/dashboard/inventory${buildQuery({ ...base, page: String(page + 1) })}`}>Next</Link>}
          </div>
        </nav>
      )}
    </div>
  );
}
