import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, num, usd } from "@/lib/ledger";
import { AddPayment, VoidPayment } from "./payment-panel";
import { DeletePermanently } from "@/components/delete-permanently";

export const metadata: Metadata = { title: "Memo" };

export default async function MemoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("memos.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: m }, { data: orders }, { data: trades }, { data: pays }] = await Promise.all([
    supabase.from("memo_summary").select("*").eq("id", id).maybeSingle(),
    supabase.from("orders").select("id,sr_no,style_no,jewelry_type,sale_price,date_sold").eq("memo_id", id).order("sr_no"),
    supabase.from("trades").select("id,sr_no,item,sale_price,date_sold").eq("memo_id", id).order("sr_no"),
    supabase.from("payments").select("*").eq("memo_id", id).order("paid_on").order("created_at"),
  ]);
  if (!m) notFound();
  const balance = num(m.balance);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/dashboard/memos" className="text-sm text-gold-deep underline underline-offset-4">← All memos</Link>
        <h1 className="mt-1 font-display text-3xl text-forest">Memo {m.memo_no}</h1>
        <p className="text-ink-soft">Sold to {m.buyer}</p>
      </div>
      <dl className="grid gap-4 rounded-md border border-gold-soft bg-white p-5 sm:grid-cols-4">
        <div><dt className="text-sm text-ink-soft">Bill</dt><dd className="text-xl font-medium">{usd.format(num(m.total_bill))}</dd></div>
        <div><dt className="text-sm text-ink-soft">Paid</dt><dd className="text-xl font-medium">{usd.format(num(m.total_paid))}</dd></div>
        <div><dt className="text-sm text-ink-soft">Balance due</dt><dd className="text-xl font-medium">{usd.format(balance)}</dd></div>
        <div><dt className="text-sm text-ink-soft">Status</dt><dd className="text-xl font-medium">{m.payment_status}</dd></div>
      </dl>

      <section aria-labelledby="pieces" className="rounded-md border border-gold-soft bg-white p-5">
        <h2 id="pieces" className="font-display text-xl text-forest">Pieces on this memo</h2>
        <ul className="mt-2 divide-y divide-gold-soft">
          {(orders ?? []).map((o) => (
            <li key={o.id} className="flex justify-between gap-3 py-2"><Link href={`/dashboard/orders/${o.id}`} className="underline underline-offset-4">Order {o.sr_no} · {o.style_no}{o.jewelry_type ? ` · ${o.jewelry_type}` : ""}</Link><span>{usd.format(num(o.sale_price))}</span></li>
          ))}
          {(trades ?? []).map((t) => (
            <li key={t.id} className="flex justify-between gap-3 py-2"><Link href={`/dashboard/trading/${t.id}`} className="underline underline-offset-4">Trading {t.sr_no} · {t.item}</Link><span>{usd.format(num(t.sale_price))}</span></li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="payments" className="space-y-4 rounded-md border border-gold-soft bg-white p-5">
        <h2 id="payments" className="font-display text-xl text-forest">Payments</h2>
        {(pays ?? []).length === 0 ? <p className="text-ink-soft">No payments yet.</p> : (
          <ul className="divide-y divide-gold-soft">
            {(pays ?? []).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <div className={p.voided_at ? "text-ink-soft line-through" : ""}>
                  <p className="font-medium">{usd.format(num(p.amount))}</p><p className="text-sm">{fmtDate(p.paid_on)}</p>
                </div>
                {p.voided_at ? <p className="text-sm text-danger">Cancelled: {p.void_reason}</p> : can(session.role, "payments.void") && <VoidPayment paymentId={p.id} />}
              </li>
            ))}
          </ul>
        )}
        {can(session.role, "payments.record") && <AddPayment memoId={id} balance={balance} />}
      </section>

      {can(session.role, "memos.delete") && (
        <DeletePermanently kind="memo" id={id} title="Delete this memo permanently" redirectTo="/dashboard/memos"
          blocked={num(m.pieces) > 0 ? `This memo still has ${num(m.pieces)} ${num(m.pieces) === 1 ? "piece" : "pieces"} on it. Return ${num(m.pieces) === 1 ? "it" : "them"} first (open the piece, then Return this piece), and then the empty memo can be deleted.` : undefined}
          lines={["The memo, its payments and its return records are removed for good.", "Only an empty memo can be deleted, so no sale is lost.", "A full copy is kept in the audit log."]} />
      )}    </div>
  );
}
