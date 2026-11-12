"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendMoney } from "@/app/actions/money";
import { Button, Field, Notice, SelectField } from "@/components/ui";
import { useToast } from "@/components/toast";

/** A seller records money they have sent to a staff member. It waits until that person accepts it. */
export function MoneySendForm({ recipients }: { recipients: { user_id: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [to, setTo] = useState(recipients.length === 1 ? recipients[0].user_id : "");
  const [amount, setAmount] = useState("");
  const [sentOn, setSentOn] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (recipients.length === 0) return <Notice tone="error">There is no staff member to send money to yet. Ask the owner to add one under Team.</Notice>;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    start(async () => {
      const r = await sendMoney({ to, amount, sent_on: sentOn, note });
      if (r.error) { setError(r.error); return; }
      toast.success(r.success ?? "Sent.");
      setAmount(""); setNote(""); setSentOn("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-md border border-gold-soft bg-white p-4 sm:p-5" autoComplete="off">
      <div>
        <h2 className="font-display text-xl text-forest">Money I sent</h2>
        <p className="text-sm text-ink-soft">Enter the amount you transferred. It stays <strong>Waiting</strong> until the staff member accepts it. Only then is it logged.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField id="money-to" label="Sent to" value={to} onChange={(e) => setTo(e.target.value)} required>
          {recipients.length > 1 && <option value="">Choose…</option>}
          {recipients.map((r) => <option key={r.user_id} value={r.user_id}>{r.name}</option>)}
        </SelectField>
        <Field id="money-amount" label="Amount ($)" inputMode="decimal" placeholder="500.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <Field id="money-date" label="Date sent (leave empty for today)" type="date" value={sentOn} onChange={(e) => setSentOn(e.target.value)} />
        <Field id="money-note" label="Note (optional)" placeholder="For example: Zelle, cash, reference number" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" loading={pending}>Send for acceptance</Button>
    </form>
  );
}
