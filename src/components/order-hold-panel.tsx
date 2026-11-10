"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearOrderHold, setOrderHold } from "@/app/actions/holds";
import { Button, Field, Notice } from "@/components/ui";
import { useToast } from "@/components/toast";
import { fmtDate } from "@/lib/ledger";

export type Hold = { held_by: string; held_since: string; note: string | null };

/** For an unsold piece: record that a customer has it (on approval, memo, consignment) without entering a fake sale. */
export function OrderHoldPanel({ orderId, hold, buyers }: { orderId: string; hold: Hold | null; buyers: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [who, setWho] = useState("");
  const [since, setSince] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ error?: string; success?: string }>) => start(async () => {
    setError(undefined);
    const r = await fn();
    if (r.error) setError(r.error); else { toast.success(r.success ?? "Saved."); router.refresh(); }
  });

  if (hold) {
    return (
      <section aria-labelledby="out-with" className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4 sm:p-5">
        <h2 id="out-with" className="font-display text-xl text-forest">Out with {hold.held_by}</h2>
        <p className="text-sm">Since {fmtDate(hold.held_since)}. Not sold: it still counts as stock until you record a sale.{hold.note ? ` Note: ${hold.note}` : ""}</p>
        <p className="text-sm text-ink-soft">When it is sold, fill in the Sale section above and save. This marker then goes away by itself.</p>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="button" variant="ghost" loading={pending} onClick={() => run(() => clearOrderHold({ order_id: orderId }))}>It came back: put it back in stock</Button>
      </section>
    );
  }
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); run(() => setOrderHold({ order_id: orderId, held_by: who, since, note })); }}
      className="space-y-4 rounded-md border border-gold-soft bg-white p-4 sm:p-5"
    >
      <div>
        <h2 className="font-display text-xl text-forest">Out with a customer (not sold)</h2>
        <p className="text-sm text-ink-soft">Use this when a customer has the piece to look at or sell. It is not a sale, so it stays out of revenue, profit and the amounts owed.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="held_by" label="Who has it" value={who} onChange={(e) => setWho(e.target.value)} list="hold-buyers" maxLength={120} required autoComplete="off" />
        <Field id="held_since" label="Since (empty = today)" type="date" value={since} onChange={(e) => setSince(e.target.value)} />
      </div>
      <datalist id="hold-buyers">{buyers.map((b) => <option key={b} value={b} />)}</datalist>
      <Field id="held_note" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" loading={pending}>Mark as out</Button>
    </form>
  );
}
