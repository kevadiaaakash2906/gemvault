export type Role = "owner" | "staff" | "seller";
export const ROLES: Role[] = ["owner", "staff", "seller"];

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  staff: "Staff",
  seller: "Independent seller",
};

/** What each role may do. Phase 1 covers accounts and settings; later phases add more rows. */
export const PERMISSIONS = {
  "team.manage": ["owner"],
  "settings.edit": ["owner"],
  "audit.view": ["owner"],
  "costs.view": ["owner"],
  "dashboard.view": ["owner", "staff", "seller"],
  "inventory.view": ["owner", "staff"],
  "inventory.edit": ["owner", "staff"],
  "stock.adjust": ["owner"],
  "products.archive": ["owner"],
  "locations.manage": ["owner"],
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
