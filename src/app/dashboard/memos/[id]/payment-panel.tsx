"use client";

import { useState, useTransition } from "react";
import { recordPayment, voidPayment } from "@/app/actions/ledger";
import type { ActionResult } from "@/app/actions/auth";
import { Button, Field, Notice } from "@/components/ui";
import { useToast } from "@/components/toast";
import { usd } from "@/lib/ledger";

export function AddPayment({ memoId, balance }: { memoId: string; balance: number }) {
  const toast = useToast();
  const [msg, setMsg] = useState<ActionResult>();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [pending, start] = useTransition();

  if (balance <= 0) {
    return <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">Fully paid. Nothing is due on this memo.</p>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await recordPayment({ memoId, amount, paidOn, key });
          setMsg(r);
          if (r.success) { toast.success(r.success); setAmount(""); setKey(crypto.randomUUID()); }
        });
      }}
      className="space-y-4 rounded-lg bg-parchment/60 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="font-medium">Record a payment</p>
        <p className="text-sm text-ink-soft">
          Balance due <strong className="text-charcoal">{usd.format(balance)}</strong>
          <span aria-hidden> · </span>
          <button type="button" onClick={() => setAmount(balance.toFixed(2))} className="min-h-9 font-medium text-forest underline underline-offset-4">Use full balance</button>
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field id="pay-amount" label="Amount (US$)" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <Field id="pay-date" label="Date paid" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />
        <Button type="submit" loading={pending} className="w-full sm:w-auto">Save payment</Button>
      </div>
      {msg?.error && <Notice tone="error">{msg.error}</Notice>}
    </form>
  );
}

export function VoidPayment({ paymentId }: { paymentId: string }) {
  const toast = useToast();
  const [msg, setMsg] = useState<ActionResult>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-1">
      <Button
        variant="ghost"
        loading={pending}
        onClick={() => {
          const reason = window.prompt("Why is this payment being cancelled?");
          if (reason === null) return;
          start(async () => { const r = await voidPayment({ paymentId, reason }); setMsg(r); if (r.success) toast.success(r.success); });
        }}
      >
        Cancel payment
      </Button>
      {msg?.error && <Notice tone="error">{msg.error}</Notice>}
    </div>
  );
}
