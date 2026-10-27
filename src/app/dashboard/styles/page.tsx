import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, buildQuery, cleanSearch, parsePage } from "@/lib/ledger";
import { StyleEditor } from "./style-editor";

export const metadata: Metadata = { title: "Styles" };
const PER_PAGE = 24;
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function StylesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; edit?: string; new?: string }> }) {
  const session = await requirePermission("styles.view");
  const sp = await searchParams;
  const supabase = await createClient();
  const canEdit = can(session.role, "styles.edit");

  if (sp.new && canEdit) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl text-forest">Add style</h1>
        <StyleEditor initial={{ style_no: "", jewelry_type: "", diamond_shape: "" }} isNew photoUrl={null} orderCount={0} canDelete={false} />
      </div>
    );
  }

  if (sp.edit) {
    if (!/^[0-9a-f-]{36}$/i.test(sp.edit)) notFound();
    const { data: st } = await supabase.from("style_overview").select("*").eq("id", sp.edit).maybeSingle();
    if (!st) notFound();
    let photoUrl: string | null = null;
    if (st.photo_path) {
      const { data: signed } = await supabase.storage.from("style-photos").createSignedUrl(st.photo_path, 3600);
      photoUrl = signed?.signedUrl ?? null;
    }
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl text-forest">Style {st.style_no}</h1>
        <StyleEditor initial={{ id: st.id, style_no: st.style_no, jewelry_type: s(st.jewelry_type), diamond_shape: s(st.diamond_shape) }}
          isNew={false} photoUrl={photoUrl} orderCount={st.orders_count} canDelete={can(session.role, "styles.delete")} />
      </div>
    );
  }

  const q = cleanSearch(sp.q);
  const page = parsePage(sp.page);
  let query = supabase.from("style_overview").select("id,style_no,jewelry_type,diamond_shape,thumb_path,orders_count", { count: "exact" });
  if (q) query = query.or(`style_no.ilike.%${q}%,jewelry_type.ilike.%${q}%,diamond_shape.ilike.%${q}%`);
  const from = (page - 1) * PER_PAGE;
  const { data: rows, count, error } = await query.order("style_key").range(from, from + PER_PAGE - 1);
  const paths = (rows ?? []).map((r) => r.thumb_path).filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("style-photos").createSignedUrls(paths, 3600);
    (signed ?? []).forEach((x) => { if (x.path && x.signedUrl) urls.set(x.path, x.signedUrl); });
  }
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const base = { q: q || undefined };
  void PAGE_SIZE;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-forest">Styles</h1>
          <p className="text-ink-soft">{total} {total === 1 ? "style" : "styles"}. Each has one photo, used by every order with that style number.</p>
        </div>
        {canEdit && (
          <Link href="/dashboard/styles?new=1" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-forest px-4 text-sm font-semibold text-ivory hover:bg-forest-deep"><Plus className="size-4" aria-hidden /> Add style</Link>
        )}
      </div>
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-md border border-gold-soft bg-white p-4">
        <div className="min-w-56 flex-1"><label htmlFor="q" className="block text-sm font-medium">Search</label>
          <input id="q" name="q" defaultValue={q} placeholder="Style number, type or shape" className="mt-1 min-h-11 w-full rounded-md border border-gold-soft px-3" /></div>
        <button className="min-h-11 rounded-md bg-forest px-5 text-sm font-semibold text-ivory hover:bg-forest-deep">Apply</button>
      </form>
      {error && <p role="alert" className="rounded-md border border-danger/40 bg-red-50 p-3 text-danger">Could not load styles. Please refresh the page.</p>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {(rows ?? []).map((r) => (
          <li key={r.id}>
            <Link href={`/dashboard/styles?edit=${r.id}`} className="block overflow-hidden rounded-md border border-gold-soft bg-white hover:border-gold">
              {r.thumb_path && urls.get(r.thumb_path)
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={urls.get(r.thumb_path)} alt="" className="aspect-square w-full object-cover" />
                : <div className="grid aspect-square w-full place-items-center bg-parchment text-sm text-ink-soft">No photo</div>}
              <div className="p-3">
                <p className="truncate font-medium text-forest">{r.style_no}</p>
                <p className="truncate text-sm text-ink-soft">{[r.jewelry_type, r.diamond_shape].filter(Boolean).join(" · ") || "—"}</p>
                <p className="text-xs text-ink-soft">{r.orders_count} {r.orders_count === 1 ? "order" : "orders"}</p>
              </div>
            </Link>
          </li>
        ))}
        {(rows ?? []).length === 0 && !error && <li className="col-span-full rounded-md border border-gold-soft bg-white p-8 text-center text-ink-soft">No styles yet. They appear automatically when you add orders.</li>}
      </ul>
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm"><span className="text-ink-soft">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link className="min-h-11 rounded-md border border-gold-soft bg-white px-4 py-2.5" href={`/dashboard/styles${buildQuery({ ...base, page: String(page - 1) })}`}>Previous</Link>}
            {page < pages && <Link className="min-h-11 rounded-md border border-gold-soft bg-white px-4 py-2.5" href={`/dashboard/styles${buildQuery({ ...base, page: String(page + 1) })}`}>Next</Link>}
          </div></nav>
      )}
    </div>
  );
}
