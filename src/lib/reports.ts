/** Helpers for the "Who owes me" and Profit pages. Pure functions, so they are easy to test. */
import { usd } from "@/lib/ledger";

/** A bill waiting this long (or longer) is shown in amber / red. Change the numbers to suit your business. */
export const AMBER_AFTER_DAYS = 30;
export const RED_AFTER_DAYS = 60;

const MS_PER_DAY = 86_400_000;

/** Whole days from an ISO date (YYYY-MM-DD) up to `today`. Null when there is no date. Never negative. */
export function daysWaiting(since: string | null | undefined, today: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(since ?? "");
  if (!m) return null;
  const start = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.max(0, Math.round((end - start) / MS_PER_DAY));
}

export function waitingLabel(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "Today";
  return days === 1 ? "1 day" : `${days} days`;
}

export type AgeTone = "ok" | "amber" | "red";
export function ageTone(days: number | null): AgeTone {
  if (days === null) return "ok";
  if (days >= RED_AFTER_DAYS) return "red";
  return days >= AMBER_AFTER_DAYS ? "amber" : "ok";
}

/** Profit as a percentage of sales. Null when there are no sales to measure against. */
export function marginPct(profit: number, sales: number): number | null {
  return sales > 0 ? (profit / sales) * 100 : null;
}

export function fmtPct(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

/** "Aug 2026" for a month start date; "No sale date" for sales that never had a Date Sold. */
export function monthLabel(month: string | null | undefined): string {
  if (!month) return "No sale date";
  return new Date(month.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** "+$1,234.50" for gains and "-$300.00" for losses (used on profit cards). */
export function signedUsd(n: number): string {
  return (n > 0 ? "+" : "") + usd.format(n);
}
