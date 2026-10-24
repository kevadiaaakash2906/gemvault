import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ExpenseForm, emptyExpense } from "../expense-form";

export const metadata: Metadata = { title: "Add expense" };

export default async function NewExpensePage() {
  await requirePermission("expenses.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("expenses").select("category").limit(2000);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-forest">Add expense</h1>
      <ExpenseForm initial={emptyExpense} categories={[...new Set((data ?? []).map((c) => c.category as string))].sort()} />
    </div>
  );
}
