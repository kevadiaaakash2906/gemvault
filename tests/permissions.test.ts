import { describe, expect, it } from "vitest";
import { can, isPublicPath, safeNextPath } from "@/lib/permissions";
import { loginSchema, newPasswordSchema, setRoleSchema } from "@/lib/validation";

describe("role permissions", () => {
  it("lets only the owner manage the team, settings and audit log", () => {
    for (const p of ["team.manage", "settings.edit", "audit.view", "costs.view"] as const) {
      expect(can("owner", p)).toBe(true);
      expect(can("staff", p)).toBe(false);
      expect(can("seller", p)).toBe(false);
    }
  });
  it("lets staff see who owes money but keeps the profit report owner-only", () => {
    expect(can("owner", "receivables.view")).toBe(true);
    expect(can("staff", "receivables.view")).toBe(true);
    expect(can("seller", "receivables.view")).toBe(false);
    expect(can("owner", "reports.profit")).toBe(true);
    expect(can("staff", "reports.profit")).toBe(false);
    expect(can("seller", "reports.profit")).toBe(false);
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
