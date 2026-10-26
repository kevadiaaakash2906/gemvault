// Plain module (no "use client") so server pages can use emptyExpense.
import type { ExpenseValues } from "@/lib/validation";
export { ExpenseForm } from "./expense-form-client";

export const emptyExpense: ExpenseValues = { expense_date: new Date().toISOString().slice(0, 10), category: "", description: "", amount: "", seller: "", notes: "" };
