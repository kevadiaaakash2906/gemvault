"use client";

import { useRef, useState, useTransition } from "react";
import { Columns3 } from "lucide-react";
import { saveColumns } from "@/app/actions/columns";
import { useToast } from "@/components/toast";
import { hiddenCss, type ColumnDef, type TableKey } from "@/lib/columns";

/** "Columns" menu: tick the columns you want to see. Each change is saved to your account straight away. */
export function ColumnPicker({ table, columns, initialHidden }: { table: TableKey; columns: ColumnDef[]; initialHidden: string[] }) {
  const [hidden, setHidden] = useState<string[]>(initialHidden);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string }>();
  const [pending, start] = useTransition();
  const latest = useRef(0);
  const toast = useToast();

  const update = (next: string[]) => {
    setHidden(next);
    setStatus(undefined);
    const mine = ++latest.current;
    start(async () => {
      const r = await saveColumns({ table, hidden: next });
      if (mine !== latest.current) return;   // a newer change has already been sent
      if (r.error) setStatus({ tone: "error", text: r.error });
      else toast.success("Column layout saved");
    });
  };
  const toggle = (key: string) => update(hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key]);
  const shown = columns.filter((c) => !hidden.includes(c.key)).length;

  return (
    <>
      <style>{hiddenCss(table, hidden)}</style>
      <details className="relative">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md border border-gold-soft bg-white px-4 text-sm font-semibold hover:bg-parchment [&::-webkit-details-marker]:hidden">
          <Columns3 className="size-4" aria-hidden /> Columns
          {hidden.length > 0 && <span className="rounded bg-parchment px-1.5 text-xs">{shown}/{columns.length}</span>}
        </summary>
        <div role="group" aria-label="Choose columns" className="pop-in absolute right-0 z-30 mt-2 w-72 max-w-[90vw] space-y-3 rounded-md border border-gold-soft bg-white p-4 shadow-lg">
          <p className="text-sm text-ink-soft">Tick the columns to show. Your choice is saved to your account and follows you to any computer.</p>
          <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
            {columns.map((c) => (
              <li key={c.key}>
                <label className="flex min-h-9 cursor-pointer items-center gap-2">
                  <input type="checkbox" className="size-4" checked={c.locked || !hidden.includes(c.key)} disabled={c.locked} onChange={() => toggle(c.key)} />
                  <span>{c.label}{c.locked ? " (always shown)" : ""}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2">
            <button type="button" disabled={hidden.length === 0 || pending} onClick={() => update([])} className="min-h-9 rounded-md border border-gold-soft px-3 text-sm font-medium hover:bg-parchment disabled:opacity-50">Show all</button>
            <p role="status" aria-live="polite" className={`text-xs ${status?.tone === "error" ? "text-danger" : "text-ink-soft"}`}>{pending ? "Saving…" : status?.text ?? ""}</p>
          </div>
        </div>
      </details>
    </>
  );
}
