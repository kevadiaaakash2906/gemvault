import clsx from "clsx";
import { CountUp } from "@/components/count-up";

export type Kpi = { label: string; value: string; sub: string; tone?: "good" | "warn" | "bad" };
const TONE = { good: "text-emerald-700", warn: "text-amber-600", bad: "text-danger" } as const;

/** A row of summary cards at the top of a page. No card is ever left alone on a row: a lone last card on a phone fills the whole row. */
export function KpiStrip({ cards, label }: { cards: Kpi[]; label: string }) {
  const n = cards.length;
  const wide = n % 3 === 0 || n === 5 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  return (
    <dl aria-label={label} className={clsx("grid grid-cols-2 gap-3", wide)}>
      {cards.map((c, i) => (
        <div key={c.label} className={clsx("rounded-md border border-gold-soft bg-white p-4", n % 2 === 1 && i === n - 1 && "col-span-2 lg:col-span-1")}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{c.label}</dt>
          <dd className={clsx("mt-1 font-display text-xl [overflow-wrap:anywhere] sm:text-3xl", c.tone ? TONE[c.tone] : "text-forest")}><CountUp value={c.value} /></dd>
          <dd className="mt-0.5 text-sm text-ink-soft">{c.sub}</dd>
        </div>
      ))}
    </dl>
  );
}
