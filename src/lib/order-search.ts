/** Matching used by the live search on Orders. Runs in the browser. */

/** IN CT box: "5.15" matches any value containing it; "3-5" matches 3 up to 5. */
export function matchCt(value: number | null, input: string): boolean {
  const t = input.trim();
  if (!t) return true;
  if (value === null || value === undefined) return false;
  const range = /^(\d*\.?\d+)\s*[-–]\s*(\d*\.?\d+)$/.exec(t);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    return value >= Math.min(a, b) && value <= Math.max(a, b);
  }
  return String(value).includes(t);
}

/** Every word typed must appear in at least one of the fields (any order, any letter case). */
export function matchText(fields: (string | null | undefined)[], q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = fields.map((f) => (f ?? "").toLowerCase()).join("\n");
  return words.every((w) => hay.includes(w));
}
