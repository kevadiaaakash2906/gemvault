/** Labels and colours for the money ledger. */
export type MoneyStatus = "pending" | "accepted" | "rejected" | "cancelled" | "reversed";

export const MONEY_STATUS_LABEL: Record<MoneyStatus, string> = {
  pending: "Waiting",
  accepted: "Logged",
  rejected: "Rejected",
  cancelled: "Cancelled",
  reversed: "Reversed",
};

export const MONEY_STATUS_STYLE: Record<MoneyStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-danger",
  cancelled: "bg-parchment text-ink-soft",
  reversed: "bg-red-50 text-danger",
};

export const HISTORY_FILTERS = ["all", "accepted", "rejected", "cancelled", "reversed"] as const;
export type HistoryFilter = (typeof HISTORY_FILTERS)[number];

export function isMoneyStatus(v: unknown): v is MoneyStatus {
  return typeof v === "string" && v in MONEY_STATUS_LABEL;
}

/** What each status means, in a sentence, from the point of view of the person reading it. */
export function moneyStatusHelp(status: MoneyStatus, viewer: "sender" | "receiver" | "other", receiverName: string): string {
  if (status === "pending") return viewer === "receiver" ? "Check your account, then accept or reject it." : `Waiting for ${receiverName} to accept it. It is not logged until then.`;
  if (status === "accepted") return "Accepted, so it is logged.";
  if (status === "rejected") return "Rejected, so it is not logged.";
  if (status === "cancelled") return "Cancelled, so it is not logged.";
  return "Logged earlier, then taken back out by the owner.";
}
