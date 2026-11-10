/** Grey placeholders shown while a page loads, shaped like the real page so nothing jumps when the data arrives. */
const BLOCK = "animate-pulse rounded bg-parchment";

export function ListPageSkeleton({ cards = 0, rows = 8, columns = 8 }: { cards?: number; rows?: number; columns?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-5">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2"><div className={`h-9 w-44 ${BLOCK}`} /><div className={`h-5 w-28 ${BLOCK}`} /></div>
        <div className="flex gap-2"><div className={`h-11 w-28 rounded-md ${BLOCK}`} /><div className={`h-11 w-32 rounded-md ${BLOCK}`} /></div>
      </div>
      {cards > 0 && (
        <div className={`grid grid-cols-2 gap-3 ${cards >= 5 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
          {Array.from({ length: cards }, (_, i) => <div key={i} className={`h-28 rounded-md ${BLOCK}`} />)}
        </div>
      )}
      <div className={`h-24 rounded-md ${BLOCK}`} />
      <div className="hidden overflow-hidden rounded-md border border-gold-soft bg-white lg:block">
        <div className="flex gap-3 bg-parchment px-3 py-3">{Array.from({ length: columns }, (_, i) => <div key={i} className="h-4 flex-1 rounded bg-white/70" />)}</div>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex gap-3 border-t border-gold-soft px-3 py-3.5">
            {Array.from({ length: columns }, (_, c) => <div key={c} className={`h-4 flex-1 ${BLOCK}`} />)}
          </div>
        ))}
      </div>
      <div className="space-y-3 lg:hidden">{Array.from({ length: 4 }, (_, i) => <div key={i} className={`h-24 rounded-md ${BLOCK}`} />)}</div>
    </div>
  );
}
