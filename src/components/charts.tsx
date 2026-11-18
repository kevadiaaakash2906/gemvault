import { monthLabel } from "@/lib/reports";
import { usd } from "@/lib/ledger";

export type MonthPoint = { label: string; sales: number; profit: number };
export type BarRow = { key: string; name: string; value: number; note?: string };

const compact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

/** "Aug ’26" for a month start date. */
export const shortMonth = (m: string | null | undefined) => monthLabel(m).replace(/ 20(\d\d)$/, " ’$1");

type Dims = { W: number; H: number; L: number; R: number; T: number; B: number };

function ChartSvg({ data, label, d, short, className }: { data: MonthPoint[]; label: string; d: Dims; short?: boolean; className: string }) {
  const { W, H, L, R, T, B } = d;
  const innerW = W - L - R, innerH = H - T - B;
  const values = data.flatMap((p) => [p.sales, p.profit]);
  const hi = Math.max(0, ...values);
  const lo = Math.min(0, ...values);
  const span = hi - lo || 1;
  const y = (v: number) => T + ((hi - v) / span) * innerH;
  const zero = y(0);
  const group = innerW / data.length;
  const barW = Math.min(22, group * 0.32);
  const ticks = [...new Set([hi, 0, lo])];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className={className}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className={t === 0 ? "stroke-ink-soft/60" : "stroke-gold-soft"} strokeWidth={1} />
          <text x={L - 6} y={y(t) + 3} textAnchor="end" className="fill-ink-soft text-[10px]">{compact.format(Math.abs(t) < 0.5 ? 0 : t)}</text>
        </g>
      ))}
      {data.map((p, i) => {
        const cx = L + group * i + group / 2;
        const bar = (v: number, x: number, cls: string, what: string) => (
          <rect x={x} y={v >= 0 ? y(v) : zero} width={barW} height={Math.max(1, Math.abs(y(v) - zero))} rx={2} className={cls}>
            <title>{`${p.label} ${what}: ${usd.format(v)}`}</title>
          </rect>
        );
        return (
          <g key={`${p.label}-${i}`}>
            {bar(p.sales, cx - barW - 1, "fill-gold", "sales")}
            {bar(p.profit, cx + 1, p.profit < 0 ? "fill-danger" : "fill-forest", "net profit")}
            <text x={cx} y={H - 8} textAnchor="middle" className="fill-ink-soft text-[10px]">{short ? p.label.slice(0, 3) : p.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Two bars per month: sales (gold) and net profit (green, red when it is a loss). Plain SVG, so it needs no chart library.
 *  A narrow version with 3-letter month names is drawn on phones, so the whole chart fits without sideways scrolling. */
export function SalesProfitChart({ data, label }: { data: MonthPoint[]; label: string }) {
  if (data.length === 0) return <p className="py-8 text-center text-ink-soft">No sales yet.</p>;
  return (
    <div className="mt-3 min-w-0">
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-hidden>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-gold" /> Sales</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-forest" /> Net profit <span className="text-ink-soft">(red when a loss)</span></li>
      </ul>
      <ChartSvg data={data} label={label} d={{ W: 360, H: 220, L: 44, R: 6, T: 10, B: 26 }} short className="h-auto w-full sm:hidden" />
      <ChartSvg data={data} label={label} d={{ W: 720, H: 240, L: 52, R: 8, T: 12, B: 28 }} className="hidden h-auto w-full sm:block" />
      <table className="sr-only">
        <caption>{label}</caption>
        <thead><tr><th scope="col">Month</th><th scope="col">Sales</th><th scope="col">Net profit</th></tr></thead>
        <tbody>{data.map((p, i) => <tr key={`${p.label}-${i}`}><th scope="row">{p.label}</th><td>{usd.format(p.sales)}</td><td>{usd.format(p.profit)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

/** Horizontal bars for a short ranked list, such as the top buyers. */
export function TopBars({ rows }: { rows: BarRow[] }) {
  if (rows.length === 0) return <p className="py-6 text-center text-ink-soft">No sales yet.</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="mt-3 space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{r.name}</span>
            <span className="shrink-0 font-medium">{usd.format(r.value)}</span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-parchment" aria-hidden>
            <div className="bar-grow h-full rounded-full bg-gold" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
          {r.note && <p className="mt-0.5 text-xs text-ink-soft">{r.note}</p>}
        </li>
      ))}
    </ul>
  );
}
