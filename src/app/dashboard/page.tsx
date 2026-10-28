import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Plus } from "lucide-react";
import { Notice } from "@/components/ui";
import { fmtDate, num, usd } from "@/lib/ledger";
import { ageTone, daysWaiting, monthLabel, signedUsd, waitingLabel } from "@/lib/reports";

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

  const role = session.role;
  const showMoney = can(role, "receivables.view");
  const showProfit = can(role, "reports.profit");
  const supabase = await createClient();
  // Everything on this page is asked for at the same time: one round trip to the database, not several.
  const [summaryRes, waitingRes, paymentsRes, monthsRes, teamRes] = await Promise.all([
    showMoney ? supabase.from("receivables_summary").select("*").maybeSingle() : null,
    showMoney ? supabase.from("buyer_receivables").select("buyer,balance_due,oldest_unpaid_on").gt("balance_due", 0).order("oldest_unpaid_on", { ascending: true, nullsFirst: false }).limit(5) : null,
    showMoney ? supabase.from("recent_payments").select("buyer,memo_no,amount,paid_on").order("paid_on", { ascending: false }).order("created_at", { ascending: false }).limit(6) : null,
    showProfit ? supabase.from("monthly_profit").select("month,net_profit").not("month", "is", null).order("month", { ascending: false }).limit(6) : null,
    can(role, "team.manage") ? supabase.from("user_roles").select("user_id", { count: "exact", head: true }) : null,
  ]);

  const billed = num(summaryRes?.data?.total_billed);
  const paid = num(summaryRes?.data?.total_paid);
  const owed = num(summaryRes?.data?.balance_due);
  const percentCollected = billed > 0 ? Math.min(100, Math.round((paid / billed) * 100)) : 0;
  const waiting = waitingRes?.data ?? [];
  const payments = paymentsRes?.data ?? [];
  const months = [...(monthsRes?.data ?? [])].reverse();   // oldest first, so the bars read left to right in time
  const biggest = Math.max(1, ...months.map((m) => Math.abs(num(m.net_profit))));
  const actions = [
    can(role, "orders.edit") && { href: "/dashboard/orders/new", label: "Add order" },
    can(role, "trades.edit") && { href: "/dashboard/trading/new", label: "Add trading item" },
    can(role, "payments.record") && { href: "/dashboard/memos", label: "Record a payment" },
    can(role, "expenses.manage") && { href: "/dashboard/expenses/new", label: "Add expense" },
  ].filter((a): a is { href: string; label: string } => !!a);
  const card = "rounded-md border border-gold-soft bg-white p-4 sm:p-5";
  const linkCls = "inline-flex min-h-11 items-center gap-1 text-sm font-medium text-forest underline underline-offset-4";

  return (
    <div className="max-w-5xl space-y-5">
      {denied && <Notice tone="error">You do not have permission to open that page.</Notice>}
      <div>
        <h1 className="font-display text-3xl text-forest">Welcome{session.fullName ? `, ${session.fullName}` : ""}</h1>
        <p className="mt-1 text-ink-soft">Signed in as {session.email} · {ROLE_LABEL[role]}</p>
      </div>

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((a, i) => (
            <Link key={a.href} href={a.href} className={clsx("inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-semibold", i === 0 ? "bg-forest text-ivory hover:bg-forest-deep" : "border border-gold-soft bg-white hover:bg-parchment")}>
              <Plus className="size-4" aria-hidden /> {a.label}
            </Link>
          ))}
        </div>
      )}

      {showMoney && (
        <section aria-labelledby="money" className={card}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="money" className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Still owed to you</h2>
              <p className="font-display text-4xl text-forest sm:text-5xl">{usd.format(owed)}</p>
              <p className="text-sm text-ink-soft">by {num(summaryRes?.data?.buyers_owing)} {num(summaryRes?.data?.buyers_owing) === 1 ? "buyer" : "buyers"}</p>
            </div>
            <Link href="/dashboard/receivables" className={linkCls}>Who owes me <ArrowRight className="size-4" aria-hidden /></Link>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm"><span>Collected {usd.format(paid)}</span><span className="text-ink-soft">of {usd.format(billed)} billed · {percentCollected}%</span></div>
            <div role="progressbar" aria-label="Share of billed amount collected" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentCollected} className="mt-1.5 h-3 overflow-hidden rounded-full bg-parchment">
              <div className="h-full rounded-full bg-forest" style={{ width: `${percentCollected}%` }} />
            </div>
          </div>
        </section>
      )}

      {showMoney && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section aria-labelledby="waiting" className={card}>
            <h2 id="waiting" className="font-display text-xl text-forest">Waiting longest</h2>
            <p className="text-sm text-ink-soft">Oldest unpaid bills first</p>
            <ul className="mt-3 divide-y divide-gold-soft">
              {waiting.map((w) => {
                const d = daysWaiting(w.oldest_unpaid_on);
                const tone = ageTone(d);
                return (
                  <li key={w.buyer} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0"><p className="truncate font-medium">{w.buyer}</p><p className={clsx("text-sm", tone === "red" ? "font-semibold text-danger" : tone === "amber" ? "font-medium text-amber-700" : "text-ink-soft")}>{waitingLabel(d)} · since {fmtDate(w.oldest_unpaid_on)}</p></div>
                    <p className="shrink-0 font-medium">{usd.format(num(w.balance_due))}</p>
                  </li>
                );
              })}
              {waiting.length === 0 && <li className="py-6 text-center text-ink-soft">Nobody owes you anything right now.</li>}
            </ul>
            <Link href="/dashboard/receivables?sort=oldest" className={linkCls}>See everyone <ArrowRight className="size-4" aria-hidden /></Link>
          </section>

          <section aria-labelledby="latest" className={card}>
            <h2 id="latest" className="font-display text-xl text-forest">Latest payments</h2>
            <p className="text-sm text-ink-soft">Most recent money received</p>
            <ul className="mt-3 divide-y divide-gold-soft">
              {payments.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0"><p className="truncate font-medium">{p.buyer}</p><p className="text-sm text-ink-soft">Memo {p.memo_no} · {fmtDate(p.paid_on)}</p></div>
                  <p className="shrink-0 font-medium text-emerald-700">+{usd.format(num(p.amount))}</p>
                </li>
              ))}
              {payments.length === 0 && <li className="py-6 text-center text-ink-soft">No payments recorded yet.</li>}
            </ul>
            <Link href="/dashboard/memos" className={linkCls}>Open memos <ArrowRight className="size-4" aria-hidden /></Link>
          </section>
        </div>
      )}

      {showProfit && (
        <section aria-labelledby="trend" className={card}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 id="trend" className="font-display text-xl text-forest">Net profit, last {months.length || 6} months</h2><p className="text-sm text-ink-soft">Order profit + trading profit − expenses</p></div>
            <Link href="/dashboard/profit?view=month" className={linkCls}>Full profit report <ArrowRight className="size-4" aria-hidden /></Link>
          </div>
          <ul className="mt-3 space-y-2">
            {months.map((m) => {
              const v = num(m.net_profit);
              return (
                <li key={m.month} className="grid grid-cols-[4.5rem_1fr_6.5rem] items-center gap-3 text-sm">
                  <span>{monthLabel(m.month)}</span>
                  <span className="h-3 overflow-hidden rounded-full bg-parchment" aria-hidden><span className={clsx("block h-full rounded-full", v >= 0 ? "bg-emerald-600" : "bg-danger")} style={{ width: `${Math.max(2, (Math.abs(v) / biggest) * 100)}%` }} /></span>
                  <span className={clsx("text-right font-medium", v < 0 && "text-danger")}>{signedUsd(v)}</span>
                </li>
              );
            })}
            {months.length === 0 && <li className="py-4 text-center text-ink-soft">No sales or expenses yet.</li>}
          </ul>
        </section>
      )}

      {teamRes && (
        <p className="text-sm text-ink-soft">
          {teamRes.count ?? 0} {teamRes.count === 1 ? "person has" : "people have"} a role in GemVault. <Link href="/dashboard/team" className="text-forest underline underline-offset-4">Manage team</Link>
        </p>
      )}
    </div>
  );
}
