/** Which page numbers to show: first, last, and two either side of the current one, with "…" for gaps. */
export function pageWindow(page: number, pages: number): (number | "…")[] {
  const keep = new Set<number>([1, pages]);
  for (let i = page - 2; i <= page + 2; i++) if (i >= 1 && i <= pages) keep.add(i);
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev === 2) out.push(prev + 1);
    else if (n - prev > 2) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}
