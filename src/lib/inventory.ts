export const PAGE_SIZE = 20;
export const SORTS = ["name", "sku", "retail_price", "created_at", "total_quantity"] as const;
export type SortKey = (typeof SORTS)[number];

export function parsePage(value: string | undefined): number {
  const n = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(n) && n >= 1 && n <= 100000 ? n : 1;
}

export function parseSort(value: string | undefined): SortKey {
  return (SORTS as readonly string[]).includes(value ?? "") ? (value as SortKey) : "created_at";
}

/** Removes characters that have special meaning in database search filters. */
export function cleanSearch(value: string | undefined): string {
  return (value ?? "").replace(/[,()%*_\\:."'`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function buildQuery(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const MAX_UPLOAD_BYTES = 3_500_000;

export function detectFileType(bytes: Uint8Array): "jpeg" | "png" | "webp" | "pdf" | null {
  const at = (i: number) => bytes[i];
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "jpeg";
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return "png";
  if (at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 && at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50)
    return "webp";
  if (at(0) === 0x25 && at(1) === 0x50 && at(2) === 0x44 && at(3) === 0x46) return "pdf";
  return null;
}

export const MIME: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };
export const EXT: Record<string, string> = { jpeg: "jpg", png: "png", webp: "webp", pdf: "pdf" };
