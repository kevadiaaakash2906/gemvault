"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lookupMemo, saveOrderSale } from "@/app/actions/ledger";
import { Button, Field, Notice } from "@/components/ui";
import { usd } from "@/lib/ledger";
import { memoAfterSale } from "@/lib/reports";
import type { MemoPreview } from "@/lib/memo-preview";

type Found = Extract<MemoPreview, { found: true }>;

/** The only part of an order a seller can change. Type the memo number first: an existing memo fills in its buyer and shows what is on it. */
export function OrderSaleForm({ id, initial, initialMemo, buyers, alreadySold }: {
  id: string; initial: { sold_to: string; memo_no: string; sale_price: string; date_sold: string }; initialMemo: Found | null; buyers: string[]; alreadySold: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [memo, setMemo] = useState<Found | null>(initialMemo);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(0);

  function onMemoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const memo_no = e.target.value;
    setDone(false);
    setV((cur) => ({ ...cur, memo_no }));
    clearTimeout(timer.current);
    const mine = ++latest.current;
    if (!/^[A-Za-z0-9._-]{1,20}$/.test(memo_no.trim())) { setMemo(null); setChecking(false); return; }
    setChecking(true);
    timer.current = setTimeout(async () => {
      const r = await lookupMemo({ memo_no, order_id: id });
      if (mine !== latest.current) return;                    // a newer number was typed meanwhile
      setChecking(false);
      if ("error" in r || !r.found) { setMemo(null); return; }
      setMemo(r);
      setV((cur) => ({ ...cur, sold_to: r.buyer }));          // the memo already belongs to this buyer
    }, 350);
  }

  const set = (k: "sold_to" | "sale_price" | "date_sold") => (e: React.ChangeEvent<HTMLInputElement>) => { setV((cur) => ({ ...cur, [k]: e.target.value })); setDone(false); };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setDone(false);
    start(async () => {
      const r = await saveOrderSale({ id, ...v });
      if (r.error) setError(r.error);
      else { setDone(true); router.refresh(); }
    });
  }

  const price = /^\d{1,12}(\.\d{1,2})?$/.test(v.sale_price.trim()) ? Number(v.sale_price) : null;
  const after = memo && price !== null ? memoAfterSale(memo.bill, memo.paid, memo.thisPrice, price) : null;
  const tone = memo?.status === "Paid" ? "text-emerald-700" : memo?.status === "Unpaid" ? "text-danger" : "text-amber-700";

  return (
    <form onSubmit={submit} className="space-y-4 rounded-md border border-gold-soft bg-white p-4 sm:p-5">
      <div>
        <h2 className="font-display text-xl text-forest">{alreadySold ? "Sale" : "Record the sale"}</h2>
        <p className="text-sm text-ink-soft">Enter the memo number first. If the memo already exists, its buyer is filled in for you. The other details of this order are entered by staff.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="memo_no" label="Memo no." value={v.memo_no} onChange={onMemoChange} maxLength={20} autoComplete="off" required
          hint={checking ? "Looking up this memo…" : memo ? "Existing memo found." : v.memo_no.trim() ? "New memo: enter who it is for." : undefined} />
        <Field id="sold_to" label="Sold to" value={v.sold_to} onChange={set("sold_to")} list="buyers-list" maxLength={120} required
          readOnly={!!memo} hint={memo ? `Memo ${memo.memo_no} belongs to ${memo.buyer}. For a different buyer, use a different memo number.` : undefined} />
      </div>
      <datalist id="buyers-list">{buyers.map((b) => <option key={b} value={b} />)}</datalist>

      {memo && (
        <section aria-label={`Memo ${memo.memo_no} overview`} className="rounded-md border border-gold-soft bg-parchment/50 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-medium">Memo {memo.memo_no} · {memo.buyer}</h3>
            <span className={`text-sm font-semibold ${tone}`}>{memo.status}</span>
          </div>
          <ul className="mt-2 divide-y divide-gold-soft text-sm">
            {memo.pieces.map((p, i) => (
              <li key={i} className="flex justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate">{p.kind} · {p.label}{p.isThis && <span className="ml-2 rounded bg-gold-soft px-1.5 text-xs">this piece</span>}</span>
                <span className="shrink-0">{usd.format(p.price)}</span>
              </li>
            ))}
            {memo.pieces.length === 0 && <li className="py-1.5 text-ink-soft">No pieces on this memo yet.</li>}
          </ul>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div><dt className="text-ink-soft">Billed</dt><dd className="font-medium">{usd.format(memo.bill)}</dd></div>
            <div><dt className="text-ink-soft">Paid</dt><dd className="font-medium">{usd.format(memo.paid)}</dd></div>
            <div><dt className="text-ink-soft">Balance due</dt><dd className="font-medium">{usd.format(memo.balance)}</dd></div>
          </dl>
          {after && <p className="mt-3 border-t border-gold-soft pt-2 text-sm">After saving this sale: billed <strong>{usd.format(after.bill)}</strong>, balance due <strong>{usd.format(after.balance)}</strong>.</p>}
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="sale_price" label="Sale price ($)" value={v.sale_price} onChange={set("sale_price")} inputMode="decimal" required />
        <Field id="date_sold" label="Date sold (leave empty for today)" type="date" value={v.date_sold} onChange={set("date_sold")} />
      </div>
      {alreadySold && <p className="text-sm text-ink-soft">To take a sale off this piece, ask staff to use Return this piece.</p>}
      {error && <Notice tone="error">{error}</Notice>}
      {done && <Notice tone="success">Sale saved.</Notice>}
      <Button type="submit" loading={pending}>Save sale</Button>
    </form>
  );
}
