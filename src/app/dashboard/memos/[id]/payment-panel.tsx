"use client";

import { useState, useTransition } from "react";
import { recordPayment, voidPayment } from "@/app/actions/ledger";
import type { ActionResult } from "@/app/actions/auth";
import { Button, Field, Notice } from "@/components/ui";

export function AddPayment({ memoId, balance }: { memoId: string; balance: number }) {
  const [msg, setMsg] = useState<ActionResult>();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await recordPayment({ memoId, amount, paidOn, key });
          setMsg(r);
          if (r.success) { setAmount(""); setKey(crypto.randomUUID()); }
        });
      }}
      className="space-y-3 rounded-md bg-parchment p-4"
    >
      <p className="text-sm font-medium">Record a payment</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field id="pay-amount" label="Amount (US$)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} hint={balance > 0 ? `Balance due: ${balance.toFixed(2)}` : "Nothing is due."} required />
        <Field id="pay-date" label="Date paid" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />
        <Button type="submit" loading={pending} disabled={balance <= 0}>Save payment</Button>
      </div>
      {msg?.error && <Notice tone="error">{msg.error}</Notice>}
      {msg?.success && <Notice tone="success">{msg.success}</Notice>}
    </form>
  );
}

export function VoidPayment({ paymentId }: { paymentId: string }) {
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
          start(async () => setMsg(await voidPayment({ paymentId, reason })));
        }}
      >
        Cancel payment
      </Button>
      {msg?.error && <Notice tone="error">{msg.error}</Notice>}
    </div>
  );
}
