import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, buildQuery, fmtDate, num, parsePage, pickSort, usd } from "@/lib/ledger";
import { HISTORY_FILTERS, MONEY_STATUS_LABEL, MONEY_STATUS_STYLE, isMoneyStatus, moneyStatusHelp } from "@/lib/money";
import { KpiStrip, type Kpi } from "@/components/kpi";
import { MoneyActions } from "@/components/money-actions";
import { MoneySendForm } from "@/components/money-send-form";

export const metadata: Metadata = { title: "Money" };
const FILTER_LABEL = { all: "All", accepted: "Logged", rejected: "Rejected", cancelled: "Cancelled", reversed: "Reversed" } as const;
type Row = Record<string, unknown>;

function TransferList({ items, userId, isOwner }: { items: Row[]; userId: string; isOwner: boolean }) {
  return (
    <ul className="space-y-3">
      {items.map((r) => {
        const st = isMoneyStatus(r.status) ? r.status : "pending";
        const mine = r.to_user === userId ? "receiver" : r.from_user === userId ? "sender" : "other";
        return (
          <li key={String(r.id)} className="rounded-md border border-gold-soft bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{String(r.from_name)} <span aria-label="to">→</span> {String(r.to_name)}</p>
                <p className="text-sm text-ink-soft">Transfer #{String(r.seq)} · sent {fmtDate(String(r.sent_on))}{st === "accepted" && r.accepted_at ? ` · logged ${fmtDate(String(r.accepted_at).slice(0, 10))}` : ""}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl text-forest">{usd.format(num(r.amount))}</p>
                <span className={clsx("inline-block rounded px-2 py-0.5 text-xs font-semibold", MONEY_STATUS_STYLE[st])}>{MONEY_STATUS_LABEL[st]}</span>
              </div>
            </div>
            {typeof r.note === "string" && r.note && <p className="mt-2 text-sm">Note: {r.note}</p>}
            <p className="mt-1 text-sm text-ink-soft">{moneyStatusHelp(st, mine, String(r.to_name))}{typeof r.resolved_note === "string" && r.resolved_note ? ` Reason: ${r.resolved_note}` : ""}</p>
            <div className="mt-3"><MoneyActions id={String(r.id)} status={st} isReceiver={mine === "receiver"} isSender={mine === "sender"} isOwner={isOwner} /></div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const session = await requirePermission("money.view");
  const role = session.role;
  const sp = await searchParams;
  const status = pickSort(sp.status, HISTORY_FILTERS, "all");
  const page = parsePage(sp.page);
  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;
  const isSeller = can(role, "money.send");
  const isStaff = can(role, "money.respond");
  const isOwner = can(role, "money.reverse");

  let history = supabase.from("money_transfers").select("*", { count: "exact" }).neq("status", "pending");
  if (status !== "all") history = history.eq("status", status);
  const [summaryRes, pendingRes, historyRes, balanceRes, recipientRes] = await Promise.all([
    supabase.from("money_summary").select("*").maybeSingle(),
    supabase.from("money_transfers").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(100),
    history.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1),
    supabase.from("money_balances").select("*").order("logged_total", { ascending: false }),
    isSeller ? supabase.rpc("money_recipients") : null,
  ]);
  const s = summaryRes.data;
  const pending: Row[] = pendingRes.data ?? [];
  const rows: Row[] = historyRes.data ?? [];
  const balances: Row[] = balanceRes.data ?? [];
  const total = historyRes.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const failed = !!(summaryRes.error || pendingRes.error || historyRes.error);

  const cards: Kpi[] = isStaff
    ? [{ label: "Received and logged", value: usd.format(num(s?.logged_total)), sub: `${num(s?.logged_count)} accepted ${num(s?.logged_count) === 1 ? "transfer" : "transfers"}` },
       { label: "Waiting for you", value: usd.format(num(s?.pending_total)), sub: `${num(s?.pending_count)} to accept or reject`, tone: num(s?.pending_count) > 0 ? "warn" : undefined }]
    : [{ label: isOwner ? "Logged in total" : "Sent and logged", value: usd.format(num(s?.logged_total)), sub: `${num(s?.logged_count)} accepted ${num(s?.logged_count) === 1 ? "transfer" : "transfers"}` },
       { label: "Waiting to be accepted", value: usd.format(num(s?.pending_total)), sub: `${num(s?.pending_count)} not logged yet`, tone: num(s?.pending_count) > 0 ? "warn" : undefined }];
  const intro = isSeller ? "Record money you have sent to a staff member. It is logged only after they accept it."
    : isStaff ? "Money sent to you appears here. Accept it once you have received it, and only then is it logged."
    : "Every transfer between sellers and staff. Only accepted transfers count as logged.";

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl text-forest">Money</h1>
        <p className="text-ink-soft">{intro}</p>
      </div>
      {failed && <p role="alert" className="rounded-md border border-danger/40 bg-red-50 p-3 text-danger">Could not load the money ledger. Please refresh the page.</p>}
      <KpiStrip cards={cards} label="Money summary" />

      {isSeller && <MoneySendForm recipients={(recipientRes?.data ?? []) as { user_id: string; name: string }[]} />}

      <section aria-labelledby="waiting" className="space-y-3">
        <h2 id="waiting" className="font-display text-xl text-forest">{isStaff ? "Waiting for you" : "Waiting to be accepted"}</h2>
        {pending.length > 0 ? <TransferList items={pending} userId={session.userId} isOwner={isOwner} /> : <p className="rounded-md border border-gold-soft bg-white p-4 text-ink-soft">{isStaff ? "Nothing is waiting for you." : "Nothing is waiting. Every transfer has been answered."}</p>}
      </section>

      {balances.length > 0 && (
        <section aria-labelledby="people" className="space-y-3">
          <h2 id="people" className="font-display text-xl text-forest">Totals by person</h2>
          <div className="overflow-x-auto rounded-md border border-gold-soft bg-white">
            <table className="w-full min-w-[34rem] text-sm">
              <caption className="sr-only">Money logged between people</caption>
              <thead className="bg-parchment"><tr className="text-left">
                <th scope="col" className="px-3 py-2 font-medium">From</th><th scope="col" className="px-3 py-2 font-medium">To</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Logged</th><th scope="col" className="px-3 py-2 text-right font-medium">Waiting</th><th scope="col" className="px-3 py-2 font-medium">Last logged</th>
              </tr></thead>
              <tbody className="divide-y divide-gold-soft">
                {balances.map((b) => (
                  <tr key={`${b.from_user}-${b.to_user}`}>
                    <td className="px-3 py-2 font-medium">{String(b.from_name)}</td><td className="px-3 py-2">{String(b.to_name)}</td>
                    <td className="px-3 py-2 text-right font-medium">{usd.format(num(b.logged_total))}</td>
                    <td className="px-3 py-2 text-right">{num(b.pending_total) > 0 ? usd.format(num(b.pending_total)) : "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{b.last_logged_at ? fmtDate(String(b.last_logged_at).slice(0, 10)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-labelledby="history" className="space-y-3">
        <h2 id="history" className="font-display text-xl text-forest">History</h2>
        <nav aria-label="Filter history" className="flex flex-wrap gap-2">
          {HISTORY_FILTERS.map((f) => (
            <Link key={f} href={`/dashboard/money${buildQuery({ status: f === "all" ? undefined : f })}`} aria-current={f === status ? "page" : undefined}
              className={clsx("inline-flex min-h-11 items-center rounded-md px-4 text-sm font-semibold", f === status ? "bg-forest text-ivory" : "border border-gold-soft bg-white hover:bg-parchment")}>{FILTER_LABEL[f]}</Link>
          ))}
        </nav>
        {rows.length > 0 ? <TransferList items={rows} userId={session.userId} isOwner={isOwner} /> : <p className="rounded-md border border-gold-soft bg-white p-4 text-ink-soft">{status === "all" ? "Nothing here yet." : "Nothing with that status."}</p>}
        {pages > 1 && (
          <nav aria-label="Pages" className="flex items-center justify-between text-sm"><span className="text-ink-soft">Page {page} of {pages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link className="min-h-11 rounded-md border border-gold-soft bg-white px-4 py-2.5" href={`/dashboard/money${buildQuery({ status: status === "all" ? undefined : status, page: String(page - 1) })}`}>Previous</Link>}
              {page < pages && <Link className="min-h-11 rounded-md border border-gold-soft bg-white px-4 py-2.5" href={`/dashboard/money${buildQuery({ status: status === "all" ? undefined : status, page: String(page + 1) })}`}>Next</Link>}
            </div></nav>
        )}
      </section>
    </div>
  );
}
