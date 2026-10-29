"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveOrderSale } from "@/app/actions/ledger";
import { Button, Field, Notice } from "@/components/ui";

/** The only part of an order a seller can change: who it was sold to, the memo, the price and the date. */
export function OrderSaleForm({ id, initial, buyers, alreadySold }: {
  id: string; initial: { sold_to: string; memo_no: string; sale_price: string; date_sold: string }; buyers: string[]; alreadySold: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => { setV({ ...v, [k]: e.target.value }); setDone(false); };

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

  return (
    <form onSubmit={submit} className="space-y-4 rounded-md border border-gold-soft bg-white p-4 sm:p-5">
      <div>
        <h2 className="font-display text-xl text-forest">{alreadySold ? "Sale" : "Record the sale"}</h2>
        <p className="text-sm text-ink-soft">Fill in all of Sold to, Memo and Sale price. The other details of this order are entered by staff.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="sold_to" label="Sold to" value={v.sold_to} onChange={set("sold_to")} list="buyers-list" maxLength={120} required />
        <Field id="memo_no" label="Memo no." value={v.memo_no} onChange={set("memo_no")} maxLength={20} required />
        <Field id="sale_price" label="Sale price ($)" value={v.sale_price} onChange={set("sale_price")} inputMode="decimal" required />
        <Field id="date_sold" label="Date sold (leave empty for today)" type="date" value={v.date_sold} onChange={set("date_sold")} />
      </div>
      <datalist id="buyers-list">{buyers.map((b) => <option key={b} value={b} />)}</datalist>
      {alreadySold && <p className="text-sm text-ink-soft">To take a sale off this piece, ask staff to use Return this piece.</p>}
      {error && <Notice tone="error">{error}</Notice>}
      {done && <Notice tone="success">Sale saved.</Notice>}
      <Button type="submit" loading={pending}>Save sale</Button>
    </form>
  );
}
