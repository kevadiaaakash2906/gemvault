import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const session = await requireSession();
  const { denied } = await searchParams;

  if (!session.isActive) {
    return (
      <div className="max-w-xl space-y-3">
        <h1 className="font-display text-3xl text-forest">Account deactivated</h1>
        <p className="text-ink-soft">Your account has been switched off. Contact the owner of the business to get access again.</p>
      </div>
    );
  }

  if (!session.role) {
    return (
      <div className="max-w-xl space-y-3">
        <h1 className="font-display text-3xl text-forest">Waiting for access</h1>
        <p className="text-ink-soft">
          Your login works, but the owner has not given you a role yet. Ask them to open Team and assign you one, then refresh this page.
        </p>
      </div>
    );
  }

  let productCount: number | null = null;
  let lowStockCount = 0;
  if (can(session.role, "inventory.view")) {
    const supabase = await createClient();
    const [all, low] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }).eq("is_archived", false),
      supabase.from("product_overview").select("id", { count: "exact", head: true }).eq("is_archived", false).eq("is_low_stock", true),
    ]);
    productCount = all.count;
    lowStockCount = low.count ?? 0;
  }

  let teamCount: number | null = null;
  if (can(session.role, "team.manage")) {
    const supabase = await createClient();
    const { count } = await supabase.from("user_roles").select("user_id", { count: "exact", head: true });
    teamCount = count;
  }

  return (
    <div className="max-w-3xl space-y-6">
      {denied && <Notice tone="error">You do not have permission to open that page.</Notice>}
      <div>
        <h1 className="font-display text-3xl text-forest">Welcome{session.fullName ? `, ${session.fullName}` : ""}</h1>
        <p className="mt-1 text-ink-soft">
          Signed in as {session.email} · {ROLE_LABEL[session.role]}
        </p>
      </div>
      {teamCount !== null && (
        <p className="rounded-md border border-gold-soft bg-white p-4">
          <span className="font-display text-3xl text-forest">{teamCount}</span>{" "}
          <span className="text-ink-soft">{teamCount === 1 ? "person has" : "people have"} a role in GemVault.</span>
        </p>
      )}
      {productCount !== null && (
        <p className="rounded-md border border-gold-soft bg-white p-4">
          <span className="font-display text-3xl text-forest">{productCount}</span>{" "}
          <span className="text-ink-soft">active {productCount === 1 ? "product" : "products"}</span>
          {lowStockCount > 0 && <span className="ml-3 rounded bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-900">{lowStockCount} low on stock</span>}
        </p>
      )}
      <p className="text-ink-soft">
        Purchases, sales and seller tools arrive in later phases. Nothing on this page is sample data.
      </p>
    </div>
  );
}
