"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRecord } from "@/app/actions/ledger";
import { Button, Notice } from "@/components/ui";

export function DeleteButton({ kind, id, redirectTo, label }: { kind: "order" | "trade" | "expense"; id: string; redirectTo: string; label: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="danger"
        loading={pending}
        onClick={() =>
          window.confirm(`${label}? A copy is kept in the audit log, but it will disappear from your lists.`) &&
          start(async () => {
            const r = await deleteRecord({ kind, id });
            if (r.error) setError(r.error);
            else router.push(redirectTo);
          })
        }
      >
        {label}
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
