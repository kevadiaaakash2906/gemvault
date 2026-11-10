/** Splits a formatted figure such as "+$35,048.59" so a number can count up to it. Returns null for text that is not a figure ("Not sold"). */
export type Figure = { prefix: string; target: number; places: number; suffix: string };

export function parseFigure(value: string): Figure | null {
  const m = /^([^\d]*)(\d[\d,]*)(\.\d+)?(.*)$/.exec(value);
  if (!m) return null;
  const [, prefix, whole, dec, suffix] = m;
  return { prefix, target: Number(whole.replace(/,/g, "") + (dec ?? "")), places: dec ? dec.length - 1 : 0, suffix };
}

/** One step of the count: the figure's own prefix and suffix around the number so far. */
export function formatFigure(f: Figure, n: number): string {
  const fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: f.places, maximumFractionDigits: f.places });
  return `${f.prefix}${fmt.format(n)}${f.suffix}`;
}
