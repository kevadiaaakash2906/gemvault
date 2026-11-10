import clsx from "clsx";

/** A thin bar showing how much of a bill has been paid. It fills in from the left when it appears. */
export function PaidBar({ paid, billed, label }: { paid: number; billed: number; label: string }) {
  const pct = billed > 0 ? Math.max(0, Math.min(100, (paid / billed) * 100)) : 0;
  const rounded = Math.round(pct);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={rounded}
      aria-valuetext={`${rounded}% paid`}
      className="h-2 w-full overflow-hidden rounded-full bg-parchment"
    >
      <div className={clsx("bar-grow h-full rounded-full", pct >= 100 ? "bg-emerald-600" : "bg-gold")} style={{ width: `${pct}%` }} />
    </div>
  );
}
