import clsx from "clsx";

export type Kpi = { label: string; value: string; sub: string; tone?: "good" | "warn" | "bad" };
const TONE = { good: "text-emerald-700", warn: "text-amber-600", bad: "text-danger" } as const;

/** A row of summary cards at the top of a page. */
export function KpiStrip({ cards, label }: { cards: Kpi[]; label: string }) {
  return (
    <dl aria-label={label} className={clsx("grid grid-cols-2 gap-3", cards.length >= 5 ? "lg:grid-cols-3" : "lg:grid-cols-4")}>
      {cards.map((c) => (
        <div key={c.label} className="rounded-md border border-gold-soft bg-white p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{c.label}</dt>
          <dd className={clsx("mt-1 font-display text-xl [overflow-wrap:anywhere] sm:text-3xl", c.tone ? TONE[c.tone] : "text-forest")}>{c.value}</dd>
          <dd className="mt-0.5 text-sm text-ink-soft">{c.sub}</dd>
        </div>
      ))}
    </dl>
  );
}
