"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveTrade } from "@/app/actions/ledger";
import { tradeSchema, type TradeValues } from "@/lib/validation";
import { Button, Field, Notice } from "@/components/ui";

export function TradeForm({ initial, isOwner, buyers }: { initial: TradeValues; isOwner: boolean; buyers: string[] }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const [pending, start] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<TradeValues>({ resolver: zodResolver(tradeSchema), defaultValues: initial });
  const onSubmit = (values: TradeValues) =>
    start(async () => {
      setServerError(undefined);
      const r = await saveTrade(isOwner ? values : { ...values, cost: undefined });
      if (r.error) return setServerError(r.error);
      router.push("/dashboard/trading");
      router.refresh();
    });
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-3xl space-y-8">
      {serverError && <Notice tone="error">{serverError}</Notice>}
      <input type="hidden" {...register("id")} />
      <fieldset className="space-y-4 rounded-md border border-gold-soft bg-white p-5">
        <legend className="px-2 font-display text-xl text-forest">Item</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="item" label="Item" error={errors.item?.message} {...register("item")} />
          <Field id="trade_date" label="Date" type="date" error={errors.trade_date?.message} {...register("trade_date")} />
        </div>
        <Field id="notes" label="Notes" error={errors.notes?.message} {...register("notes")} />
      </fieldset>
      {isOwner && (
        <fieldset className="space-y-4 rounded-md border border-gold-soft bg-parchment p-5">
          <legend className="px-2 font-display text-xl text-forest">Purchase (owner only)</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="vendor" label="Vendor" error={errors.cost?.vendor?.message} {...register("cost.vendor")} />
            <Field id="purchase_price" label="Purchase Price (US$)" inputMode="decimal" error={errors.cost?.purchase_price?.message} {...register("cost.purchase_price")} />
          </div>
        </fieldset>
      )}
      <fieldset className="space-y-4 rounded-md border border-gold-soft bg-white p-5">
        <legend className="px-2 font-display text-xl text-forest">Sale</legend>
        <p className="text-sm text-ink-soft">Leave all four empty while it is not sold. Use the same memo number as the other pieces going to the same buyer.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="sold_to" label="Sold To" list="buyers" error={errors.sold_to?.message} {...register("sold_to")} />
          <Field id="memo_no" label="Memo" error={errors.memo_no?.message} {...register("memo_no")} />
          <Field id="sale_price" label="Sale Price (US$)" inputMode="decimal" error={errors.sale_price?.message} {...register("sale_price")} />
          <Field id="date_sold" label="Date Sold" type="date" error={errors.date_sold?.message} {...register("date_sold")} />
        </div>
        <datalist id="buyers">{buyers.map((b) => <option key={b} value={b} />)}</datalist>
      </fieldset>
      <div className="flex gap-3"><Button type="submit" loading={pending}>Save item</Button><Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button></div>
    </form>
  );
}
