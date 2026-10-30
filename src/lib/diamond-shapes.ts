/** Diamond shapes, split into a Shape and a Style (ported from the old Vinere site). The saved value is the full text, e.g. "Oval Bezel East/West". */
export type ShapeVariant = { value: string; label: string };

const EW = "East/West", NS = "North/South";
const fancy = (shape: string): ShapeVariant[] => [
  { value: `${shape} ${EW}`, label: EW }, { value: `${shape} ${NS}`, label: NS },
  { value: `${shape} Bezel ${EW}`, label: `Bezel ${EW}` }, { value: `${shape} Bezel ${NS}`, label: `Bezel ${NS}` },
];

export const DIAMOND_SHAPES: Record<string, ShapeVariant[]> = {
  Round: [{ value: "Round", label: "Standard" }, { value: "Round Bezel", label: "Bezel" }],
  Oval: fancy("Oval"),
  Marquise: fancy("Marquise"),
  Emerald: fancy("Emerald"),
  Pear: fancy("Pear"),
  Radiant: fancy("Radiant"),
  Cushion: [{ value: "Cushion", label: "Standard" }, { value: "Cushion Bezel", label: "Bezel" }, { value: "Cushion Half Bezel", label: "Half Bezel" }],
  "Fancy Mix": [{ value: "Fancy Mix", label: "Standard" }, { value: "Fancy Mix Bezel", label: "Bezel" }],
};

/** Shown when a saved value fits none of the shapes above (for example an old free-typed value), so it is never lost. */
export const OTHER_SHAPE = "Other";

/**
 * Which Shape a saved value belongs to. Exact matches first; then values that start with a shape name
 * ("Oval" or "Emerald Bezel" typed by hand in the old sheet). Null when empty or unrecognised.
 */
export function findShapeBase(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  for (const [base, variants] of Object.entries(DIAMOND_SHAPES)) if (variants.some((x) => x.value === v)) return base;
  const lower = v.toLowerCase();
  const hit = Object.keys(DIAMOND_SHAPES).filter((b) => lower === b.toLowerCase() || lower.startsWith(b.toLowerCase() + " "));
  return hit.sort((a, b) => b.length - a.length)[0] ?? null;
}

/** The Style choices for a Shape. A saved value that is not on the list is kept as an extra "As entered" choice. */
export function shapeVariants(base: string, value: string | null | undefined): ShapeVariant[] {
  const v = (value ?? "").trim();
  const list = DIAMOND_SHAPES[base] ?? [];
  if (base === OTHER_SHAPE) return v ? [{ value: v, label: v }] : [];
  return v && findShapeBase(v) === base && !list.some((x) => x.value === v) ? [...list, { value: v, label: `As entered: ${v}` }] : list;
}
