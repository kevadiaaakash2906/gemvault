import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { ExpenseForm } from "../expense-form";

export const metadata: Metadata = { title: "Edit expense" };
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("expenses.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: e }, { data: cats }] = await Promise.all([
    supabase.from("expenses").select("*").eq("id", id).maybeSingle(),
    supabase.from("expenses").select("category").limit(2000),
  ]);
  if (!e) notFound();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-forest">Expense {e.sr_no}</h1>
      <ExpenseForm
        initial={{ id: e.id, expense_date: s(e.expense_date), category: e.category, description: e.description, amount: s(e.amount), seller: s(e.seller), notes: s(e.notes) }}
        categories={[...new Set((cats ?? []).map((c) => c.category as string))].sort()}
      />
      <DeleteButton kind="expense" id={id} redirectTo="/dashboard/expenses" label="Delete this expense" />
    </div>
  );
}
