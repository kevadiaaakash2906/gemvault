"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveExpense } from "@/app/actions/ledger";
import { expenseSchema, type ExpenseValues } from "@/lib/validation";
import { Button, Field, Notice } from "@/components/ui";

export const emptyExpense: ExpenseValues = { expense_date: new Date().toISOString().slice(0, 10), category: "", description: "", amount: "", seller: "", notes: "" };

export function ExpenseForm({ initial, categories }: { initial: ExpenseValues; categories: string[] }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const [pending, start] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<ExpenseValues>({ resolver: zodResolver(expenseSchema), defaultValues: initial });
  const onSubmit = (values: ExpenseValues) =>
    start(async () => {
      setServerError(undefined);
      const r = await saveExpense(values);
      if (r.error) return setServerError(r.error);
      router.push("/dashboard/expenses");
      router.refresh();
    });
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-2xl space-y-5">
      {serverError && <Notice tone="error">{serverError}</Notice>}
      <input type="hidden" {...register("id")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="expense_date" label="Date" type="date" error={errors.expense_date?.message} {...register("expense_date")} />
        <Field id="category" label="Category" list="cats" error={errors.category?.message} {...register("category")} />
        <Field id="amount" label="Amount (US$)" inputMode="decimal" error={errors.amount?.message} {...register("amount")} />
        <Field id="seller" label="Seller" error={errors.seller?.message} {...register("seller")} />
      </div>
      <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      <Field id="description" label="Description" error={errors.description?.message} {...register("description")} />
      <Field id="notes" label="Notes" error={errors.notes?.message} {...register("notes")} />
      <div className="flex gap-3"><Button type="submit" loading={pending}>Save expense</Button><Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button></div>
    </form>
  );
}
