"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMemo, deleteReturn } from "@/app/actions/ledger";
import { Button, Field, Notice } from "@/components/ui";

/** "Delete permanently" for a memo or a return. Needs the person's own login password. */
export function DeletePermanently({ kind, id, title, lines, redirectTo, blocked }: {
  kind: "memo" | "return"; id: string; title: string; lines: string[]; redirectTo: string; blocked?: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    start(async () => {
      const r = await (kind === "memo" ? deleteMemo : deleteReturn)({ id, password });
      setPassword("");
      if (r.error) setError(r.error);
      else router.push(redirectTo);
    });
  }

  return (
    <details className="rounded-md border border-danger/40 bg-white">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold text-danger">{title}</summary>
      <div className="space-y-4 border-t border-danger/30 p-4">
        <ul className="list-disc space-y-1 pl-5 text-sm">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
        {blocked ? <Notice tone="error">{blocked}</Notice> : (
          <form onSubmit={submit} className="space-y-4" autoComplete="off">
            <Field id={`delete-${kind}-password`} label="Your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
              hint="Your own login password. It confirms this is not a mistake." required />
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" variant="danger" loading={pending}>Delete permanently</Button>
          </form>
        )}
      </div>
    </details>
  );
}
