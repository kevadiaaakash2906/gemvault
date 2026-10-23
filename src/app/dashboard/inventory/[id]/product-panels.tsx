"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Star, Trash2 } from "lucide-react";
import {
  addCertificate, adjustStock, deleteCertificate, deleteProductImage, recordOpeningStock,
  setPrimaryImage, setProductArchived, transferStock, uploadProductImage,
} from "@/app/actions/inventory";
import type { ActionResult } from "@/app/actions/auth";
import { Button, Field, Notice, SelectField } from "@/components/ui";

type Msg = ActionResult | undefined;
const Result = ({ r }: { r: Msg }) =>
  r?.error ? <Notice tone="error">{r.error}</Notice> : r?.success ? <Notice tone="success">{r.success}</Notice> : null;

export function ImagePanel({ productId, images, canEdit }: { productId: string; images: { id: string; url: string; primary: boolean }[]; canEdit: boolean }) {
  const [msg, setMsg] = useState<Msg>();
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const run = (fn: () => Promise<ActionResult>) => start(async () => setMsg(await fn()));
  return (
    <section aria-labelledby="photos" className="space-y-4 rounded-md border border-gold-soft bg-white p-5">
      <h2 id="photos" className="font-display text-xl text-forest">Photographs</h2>
      {images.length === 0 && <p className="text-ink-soft">No photos yet.</p>}
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((im) => (
          <li key={im.id} className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.url} alt={im.primary ? "Main product photo" : "Product photo"} className="aspect-square w-full rounded-md object-cover" />
            {canEdit && (
              <div className="flex flex-wrap gap-1">
                {im.primary ? (
                  <span className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-gold-deep"><Star className="size-4" aria-hidden /> Main photo</span>
                ) : (
                  <button className="min-h-9 rounded border border-gold-soft px-2 text-xs" onClick={() => run(() => setPrimaryImage(im.id))}>Make main</button>
                )}
                <button
                  className="inline-flex min-h-9 items-center gap-1 rounded border border-danger/40 px-2 text-xs text-danger"
                  onClick={() => window.confirm("Remove this photo?") && run(() => deleteProductImage(im.id))}
                  aria-label="Remove photo"
                >
                  <Trash2 className="size-3.5" aria-hidden /> Remove
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form
          ref={form}
          action={(fd) => run(async () => { const r = await uploadProductImage(fd); if (r.success) form.current?.reset(); return r; })}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="productId" value={productId} />
          <div>
            <label htmlFor="photo" className="block text-sm font-medium">Add a photo (JPG, PNG or WebP, up to 3.5 MB)</label>
            <input id="photo" name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="mt-1 block min-h-11 text-sm" />
          </div>
          <Button type="submit" loading={pending}>Upload</Button>
        </form>
      )}
      <Result r={msg} />
    </section>
  );
}

export function CertificatePanel({
  productId, certs, canEdit,
}: { productId: string; certs: { id: string; issuer: string; number: string; issued_on: string | null; url: string | null }[]; canEdit: boolean }) {
  const [msg, setMsg] = useState<Msg>();
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  return (
    <section aria-labelledby="certs" className="space-y-4 rounded-md border border-gold-soft bg-white p-5">
      <h2 id="certs" className="font-display text-xl text-forest">Certificates</h2>
      {certs.length === 0 && <p className="text-ink-soft">No certificates recorded.</p>}
      <ul className="divide-y divide-gold-soft">
        {certs.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div>
              <p className="font-medium">{c.issuer} · {c.number}</p>
              {c.issued_on && <p className="text-sm text-ink-soft">Issued {new Date(c.issued_on).toLocaleDateString("en-IN")}</p>}
            </div>
            <div className="flex items-center gap-2">
              {c.url && (
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 rounded border border-gold-soft px-2 text-sm">
                  <FileText className="size-4" aria-hidden /> Open file
                </a>
              )}
              {canEdit && (
                <button
                  className="inline-flex min-h-9 items-center gap-1 rounded border border-danger/40 px-2 text-sm text-danger"
                  onClick={() => window.confirm("Remove this certificate?") && start(async () => setMsg(await deleteCertificate(c.id)))}
                >
                  <Trash2 className="size-4" aria-hidden /> Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {canEdit && (
        <form
          ref={form}
          action={(fd) => start(async () => { const r = await addCertificate(fd); if (r.success) form.current?.reset(); setMsg(r); })}
          className="grid gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="productId" value={productId} />
          <Field id="issuer" name="issuer" label="Issuer" placeholder="GIA, IGI, SGL…" required />
          <Field id="certificate_number" name="certificate_number" label="Certificate number" required />
          <Field id="issued_on" name="issued_on" label="Issue date (optional)" type="date" />
          <div>
            <label htmlFor="cert-file" className="block text-sm font-medium">File (PDF, JPG or PNG, up to 3.5 MB)</label>
            <input id="cert-file" name="file" type="file" accept="application/pdf,image/jpeg,image/png" className="mt-1 block min-h-11 text-sm" />
          </div>
          <div><Button type="submit" loading={pending}>Add certificate</Button></div>
        </form>
      )}
      <Result r={msg} />
    </section>
  );
}

type Loc = { id: string; name: string };
export function StockPanel({
  productId, tracking, locations, levels, archived, canAdjust, canEdit, hasHistory,
}: {
  productId: string; tracking: "individual" | "quantity"; locations: Loc[]; archived: boolean;
  levels: { location_id: string; quantity: number; reserved: number }[]; canAdjust: boolean; canEdit: boolean; hasHistory: boolean;
}) {
  const [msg, setMsg] = useState<Msg>();
  const [pending, start] = useTransition();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const active = locations.filter((l) => !("inactive" in l));
  const nameOf = (id: string) => locations.find((l) => l.id === id)?.name ?? "Unknown";

  const submit = (fn: (fd: FormData) => Promise<ActionResult>) => (fd: FormData) =>
    start(async () => {
      const r = await fn(fd);
      setMsg(r);
      if (r.success) setKey(crypto.randomUUID());
    });
  const g = (fd: FormData, k: string) => String(fd.get(k) ?? "");
  const disabled = archived;

  return (
    <section aria-labelledby="stock" className="space-y-4 rounded-md border border-gold-soft bg-white p-5">
      <h2 id="stock" className="font-display text-xl text-forest">Stock</h2>
      {levels.filter((l) => l.quantity > 0).length === 0 ? (
        <p className="text-ink-soft">No stock recorded yet.</p>
      ) : (
        <ul className="divide-y divide-gold-soft">
          {levels.filter((l) => l.quantity > 0).map((l) => (
            <li key={l.location_id} className="flex justify-between py-2">
              <span>{nameOf(l.location_id)}</span>
              <span className="font-medium">{l.quantity}{l.reserved > 0 ? ` (${l.reserved} reserved)` : ""}</span>
            </li>
          ))}
        </ul>
      )}

      {canEdit && !disabled && !hasHistory && (
        <form action={submit((fd) => recordOpeningStock({ productId, locationId: g(fd, "locationId"), quantity: g(fd, "quantity"), key }))} className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
          <SelectField id="op-loc" name="locationId" label="Record opening stock at">{active.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</SelectField>
          <Field id="op-qty" name="quantity" label="Quantity" inputMode="numeric" defaultValue={tracking === "individual" ? "1" : ""} required />
          <Button type="submit" loading={pending}>Save</Button>
        </form>
      )}

      {canEdit && !disabled && locations.length > 1 && (
        <form action={submit((fd) => transferStock({ productId, fromId: g(fd, "fromId"), toId: g(fd, "toId"), quantity: g(fd, "quantity"), key }))} className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end">
          <SelectField id="tr-from" name="fromId" label="Move from">{active.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</SelectField>
          <SelectField id="tr-to" name="toId" label="Move to" defaultValue={active[1]?.id}>{active.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</SelectField>
          <Field id="tr-qty" name="quantity" label="Quantity" inputMode="numeric" defaultValue="1" required />
          <Button type="submit" variant="ghost" loading={pending}>Move stock</Button>
        </form>
      )}

      {canAdjust && !disabled && (
        <form
          action={(fd) => {
            const d = g(fd, "delta");
            if (!window.confirm(`Change stock by ${d}? This is recorded permanently.`)) return;
            submit((f) => adjustStock({ productId, locationId: g(f, "locationId"), delta: d, reason: g(f, "reason"), key }))(fd);
          }}
          className="space-y-3 rounded-md bg-parchment p-4"
        >
          <p className="text-sm font-medium">Correct stock (owner only)</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <SelectField id="ad-loc" name="locationId" label="Location">{active.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</SelectField>
            <Field id="ad-delta" name="delta" label="Change by" hint="3 adds, -2 removes" inputMode="numeric" required />
          </div>
          <Field id="ad-reason" name="reason" label="Reason" placeholder="e.g. Counted again, one piece damaged" required />
          <Button type="submit" variant="ghost" loading={pending}>Apply correction</Button>
        </form>
      )}
      <Result r={msg} />
    </section>
  );
}

export function ArchivePanel({ productId, archived }: { productId: string; archived: boolean }) {
  const [msg, setMsg] = useState<Msg>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        variant={archived ? "ghost" : "danger"}
        loading={pending}
        onClick={() => window.confirm(archived ? "Restore this product?" : "Archive this product? It disappears from the active list, but its history is kept.") &&
          start(async () => setMsg(await setProductArchived(productId, !archived)))}
      >
        {archived ? "Restore product" : "Archive product"}
      </Button>
      <Result r={msg} />
    </div>
  );
}
