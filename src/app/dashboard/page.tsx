import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, ArrowUpRight, PiggyBank, Plus, ShoppingBag, TrendingDown, TrendingUp } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui";
import { GemMark } from "@/components/gem-mark";
import { SalesProfitChart, TopBars, shortMonth } from "@/components/charts";
import { fmtDate, num, usd } from "@/lib/ledger";
import { ageTone, daysWaiting, waitingLabel } from "@/lib/reports";

export const metadata: Metadata = { title: "Overview" };

const card = "min-w-0 rounded-xl border border-gold-soft bg-white p-5 shadow-sm";
const linkCls = "inline-flex min-h-11 items-center gap-1 text-sm font-medium text-forest underline underline-offset-4";
const initial = (s: unknown) => (String(s ?? "?").trim()[0] ?? "?").toUpperCase();

/** Change from the previous month, in percent. Null when there is nothing to compare with. */
const change = (cur: number, prev: number | undefined) => (prev === undefined || prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100);

function Delta({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", up ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-danger")}>
      {up ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
      {Math.abs(value).toFixed(0)}%
      <span className="sr-only"> {up ? "up" : "down"} on the month before</span>
    </span>
  );
}

function Stat({ icon, label, value, sub, delta, tone }: { icon: React.ReactNode; label: string; value: string; sub: string; delta: number | null; tone?: "bad" }) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-3 rounded-xl border border-gold-soft bg-white p-4 shadow-sm sm:gap-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="grid size-8 place-items-center rounded-full bg-parchment text-forest sm:size-10" aria-hidden>{icon}</span>
        <Delta value={delta} />
      </div>
      <div>
        <p className="text-sm text-ink-soft">{label}</p>
        <p className={clsx("font-display text-xl [overflow-wrap:anywhere] sm:text-3xl", tone === "bad" ? "text-danger" : "text-forest")}>{value}</p>
        <p className="hidden text-xs text-ink-soft sm:block">{sub}</p>
      </div>
    </div>
  );
}

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
  const [summaryRes, waitingRes, paymentsRes, monthsRes, teamRes, ledgerRes, topRes] = await Promise.all([
    showMoney ? supabase.from("receivables_summary").select("*").maybeSingle() : null,
    showMoney ? supabase.from("buyer_receivables").select("buyer,balance_due,oldest_unpaid_on").gt("balance_due", 0).order("oldest_unpaid_on", { ascending: true, nullsFirst: false }).limit(5) : null,
    showMoney ? supabase.from("recent_payments").select("buyer,memo_no,amount,paid_on").order("paid_on", { ascending: false }).order("created_at", { ascending: false }).limit(6) : null,
    showProfit ? supabase.from("monthly_profit").select("month,net_profit,sales").not("month", "is", null).order("month", { ascending: false }).limit(12) : null,
    can(role, "team.manage") ? supabase.from("user_roles").select("user_id", { count: "exact", head: true }) : null,
    can(role, "money.send") || can(role, "money.respond") ? supabase.from("money_summary").select("pending_total,pending_count").maybeSingle() : null,   // money waiting to be accepted
    showProfit ? supabase.from("buyer_profit").select("buyer_id,buyer,sales,profit").order("sales", { ascending: false }).limit(5) : null,
  ]);
  const waitingMoney = num(ledgerRes?.data?.pending_count);

  const billed = num(summaryRes?.data?.total_billed);
  const paid = num(summaryRes?.data?.total_paid);
  const owed = num(summaryRes?.data?.balance_due);
  const buyersOwing = num(summaryRes?.data?.buyers_owing);
  const percentCollected = billed > 0 ? Math.min(100, Math.round((paid / billed) * 100)) : 0;
  const waiting = waitingRes?.data ?? [];
  const payments = paymentsRes?.data ?? [];
  const points = [...(monthsRes?.data ?? [])].reverse()   // oldest first, so the bars read left to right in time
    .map((m) => ({ label: shortMonth(m.month), sales: num(m.sales), profit: num(m.net_profit) }));
  const latest = points.at(-1);
  const before = points.at(-2);
  const topBuyers = (topRes?.data ?? []).filter((b) => num(b.sales) > 0)
    .map((b) => ({ key: String(b.buyer_id), name: String(b.buyer), value: num(b.sales), note: `Profit ${usd.format(num(b.profit))}` }));
  const actions = [
    can(role, "orders.edit") && { href: "/dashboard/orders/new", label: "Add order" },
    can(role, "trades.edit") && { href: "/dashboard/trading/new", label: "Add trading item" },
    can(role, "payments.record") && { href: "/dashboard/memos", label: "Record a payment" },
    can(role, "expenses.manage") && { href: "/dashboard/expenses/new", label: "Add expense" },
  ].filter((a): a is { href: string; label: string } => !!a);
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="max-w-6xl space-y-6">
      {denied && <Notice tone="error">You do not have permission to open that page.</Notice>}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-soft">{today}</p>
          <h1 className="font-display text-3xl text-forest sm:text-4xl">Welcome{session.fullName ? `, ${session.fullName}` : ""}</h1>
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((a, i) => (
              <Link key={a.href} href={a.href} className={clsx("inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors", i === 0 ? "bg-forest text-ivory shadow-sm hover:bg-forest-deep" : "border border-gold-soft bg-white hover:bg-parchment")}>
                <Plus className="size-4" aria-hidden /> {a.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {waitingMoney > 0 && (
        <Link href="/dashboard/money" className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 hover:bg-amber-100">
          <span>
            <strong>{waitingMoney} money {waitingMoney === 1 ? "transfer" : "transfers"} ({usd.format(num(ledgerRes?.data?.pending_total))})</strong>{" "}
            {can(role, "money.respond") ? "waiting for you to accept." : "you sent still waiting to be accepted."}
          </span>
          <ArrowRight className="size-4 shrink-0" aria-hidden />
        </Link>
      )}

      {(showMoney || latest) && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {showMoney && (
            <section aria-labelledby="money" className="relative col-span-2 overflow-hidden rounded-2xl bg-linear-to-br from-forest to-forest-deep p-5 text-ivory shadow-sm sm:p-6">
              <GemMark className="pointer-events-none absolute -bottom-14 -right-10 size-48 text-gold/10" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id="money" className="text-xs font-semibold uppercase tracking-wider text-gold-soft">Still owed to you</h2>
                    <p className="mt-2 font-display text-4xl [overflow-wrap:anywhere] sm:text-5xl">{usd.format(owed)}</p>
                  </div>
                  <Link href="/dashboard/receivables" aria-label="Who owes me" title="Who owes me" className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-gold-soft transition-colors hover:bg-white/20 hover:text-ivory"><ArrowUpRight className="size-5" aria-hidden /></Link>
                </div>
                <p className="mt-3 inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-soft">{buyersOwing} {buyersOwing === 1 ? "buyer owes" : "buyers owe"} you</p>
                <div className="mt-5">
                  <div role="progressbar" aria-label="Share of billed amount collected" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentCollected} className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="bar-grow h-full rounded-full bg-gold" style={{ width: `${percentCollected}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-gold-soft">{percentCollected}% collected</p>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                  <div><dt className="text-xs text-gold-soft">Billed</dt><dd className="font-semibold">{usd.format(billed)}</dd></div>
                  <div><dt className="text-xs text-gold-soft">Collected</dt><dd className="font-semibold">{usd.format(paid)}</dd></div>
                </dl>
              </div>
            </section>
          )}
          {latest && (
            <>
              <Stat icon={<ShoppingBag className="size-4 sm:size-5" />} label={`Sales in ${latest.label}`} value={usd.format(latest.sales)} sub="latest month with activity" delta={change(latest.sales, before?.sales)} />
              <Stat icon={<PiggyBank className="size-4 sm:size-5" />} label={`Net profit in ${latest.label}`} value={usd.format(latest.profit)} sub="after expenses" delta={change(latest.profit, before?.profit)} tone={latest.profit < 0 ? "bad" : undefined} />
            </>
          )}
        </div>
      )}

      {showProfit && (
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <section aria-labelledby="trend" className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 id="trend" className="font-display text-xl text-forest">Sales vs net profit</h2><p className="text-sm text-ink-soft">By month, last {points.length || 12} months</p></div>
              <Link href="/dashboard/profit?view=month" className={linkCls}>Full report <ArrowRight className="size-4" aria-hidden /></Link>
            </div>
            <SalesProfitChart data={points} label="Sales and net profit by month" />
          </section>
          <section aria-labelledby="top-buyers" className={card}>
            <div><h2 id="top-buyers" className="font-display text-xl text-forest">Top buyers</h2><p className="text-sm text-ink-soft">The five biggest by sales</p></div>
            <TopBars rows={topBuyers} />
            <Link href="/dashboard/buyers" className={linkCls}>All buyers <ArrowRight className="size-4" aria-hidden /></Link>
          </section>
        </div>
      )}

      {showMoney && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section aria-labelledby="waiting" className={card}>
            <h2 id="waiting" className="font-display text-xl text-forest">Waiting longest</h2>
            <p className="text-sm text-ink-soft">Oldest unpaid bills first</p>
            <ul className="mt-3 space-y-1">
              {waiting.map((w) => {
                const d = daysWaiting(w.oldest_unpaid_on);
                const tone = ageTone(d);
                return (
                  <li key={w.buyer} className="flex items-center gap-3 rounded-lg p-2 hover:bg-ivory">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-parchment font-semibold text-forest" aria-hidden>{initial(w.buyer)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{w.buyer}</p>
                      <p className={clsx("text-sm", tone === "red" ? "font-semibold text-danger" : tone === "amber" ? "font-medium text-amber-700" : "text-ink-soft")}>{waitingLabel(d)} · since {fmtDate(w.oldest_unpaid_on)}</p>
                    </div>
                    <p className="shrink-0 font-semibold">{usd.format(num(w.balance_due))}</p>
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
            <ul className="mt-3 space-y-1">
              {payments.map((p, i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg p-2 hover:bg-ivory">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-100 font-semibold text-emerald-800" aria-hidden>{initial(p.buyer)}</span>
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{p.buyer}</p><p className="text-sm text-ink-soft">Memo {p.memo_no} · {fmtDate(p.paid_on)}</p></div>
                  <p className="shrink-0 font-semibold text-emerald-700">+{usd.format(num(p.amount))}</p>
                </li>
              ))}
              {payments.length === 0 && <li className="py-6 text-center text-ink-soft">No payments recorded yet.</li>}
            </ul>
            <Link href="/dashboard/memos" className={linkCls}>Open memos <ArrowRight className="size-4" aria-hidden /></Link>
          </section>
        </div>
      )}

      {teamRes && (
        <p className="text-sm text-ink-soft">
          {teamRes.count ?? 0} {teamRes.count === 1 ? "person has" : "people have"} a role in Vinere. <Link href="/dashboard/team" className="text-forest underline underline-offset-4">Manage team</Link>
        </p>
      )}
    </div>
  );
}
