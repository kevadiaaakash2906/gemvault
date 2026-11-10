"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

type Tone = "success" | "error";
type Item = { id: number; tone: Tone; text: string; leaving: boolean };
type Api = { success: (text: string) => void; error: (text: string) => void };

const Ctx = createContext<Api | null>(null);
const NOOP: Api = { success: () => {}, error: () => {} };

/** Small confirmation messages. Safe to call anywhere: outside the provider it does nothing. */
export function useToast(): Api {
  return useContext(Ctx) ?? NOOP;
}

const EXIT_MS = 180;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const next = useRef(1);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const all = timers.current;
    return () => { all.forEach(clearTimeout); all.clear(); };
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((cur) => cur.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    const h = setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), EXIT_MS);
    timers.current.add(h);
  }, []);

  const push = useCallback((tone: Tone, text: string) => {
    const id = next.current++;
    setItems((cur) => [...cur.slice(-2), { id, tone, text, leaving: false }]);   // at most three on screen
    const h = setTimeout(() => dismiss(id), tone === "error" ? 6000 : 3500);
    timers.current.add(h);
  }, [dismiss]);

  const api = useMemo<Api>(() => ({ success: (t) => push("success", t), error: (t) => push("error", t) }), [push]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end print:hidden">
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={clsx(
              "pointer-events-auto flex max-w-sm items-center gap-3 rounded-md border px-4 py-3 text-left text-sm font-medium shadow-lg",
              t.leaving ? "toast-out" : "toast-in",
              t.tone === "success" ? "border-forest/30 bg-forest text-ivory" : "border-danger/40 bg-red-50 text-danger",
            )}
          >
            {t.tone === "success" ? (
              <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-gold-soft" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={24} className="check-draw" />
              </svg>
            ) : (
              <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-danger text-xs font-bold text-white">!</span>
            )}
            <span>{t.text}</span>
          </button>
        ))}
      </div>
    </Ctx.Provider>
  );
}
