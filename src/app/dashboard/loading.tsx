export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="max-w-4xl space-y-4">
      <span className="sr-only">Loading…</span>
      <div className="h-9 w-48 animate-pulse rounded bg-parchment" />
      <div className="h-5 w-72 animate-pulse rounded bg-parchment" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-md bg-parchment" />)}
      </div>
      <div className="h-64 animate-pulse rounded-md bg-parchment" />
    </div>
  );
}
