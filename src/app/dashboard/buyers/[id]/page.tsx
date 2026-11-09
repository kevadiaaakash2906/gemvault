import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, num, usd } from "@/lib/ledger";
import { PrintButton } from "@/components/print-button";
import { RenameBuyer } from "@/components/buyer-tools";

export const metadata: Metadata = { title: "Buyer statement" };
const MAX_MEMOS = 200;

export default async function BuyerStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("buyers.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: buyer } = await supabase.from("buyers").select("id,name").eq("id", id).maybeSingle();
  if (!buyer) notFound();

  const { data: memoRows } = await supabase.from("memos").select("id").eq("buyer_id", id).limit(1000);
  const allIds = (memoRows ?? []).map((m) => String(m.id));
  const { data: summaries } = allIds.length
    ? await supabase.from("memo_summary").select("*").in("id", allIds).order("created_at", { ascending: false }).limit(MAX_MEMOS)
    : { data: [] };
  const memos = summaries ?? [];
  const ids = memos.map((m) => String(m.id));
  const [{ data: orders }, { data: trades }, { data: pays }] = ids.length
    ? await Promise.all([
        supabase.from("orders").select("memo_id,sr_no,style_no,jewelry_type,sale_price,date_sold").in("memo_id", ids).order("sr_no"),
        supabase.from("trades").select("memo_id,sr_no,item,sale_price,date_sold").in("memo_id", ids).order("sr_no"),
        supabase.from("payments").select("memo_id,amount,paid_on").in("memo_id", ids).is("voided_at", null).order("paid_on"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const billed = memos.reduce((a, m) => a + num(m.total_bill), 0);
  const paid = memos.reduce((a, m) => a + num(m.total_paid), 0);
  const due = memos.reduce((a, m) => a + num(m.balance), 0);
  const today = new Date().toISOString().slice(0, 10);
  const owner = can(session.role, "buyers.manage");

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/buyers" className="text-sm text-gold-deep underline underline-offset-4 print:hidden">← All buyers</Link>
          <h1 className="mt-1 font-display text-3xl text-forest">Statement: {buyer.name}</h1>
          <p className="text-ink-soft">As of {fmtDate(today)} · {memos.length} {memos.length === 1 ? "memo" : "memos"}</p>
        </div>
        <PrintButton />
      </div>

      <dl className="grid gap-4 rounded-md border border-gold-soft bg-white p-5 sm:grid-cols-3">
        <div><dt className="text-sm text-ink-soft">Total billed</dt><dd className="text-xl font-medium">{usd.format(billed)}</dd></div>
        <div><dt className="text-sm text-ink-soft">Total paid</dt><dd className="text-xl font-medium">{usd.format(paid)}</dd></div>
        <div><dt className="text-sm text-ink-soft">Balance due</dt><dd className="text-xl font-semibold">{usd.format(due)}</dd></div>
      </dl>
      {allIds.length > memos.length && <p className="text-sm text-ink-soft print:hidden">Showing the latest {MAX_MEMOS} memos.</p>}

      {memos.length === 0 && <p className="rounded-md border border-gold-soft bg-white p-5 text-ink-soft">No memos for this buyer yet.</p>}
      {memos.map((m) => {
        const mid = String(m.id);
        const mo = (orders ?? []).filter((o) => String(o.memo_id) === mid);
        const mt = (trades ?? []).filter((t) => String(t.memo_id) === mid);
        const mp = (pays ?? []).filter((p) => String(p.memo_id) === mid);
        return (
          <section key={mid} aria-label={`Memo ${m.memo_no}`} className="space-y-3 break-inside-avoid rounded-md border border-gold-soft bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl text-forest"><Link href={`/dashboard/memos/${mid}`} className="underline underline-offset-4">Memo {m.memo_no}</Link></h2>
              <p className="text-sm font-semibold">{m.payment_status}</p>
            </div>
            <ul className="divide-y divide-gold-soft text-sm">
              {mo.map((o) => <li key={`o${o.sr_no}`} className="flex justify-between gap-3 py-1.5"><span>Order {o.sr_no} · {o.style_no}{o.jewelry_type ? ` · ${o.jewelry_type}` : ""}{o.date_sold ? ` · ${fmtDate(o.date_sold)}` : ""}</span><span>{usd.format(num(o.sale_price))}</span></li>)}
              {mt.map((t) => <li key={`t${t.sr_no}`} className="flex justify-between gap-3 py-1.5"><span>Trading {t.sr_no} · {t.item}{t.date_sold ? ` · ${fmtDate(t.date_sold)}` : ""}</span><span>{usd.format(num(t.sale_price))}</span></li>)}
            </ul>
            {mp.length > 0 && (
              <ul className="divide-y divide-gold-soft border-t border-gold-soft text-sm">
                {mp.map((p, i) => <li key={i} className="flex justify-between gap-3 py-1.5 text-ink-soft"><span>Payment received {fmtDate(p.paid_on)}</span><span>−{usd.format(num(p.amount))}</span></li>)}
              </ul>
            )}
            <dl className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-gold-soft pt-2 text-sm">
              <div className="flex gap-2"><dt className="text-ink-soft">Billed</dt><dd className="font-medium">{usd.format(num(m.total_bill))}</dd></div>
              <div className="flex gap-2"><dt className="text-ink-soft">Paid</dt><dd className="font-medium">{usd.format(num(m.total_paid))}</dd></div>
              <div className="flex gap-2"><dt className="text-ink-soft">Balance due</dt><dd className="font-semibold">{usd.format(num(m.balance))}</dd></div>
            </dl>
          </section>
        );
      })}

      {owner && (
        <section aria-labelledby="rename" className="space-y-3 rounded-md border border-gold-soft bg-white p-5 print:hidden">
          <h2 id="rename" className="font-display text-xl text-forest">Rename this buyer</h2>
          <RenameBuyer id={buyer.id} name={buyer.name} />
        </section>
      )}
    </div>
  );
}
