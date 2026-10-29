export type Role = "owner" | "staff" | "seller";
export const ROLES: Role[] = ["owner", "staff", "seller"];

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  staff: "Staff",
  seller: "Independent seller",
};

/** What each role may do. The database enforces the same rules, so hiding a button is never the only protection. */
export const PERMISSIONS = {
  // Owner: everything. Staff: everything except Team. Seller: sees what staff see (except Rates) and can only record the sale on an order.
  "team.manage": ["owner"],
  "settings.edit": ["owner", "staff"],   // the Rates tab
  "audit.view": ["owner"],
  "costs.view": ["owner", "staff", "seller"],
  "dashboard.view": ["owner", "staff", "seller"],
  "styles.view": ["owner", "staff", "seller"],
  "styles.edit": ["owner", "staff"],
  "styles.delete": ["owner", "staff"],
  "orders.view": ["owner", "staff", "seller"],
  "orders.edit": ["owner", "staff"],
  "orders.sale": ["owner", "staff", "seller"],   // Sold To, Memo, Sale Price, Date Sold on an existing order
  "trades.view": ["owner", "staff", "seller"],
  "trades.edit": ["owner", "staff"],
  "memos.view": ["owner", "staff", "seller"],
  "payments.record": ["owner", "staff"],
  "payments.void": ["owner", "staff"],
  "records.delete": ["owner", "staff"],
  "expenses.view": ["owner", "staff", "seller"],
  "expenses.manage": ["owner", "staff"],
  "receivables.view": ["owner", "staff", "seller"],
  "reports.profit": ["owner", "staff", "seller"],
  "returns.record": ["owner", "staff"],
  "returns.view": ["owner", "staff", "seller"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

const PUBLIC_PREFIXES = ["/login", "/forgot-password", "/reset-password", "/auth"];

export function isPublicPath(path: string): boolean {
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

/** Only allow redirects to pages inside this website. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/dashboard";
  return next;
}
