import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, num, usd } from "@/lib/ledger";
import { DeletePermanently } from "@/components/delete-permanently";

export const metadata: Metadata = { title: "Return" };

export default async function ReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("returns.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: r } = await supabase.from("returns").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const refund = num(r.refund);
  const facts: [string, React.ReactNode][] = [
    ["Piece", <Link key="p" href={`/dashboard/${r.kind === "order" ? "orders" : "trading"}/${r.piece_id}`} className="underline underline-offset-4">{r.kind === "order" ? "Order" : "Trade"} #{r.sr_no} · {r.label}</Link>],
    ["Buyer", r.buyer],
    ["Memo", <Link key="m" href={`/dashboard/memos/${r.memo_id}`} className="underline underline-offset-4">{r.memo_no}</Link>],
    ["Sold on", fmtDate(r.date_sold)],
    ["Returned on", fmtDate(r.returned_on)],
    ["Sale price", usd.format(num(r.sale_price))],
    ["Refund to buyer", refund > 0 ? usd.format(refund) : "None"],
    ["Reason", r.reason],
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/returns" className="text-sm text-gold-deep underline underline-offset-4">← All returns</Link>
        <h1 className="mt-1 font-display text-3xl text-forest">Return · {r.label}</h1>
      </div>
      <dl className="grid gap-4 rounded-md border border-gold-soft bg-white p-5 sm:grid-cols-2">
        {facts.map(([k, v]) => <div key={k}><dt className="text-sm text-ink-soft">{k}</dt><dd className="font-medium break-words">{v}</dd></div>)}
      </dl>
      {can(session.role, "returns.delete") && (
        <DeletePermanently kind="return" id={id} title="Delete this return permanently" redirectTo="/dashboard/returns"
          lines={[
            "Only this record is removed. The piece stays in stock and sales and profit do not change.",
            ...(refund > 0 ? [`This return refunded ${usd.format(refund)} to the buyer. It can only be deleted while the memo would not end up overpaid; otherwise delete the whole memo once it has no pieces.`] : []),
            "A full copy is kept in the audit log.",
          ]} />
      )}
    </div>
  );
}
