"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buildQuery } from "@/lib/ledger";

type Props = { q: string; status?: string; type?: string; statuses: string[]; types: string[]; sort?: string; dir?: string };

/** Orders filters. Typing searches live (after a short pause); the dropdowns apply as soon as you change them. */
export function OrderFilters({ q, status, type, statuses, types, sort, dir }: Props) {
  const router = useRouter();
  const [, start] = useTransition();
  const [text, setText] = useState(q);
  const [st, setSt] = useState(status ?? "");
  const [ty, setTy] = useState(type ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const go = (next: { q: string; status: string; type: string }) =>
    start(() => router.replace(`/dashboard/orders${buildQuery({ q: next.q.trim() || undefined, status: next.status || undefined, type: next.type || undefined, sort, dir })}`));

  return (
    <form role="search" onSubmit={(e) => e.preventDefault()} className="grid gap-3 rounded-md border border-gold-soft bg-white p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
      <div>
        <label htmlFor="q" className="block text-sm font-medium">Search</label>
        <input id="q" name="q" value={text} autoComplete="off" placeholder="Style no, customer, sold to, memo"
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => go({ q: v, status: st, type: ty }), 300);
          }}
          className="mt-1 min-h-11 w-full rounded-md border border-gold-soft px-3" />
      </div>
      <div>
        <label htmlFor="status" className="block text-sm font-medium">Payment status</label>
        <select id="status" name="status" value={st} className="mt-1 min-h-11 w-full rounded-md border border-gold-soft bg-white px-3"
          onChange={(e) => { setSt(e.target.value); clearTimeout(timer.current); go({ q: text, status: e.target.value, type: ty }); }}>
          <option value="">All</option>{statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="type" className="block text-sm font-medium">Jewelry type</label>
        <select id="type" name="type" value={ty} className="mt-1 min-h-11 w-full rounded-md border border-gold-soft bg-white px-3"
          onChange={(e) => { setTy(e.target.value); clearTimeout(timer.current); go({ q: text, status: st, type: e.target.value }); }}>
          <option value="">All</option>{types.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
    </form>
  );
}
