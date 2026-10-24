export const PAGE_SIZE = 25;

export function parsePage(value: string | undefined): number {
  const n = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(n) && n >= 1 && n <= 100000 ? n : 1;
}

export function pickSort<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value ?? "") ? (value as T) : fallback;
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

export type CostInput = { net: number; multiplier: number; goldRate: number; diamAmount: number; lCharges: number; flatLabor: boolean; usdRate: number };

/** Same arithmetic as the database function save_order (and your old sheet). */
export function computeCosts(i: CostInput) {
  const pg = Math.round(i.net * i.multiplier * 1000) / 1000;
  const gold = Math.round(i.net * i.multiplier * i.goldRate);
  const labor = i.flatLabor ? i.lCharges : Math.round(i.net * i.lCharges);
  const sub = Math.round(gold + i.diamAmount + labor);
  const usd = Math.round((sub / i.usdRate) * 100) / 100;
  return { pg, gold, labor, sub, usd };
}

export const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

export const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
export const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const fmtDate = (d: string | null | undefined) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
