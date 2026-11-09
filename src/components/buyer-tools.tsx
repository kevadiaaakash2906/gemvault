"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mergeBuyers, renameBuyer } from "@/app/actions/buyers";
import { Button, Field, Notice } from "@/components/ui";

/** Owner only: rename a buyer. */
export function RenameBuyer({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined); setDone(false);
        start(async () => {
          const r = await renameBuyer({ id, name: value });
          if (r.error) setError(r.error); else { setDone(true); router.refresh(); }
        });
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="min-w-[14rem] flex-1"><Field id="buyer-name" label="Buyer name" value={value} onChange={(e) => { setValue(e.target.value); setDone(false); }} maxLength={120} required /></div>
      <Button type="submit" variant="ghost" loading={pending} disabled={value.trim() === name}>Rename</Button>
      {error && <div className="w-full"><Notice tone="error">{error}</Notice></div>}
      {done && <div className="w-full"><Notice tone="success">Renamed.</Notice></div>}
    </form>
  );
}

/** Owner only: fold a duplicate buyer into the one to keep. All of its memos move across. */
export function MergeBuyers({ from, into }: { from: { id: string; name: string }; into: { id: string; name: string } }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        loading={pending}
        onClick={() =>
          window.confirm(`Merge "${from.name}" into "${into.name}"?\n\nAll memos of "${from.name}" move to "${into.name}" and the name "${from.name}" is removed. This cannot be undone (a record is kept in the audit log).`) &&
          start(async () => {
            setError(undefined);
            const r = await mergeBuyers({ from: from.id, into: into.id });
            if (r.error) setError(r.error); else router.refresh();
          })
        }
      >
        Keep “{into.name}”
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
