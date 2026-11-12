import { describe, expect, it } from "vitest";
import { PERMISSIONS, can, isPublicPath, safeNextPath, type Permission, type Role } from "@/lib/permissions";
import { loginSchema, newPasswordSchema, setRoleSchema } from "@/lib/validation";

const ALL = Object.keys(PERMISSIONS) as Permission[];
const allowed = (role: Role) => ALL.filter((p) => can(role, p)).sort();

describe("the three roles", () => {
  it("owner has full power (except acting as the seller who sends money or the staff member who accepts it)", () => {
    expect(allowed("owner")).toEqual(ALL.filter((p) => p !== "money.send" && p !== "money.respond").sort());
  });
  it("staff see and edit everything except Team, the audit log and merging buyers", () => {
    expect(allowed("staff")).toEqual(ALL.filter((p) => !["team.manage", "audit.view", "buyers.manage", "money.send", "money.reverse"].includes(p)).sort());
    expect(can("staff", "settings.edit")).toBe(true);     // Rates
    expect(can("staff", "costs.view")).toBe(true);
    expect(can("staff", "team.manage")).toBe(false);
  });
  it("a seller sees what staff see except Rates, records sales on orders, edits Trading, and can delete memos and returns", () => {
    expect(allowed("seller")).toEqual([
      "buyers.view", "costs.view", "dashboard.view", "expenses.view", "memos.delete", "memos.view", "money.send", "money.view", "orders.sale", "orders.view",
      "receivables.view", "reports.profit", "returns.delete", "returns.view", "styles.view", "trades.edit", "trades.view",
    ].sort());
    expect(can("seller", "settings.edit")).toBe(false);   // no Rates tab
    expect(can("seller", "team.manage")).toBe(false);
    for (const p of ["orders.edit", "orders.hold", "buyers.manage", "payments.record", "payments.void", "expenses.manage", "records.delete", "returns.record"] as const) {
      expect(can("seller", p)).toBe(false);
    }
  });
  it("the money ledger: sellers send, staff accept, only the owner reverses, everyone sees their own", () => {
    expect(["owner", "staff", "seller"].map((r) => can(r as Role, "money.view"))).toEqual([true, true, true]);
    expect(["owner", "staff", "seller"].map((r) => can(r as Role, "money.send"))).toEqual([false, false, true]);
    expect(["owner", "staff", "seller"].map((r) => can(r as Role, "money.respond"))).toEqual([false, true, false]);
    expect(["owner", "staff", "seller"].map((r) => can(r as Role, "money.reverse"))).toEqual([true, false, false]);
    expect(can(null, "money.view")).toBe(false);
  });
  it("denies everything when there is no role", () => {
    expect(can(null, "dashboard.view")).toBe(false);
    expect(can(undefined, "team.manage")).toBe(false);
  });
});

describe("route helpers", () => {
  it("keeps private pages private", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/dashboard/team")).toBe(false);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/loginevil")).toBe(false);
  });
  it("blocks redirects to other websites", () => {
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
    expect(safeNextPath("//evil.com")).toBe("/dashboard");
    expect(safeNextPath("https://evil.com")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.com")).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
  });
});

describe("validation", () => {
  it("rejects bad logins", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: " a@b.com ", password: "x" }).success).toBe(true);
  });
  it("enforces password strength and match", () => {
    expect(newPasswordSchema.safeParse({ password: "short1", confirm: "short1" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "onlyletterslong", confirm: "onlyletterslong" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "GoodPass1234", confirm: "Different1234" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "GoodPass1234", confirm: "GoodPass1234" }).success).toBe(true);
  });
  it("only accepts the three known roles", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    expect(setRoleSchema.safeParse({ userId: id, role: "admin" }).success).toBe(false);
    expect(setRoleSchema.safeParse({ userId: id, role: "owner" }).success).toBe(true);
  });
});
