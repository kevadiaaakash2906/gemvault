"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { returnPiece } from "@/app/actions/ledger";
import { Button, Field, Notice } from "@/components/ui";
import { usd } from "@/lib/ledger";
import { refundDue } from "@/lib/reports";

/** "Return this piece" for a sold order or trade. Needs the person's own login password. */
export function ReturnPiece({ kind, id, label, buyer, salePrice, memoPaid, memoBill }: {
  kind: "order" | "trade"; id: string; label: string; buyer: string; salePrice: number; memoPaid: number; memoBill: number;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [returnedOn, setReturnedOn] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const refund = refundDue(memoPaid, memoBill, salePrice);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    start(async () => {
      const r = await returnPiece({ kind, id, reason, password, returnedOn });
      setPassword("");
      if (r.error) setError(r.error);
      else router.push(`/dashboard/returns?done=${r.id}`);
    });
  }

  return (
    <details className="rounded-md border border-gold-soft bg-white">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold text-forest">Return this piece</summary>
      <form onSubmit={submit} className="space-y-4 border-t border-gold-soft p-4" autoComplete="off">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>The sale ({usd.format(salePrice)} to {buyer}) is taken out of sales and profit.</li>
          <li>{label} goes back into stock.</li>
          <li>
            {refund > 0
              ? <><strong>{usd.format(refund)} must be handed back to {buyer}.</strong> They have paid {usd.format(memoPaid)} on this memo, more than the reduced bill of {usd.format(memoBill - salePrice)}. It is recorded as a refund.</>
              : <>No refund is needed: {buyer} has not paid more than the reduced bill.</>}
          </li>
          <li>The return is kept in the Returns list and the audit log.</li>
        </ul>
        <Field id="return-reason" label="Reason for the return" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} required />
        <Field id="return-date" label="Date returned (leave empty for today)" type="date" value={returnedOn} onChange={(e) => setReturnedOn(e.target.value)} />
        <Field id="return-password" label="Your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
          hint="Your own login password. It confirms this return is not a mistake." required />
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" variant="danger" loading={pending}>Confirm return</Button>
      </form>
    </details>
  );
}
