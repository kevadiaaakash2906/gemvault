import Link from "next/link";
import clsx from "clsx";
import { buildQuery } from "@/lib/ledger";
import { pageWindow } from "@/lib/pagination";

const box = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border px-3 text-sm";

/** First / Previous / page numbers / Next / Last, and a "Go to page" box. Works without JavaScript. */
export function Pagination({ basePath, params, page, pages }: { basePath: string; params: Record<string, string | undefined>; page: number; pages: number }) {
  if (pages <= 1) return null;
  const current = Math.min(page, pages);
  const href = (n: number) => `${basePath}${buildQuery({ ...params, page: n > 1 ? String(n) : undefined })}`;
  const step = (symbol: string, label: string, n: number, enabled: boolean) =>
    enabled ? (
      <Link href={href(n)} className={clsx(box, "border-gold-soft bg-white hover:bg-parchment")}>
        <span aria-hidden>{symbol}</span><span className="sr-only">{label}</span>
      </Link>
    ) : (
      <span aria-disabled="true" className={clsx(box, "border-gold-soft bg-white opacity-40")}>
        <span aria-hidden>{symbol}</span><span className="sr-only">{label} (not available)</span>
      </span>
    );

  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-ink-soft">Page {current} of {pages}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {step("«", "First page", 1, current > 1)}
        {step("‹", "Previous page", current - 1, current > 1)}
        <div className="hidden items-center gap-1.5 sm:flex">
          {pageWindow(current, pages).map((n, i) =>
            n === "…" ? <span key={`gap-${i}`} aria-hidden className="px-1 text-ink-soft">…</span> : (
              <Link key={n} href={href(n)} aria-current={n === current ? "page" : undefined} aria-label={`Page ${n}`}
                className={clsx(box, n === current ? "border-forest bg-forest font-semibold text-ivory" : "border-gold-soft bg-white hover:bg-parchment")}>{n}</Link>
            ),
          )}
        </div>
        {step("›", "Next page", current + 1, current < pages)}
        {step("»", "Last page", pages, current < pages)}
      </div>
      <form method="get" action={basePath} className="flex items-center gap-2">
        {Object.entries(params).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <label htmlFor="go-to-page" className="text-ink-soft">Go to page</label>
        <input id="go-to-page" name="page" type="number" inputMode="numeric" min={1} max={pages} required defaultValue={current}
          className="min-h-11 w-20 rounded-md border border-gold-soft bg-white px-3" />
        <button className="min-h-11 rounded-md bg-forest px-4 text-sm font-semibold text-ivory hover:bg-forest-deep">Go</button>
      </form>
    </nav>
  );
}
