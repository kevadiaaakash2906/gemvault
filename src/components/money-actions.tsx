"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/app/actions/auth";
import { acceptMoney, cancelMoney, deleteMoney, rejectMoney, reverseMoney } from "@/app/actions/money";
import { Button, Field, Notice } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { MoneyStatus } from "@/lib/money";

type Mode = "reject" | "cancel" | "reverse" | "delete";

/** The buttons on one transfer: accept or reject (the person it was sent to), cancel (the sender, or the owner), reverse and delete (the owner). */
export function MoneyActions({ id, status, isReceiver, isSender, isOwner }: { id: string; status: MoneyStatus; isReceiver: boolean; isSender: boolean; isOwner: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<Mode | null>(null);
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const canAccept = status === "pending" && isReceiver;
  const canCancel = status === "pending" && (isSender || isOwner);
  const canReverse = status === "accepted" && isOwner;
  const canDelete = isOwner;
  if (!canAccept && !canCancel && !canReverse && !canDelete) return null;
  const reasonNeeded = mode === "reject" || mode === "reverse" || (mode === "cancel" && !isSender);

  function run(fn: (v: unknown) => Promise<ActionResult>, payload: unknown) {
    setError(undefined);
    start(async () => {
      const r = await fn(payload);
      if (r.error) { setError(r.error); return; }
      toast.success(r.success ?? "Done.");
      setMode(null); setReason(""); setPassword("");
      router.refresh();
    });
  }
  const confirm = () => (mode === "delete" ? run(deleteMoney, { id, password }) : run(mode === "reject" ? rejectMoney : mode === "reverse" ? reverseMoney : cancelMoney, { id, reason }));
  const labels = { reject: "Reject", cancel: "Cancel transfer", reverse: "Reverse", delete: "Delete from ledger" } as const;

  return (
    <div className="space-y-2">
      {!mode && (
        <div className="flex flex-wrap gap-2">
          {canAccept && <Button onClick={() => run(acceptMoney, { id })} loading={pending}>Accept</Button>}
          {canAccept && <Button variant="ghost" onClick={() => setMode("reject")}>Reject</Button>}
          {canCancel && <Button variant="ghost" onClick={() => setMode("cancel")}>Cancel</Button>}
          {canReverse && <Button variant="ghost" onClick={() => setMode("reverse")}>Reverse</Button>}
          {canDelete && <Button variant="ghost" onClick={() => setMode("delete")}>Delete</Button>}
        </div>
      )}
      {mode && (
        <div className="space-y-2 rounded-md border border-gold-soft bg-parchment/50 p-3">
          {mode === "delete" ? (
            <>
              <p className="text-sm">Delete this transfer from the ledger? It disappears from the list and the totals, so mistakes and tests are not logged. A copy is kept in the audit log.</p>
              <Field id={`pw-${id}`} label="Your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </>
          ) : reasonNeeded
            ? <Field id={`reason-${id}`} label={mode === "reject" ? "Why? (for example: not received)" : "Reason"} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
            : <p className="text-sm">Cancel this transfer? It will not be logged.</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={confirm} loading={pending}>{labels[mode]}</Button>
            <Button variant="ghost" onClick={() => { setMode(null); setReason(""); setPassword(""); setError(undefined); }}>Back</Button>
          </div>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
