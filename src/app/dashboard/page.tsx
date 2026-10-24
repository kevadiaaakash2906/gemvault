import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui";
import { num, usd } from "@/lib/ledger";

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

  let figures: { label: string; value: string }[] = [];
  if (can(session.role, "orders.view")) {
    const supabase = await createClient();
    const [orders, unsold, trades, memos, expenses] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id", { count: "exact", head: true }).is("sale_price", null),
      supabase.from("trades").select("id", { count: "exact", head: true }),
      supabase.from("memo_summary").select("total_bill,total_paid,balance").limit(5000),
      can(session.role, "expenses.manage") ? supabase.from("expenses").select("amount").limit(5000) : Promise.resolve({ data: null }),
    ]);
    const sum = (k: string) => (memos.data ?? []).reduce((n, m) => n + num((m as Record<string, unknown>)[k]), 0);
    figures = [
      { label: "Order pieces", value: String(orders.count ?? 0) },
      { label: "Orders not sold yet", value: String(unsold.count ?? 0) },
      { label: "Trading items", value: String(trades.count ?? 0) },
      { label: "Billed to buyers", value: usd.format(sum("total_bill")) },
      { label: "Collected", value: usd.format(sum("total_paid")) },
      { label: "Still owed to you", value: usd.format(sum("balance")) },
    ];
    if (expenses.data) figures.push({ label: "Expenses", value: usd.format((expenses.data as { amount: number }[]).reduce((n, e) => n + num(e.amount), 0)) });
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
      {figures.length > 0 && (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {figures.map((f) => (
            <div key={f.label} className="rounded-md border border-gold-soft bg-white p-4"><dt className="text-sm text-ink-soft">{f.label}</dt><dd className="font-display text-3xl text-forest">{f.value}</dd></div>
          ))}
        </dl>
      )}
    </div>
  );
}
