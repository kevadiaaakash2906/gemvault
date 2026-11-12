export type Role = "owner" | "staff" | "seller";
export const ROLES: Role[] = ["owner", "staff", "seller"];

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  staff: "Staff",
  seller: "Independent seller",
};

/** What each role may do. The database enforces the same rules, so hiding a button is never the only protection. */
export const PERMISSIONS = {
  // Owner: everything. Staff: everything except Team. Seller: sees what staff see (except Rates), records sales on orders, and adds and edits Trading.
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
  "orders.hold": ["owner", "staff"],   // mark a piece as out with a customer (not sold)
  "orders.sale": ["owner", "staff", "seller"],   // Sold To, Memo, Sale Price, Date Sold on an existing order
  "trades.view": ["owner", "staff", "seller"],
  "trades.edit": ["owner", "staff", "seller"],
  "memos.view": ["owner", "staff", "seller"],
  "memos.delete": ["owner", "staff", "seller"],   // permanently, only an empty memo, with the person's own password
  "payments.record": ["owner", "staff"],
  "payments.void": ["owner", "staff"],
  "records.delete": ["owner", "staff"],
  "expenses.view": ["owner", "staff", "seller"],
  "expenses.manage": ["owner", "staff"],
  "buyers.view": ["owner", "staff", "seller"],
  "buyers.manage": ["owner"],   // rename and merge buyers
  "receivables.view": ["owner", "staff", "seller"],
  "reports.profit": ["owner", "staff", "seller"],
  "returns.record": ["owner", "staff"],
  "returns.view": ["owner", "staff", "seller"],
  "returns.delete": ["owner", "staff", "seller"],   // permanently, with the person's own password
  // Money ledger: people only ever see their own transfers; the owner sees all of them.
  "money.view": ["owner", "staff", "seller"],
  "money.send": ["seller"],      // a seller enters money they have sent to a staff member (it waits until that person accepts)
  "money.respond": ["staff"],    // staff accept or reject money sent to them
  "money.reverse": ["owner"],    // take a logged transfer back out, with a reason
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
