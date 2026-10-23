import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui";
import { ArchivePanel, CertificatePanel, ImagePanel, StockPanel } from "./product-panels";

export const metadata: Metadata = { title: "Product" };
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const MOVE_LABEL: Record<string, string> = {
  opening: "Opening stock", adjustment: "Correction", transfer_in: "Moved in", transfer_out: "Moved out",
  purchase_receipt: "Purchase received", sale: "Sale", return: "Return",
};

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const session = await requirePermission("inventory.view");
  const { id } = await params;
  const { notice } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const owner = can(session.role, "costs.view");

  const [{ data: p }, { data: stones }, { data: certs }, { data: imgs }, { data: levels }, { data: locs }, { data: moves }, costRes] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("product_stones").select("*").eq("product_id", id).order("created_at"),
    supabase.from("certificates").select("*").eq("product_id", id).order("created_at"),
    supabase.from("product_images").select("*").eq("product_id", id).order("created_at"),
    supabase.from("stock_levels").select("location_id,quantity,reserved").eq("product_id", id),
    supabase.from("stock_locations").select("id,name,is_active").order("name"),
    supabase.from("stock_movements").select("id,movement_type,quantity_change,balance_after,reason,location_id,created_at").eq("product_id", id).order("created_at", { ascending: false }).limit(50),
    owner ? supabase.from("product_costs").select("*").eq("product_id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!p) notFound();
  const cost = costRes.data;

  const imgUrls = imgs?.length ? (await supabase.storage.from("product-images").createSignedUrls(imgs.map((i) => i.storage_path), 3600)).data : [];
  const certWithFiles = (certs ?? []).filter((c) => c.file_path);
  const certUrls = certWithFiles.length ? (await supabase.storage.from("certificates").createSignedUrls(certWithFiles.map((c) => c.file_path as string), 3600)).data : [];
  const certUrl = new Map(certWithFiles.map((c, i) => [c.id as string, certUrls?.[i]?.signedUrl ?? null]));
  const locName = (lid: string) => locs?.find((l) => l.id === lid)?.name ?? "Unknown";
  const total = (levels ?? []).reduce((n, l) => n + l.quantity, 0);
  const costTotal = cost ? Number(cost.purchase_cost) + Number(cost.additional_cost) + Number(cost.making_charges) : null;
  const canEdit = can(session.role, "inventory.edit");

  const facts: [string, string][] = [
    ["SKU", p.sku], ["Barcode", p.barcode ?? "—"], ["Category", p.category], ["Collection", p.collection ?? "—"],
    ["Metal", [p.metal_type, p.purity].filter(Boolean).join(" ") || "—"],
    ["Gross weight", p.gross_weight_g ? `${p.gross_weight_g} g` : "—"], ["Net metal weight", p.net_metal_weight_g ? `${p.net_metal_weight_g} g` : "—"],
    ["Counted as", p.tracking === "individual" ? "One-of-a-kind piece" : "Quantity"],
    ["Retail price", inr.format(Number(p.retail_price))], ["HSN / GST", `${p.hsn_code ?? "—"} / ${p.gst_rate !== null ? p.gst_rate + "%" : "—"}`],
    ["In stock", String(total)], ["Low-stock warning", p.low_stock_threshold > 0 ? `at ${p.low_stock_threshold} or fewer` : "Off"],
  ];

  return (
    <div className="max-w-5xl space-y-6">
      {notice && <Notice tone="error">{notice.slice(0, 300)}</Notice>}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/inventory" className="text-sm text-gold-deep underline underline-offset-4">← All products</Link>
          <h1 className="mt-1 font-display text-3xl text-forest">{p.name}</h1>
          {p.is_archived && <p className="mt-1 rounded bg-parchment px-2 py-1 text-sm">Archived{p.archived_at ? ` on ${new Date(p.archived_at).toLocaleDateString("en-IN")}` : ""}</p>}
        </div>
        {canEdit && (
          <Link href={`/dashboard/inventory/${id}/edit`} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-gold-soft bg-white px-4 text-sm font-semibold hover:bg-parchment">
            <Pencil className="size-4" aria-hidden /> Edit
          </Link>
        )}
      </div>

      {p.description && <p className="max-w-3xl whitespace-pre-line text-ink-soft">{p.description}</p>}

      <dl className="grid gap-x-8 gap-y-3 rounded-md border border-gold-soft bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k}><dt className="text-sm text-ink-soft">{k}</dt><dd className="font-medium">{v}</dd></div>
        ))}
      </dl>

      {owner && cost && (
        <dl className="grid gap-x-8 gap-y-3 rounded-md border border-gold-soft bg-parchment p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4"><p className="font-display text-xl text-forest">Costs (owner only)</p></div>
          <div><dt className="text-sm text-ink-soft">Purchase cost</dt><dd className="font-medium">{inr.format(Number(cost.purchase_cost))}</dd></div>
          <div><dt className="text-sm text-ink-soft">Additional cost</dt><dd className="font-medium">{inr.format(Number(cost.additional_cost))}</dd></div>
          <div><dt className="text-sm text-ink-soft">Making charges</dt><dd className="font-medium">{inr.format(Number(cost.making_charges))}</dd></div>
          <div><dt className="text-sm text-ink-soft">Gross margin at list price</dt><dd className="font-medium">{costTotal !== null && Number(p.retail_price) > 0 ? inr.format(Number(p.retail_price) - costTotal) : "—"}</dd></div>
        </dl>
      )}

      <section aria-labelledby="stones" className="rounded-md border border-gold-soft bg-white p-5">
        <h2 id="stones" className="font-display text-xl text-forest">Stones</h2>
        {(stones ?? []).length === 0 ? <p className="mt-2 text-ink-soft">No stones recorded.</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead><tr className="text-left text-ink-soft"><th className="py-1 pr-3 font-medium">Type</th><th className="pr-3 font-medium">Shape / cut</th><th className="pr-3 font-medium">Colour / clarity</th><th className="pr-3 font-medium">Carat</th><th className="pr-3 font-medium">Size (mm)</th><th className="pr-3 font-medium">Origin / treatment</th><th className="font-medium">Pcs</th></tr></thead>
              <tbody className="divide-y divide-gold-soft">
                {(stones ?? []).map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 pr-3 font-medium">{s.stone_type}</td>
                    <td className="pr-3">{[s.shape, s.cut].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="pr-3">{[s.colour, s.clarity].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="pr-3">{s.carat_weight ?? "—"}</td>
                    <td className="pr-3">{[s.length_mm, s.width_mm, s.depth_mm].filter((x) => x !== null).join(" × ") || "—"}</td>
                    <td className="pr-3">{[s.origin, s.treatment].filter(Boolean).join(" / ") || "—"}</td>
                    <td>{s.piece_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ImagePanel productId={id} canEdit={canEdit && !p.is_archived}
        images={(imgs ?? []).map((im, i) => ({ id: im.id, url: imgUrls?.[i]?.signedUrl ?? "", primary: im.is_primary })).filter((i) => i.url)} />
      <CertificatePanel productId={id} canEdit={canEdit && !p.is_archived}
        certs={(certs ?? []).map((c) => ({ id: c.id, issuer: c.issuer, number: c.certificate_number, issued_on: c.issued_on, url: certUrl.get(c.id) ?? null }))} />
      <StockPanel productId={id} tracking={p.tracking} archived={p.is_archived}
        locations={(locs ?? []).filter((l) => l.is_active || (levels ?? []).some((v) => v.location_id === l.id)).map((l) => ({ id: l.id, name: l.name }))}
        levels={levels ?? []} canAdjust={can(session.role, "stock.adjust")} canEdit={canEdit} hasHistory={(moves ?? []).length > 0} />

      <section aria-labelledby="history" className="rounded-md border border-gold-soft bg-white p-5">
        <h2 id="history" className="font-display text-xl text-forest">Stock history</h2>
        {(moves ?? []).length === 0 ? <p className="mt-2 text-ink-soft">Nothing recorded yet.</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead><tr className="text-left text-ink-soft"><th className="py-1 pr-3 font-medium">When</th><th className="pr-3 font-medium">What</th><th className="pr-3 font-medium">Where</th><th className="pr-3 text-right font-medium">Change</th><th className="pr-3 text-right font-medium">Balance</th><th className="font-medium">Reason</th></tr></thead>
              <tbody className="divide-y divide-gold-soft">
                {(moves ?? []).map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(m.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className="pr-3">{MOVE_LABEL[m.movement_type] ?? m.movement_type}</td>
                    <td className="pr-3">{locName(m.location_id)}</td>
                    <td className="pr-3 text-right">{m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}</td>
                    <td className="pr-3 text-right">{m.balance_after}</td>
                    <td>{m.reason ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {can(session.role, "products.archive") && <ArchivePanel productId={id} archived={p.is_archived} />}
    </div>
  );
}
