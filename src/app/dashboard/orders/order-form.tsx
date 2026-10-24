"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveOrder } from "@/app/actions/ledger";
import { orderSchema, type OrderValues } from "@/lib/validation";
import { computeCosts, inr, num, usd } from "@/lib/ledger";
import { Button, Field, Notice } from "@/components/ui";

export const emptyOrder = (rates: { defaultMultiplier: number; defaultLabor: number; goldRate: number } | null): OrderValues => ({
  customer: "", style_no: "", jewelry_type: "", diamond_shape: "", order_date: new Date().toISOString().slice(0, 10),
  gross_wt: "", dia_qty: "", in_ct: "", colour_stone: "", net_wt: "", multiplier: rates ? String(rates.defaultMultiplier) : "0.595",
  sold_to: "", memo_no: "", sale_price: "", date_sold: "",
  cost: rates ? { gold_rate: String(rates.goldRate), diam_amount: "", l_charges: String(rates.defaultLabor), flat_labor: false } : undefined,
});

export function OrderForm({
  initial, isOwner, usdRate, buyers, types,
}: { initial: OrderValues; isOwner: boolean; usdRate: number | null; buyers: string[]; types: string[] }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const [pending, start] = useTransition();
  const { register, control, handleSubmit, formState: { errors } } = useForm<OrderValues>({ resolver: zodResolver(orderSchema), defaultValues: initial });
  const w = useWatch({ control });

  const net = num(w.net_wt), mult = num(w.multiplier);
  const preview = isOwner && usdRate && w.cost
    ? computeCosts({ net, multiplier: mult, goldRate: num(w.cost.gold_rate), diamAmount: num(w.cost.diam_amount), lCharges: num(w.cost.l_charges), flatLabor: !!w.cost.flat_labor, usdRate })
    : null;
  const pgPreview = Math.round(net * mult * 1000) / 1000;

  const onSubmit = (values: OrderValues) =>
    start(async () => {
      setServerError(undefined);
      const r = await saveOrder(isOwner ? values : { ...values, cost: undefined });
      if (r.error) return setServerError(r.error);
      router.push("/dashboard/orders");
      router.refresh();
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-4xl space-y-8">
      {serverError && <Notice tone="error">{serverError}</Notice>}
      <input type="hidden" {...register("id")} />

      <fieldset className="space-y-4 rounded-md border border-gold-soft bg-white p-5">
        <legend className="px-2 font-display text-xl text-forest">Piece</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="style_no" label="Style No." error={errors.style_no?.message} {...register("style_no")} />
          <Field id="customer" label="CUSTOMER" error={errors.customer?.message} {...register("customer")} />
          <Field id="order_date" label="Date" type="date" error={errors.order_date?.message} {...register("order_date")} />
          <Field id="jewelry_type" label="Jewelry Type" list="types" error={errors.jewelry_type?.message} {...register("jewelry_type")} />
          <Field id="diamond_shape" label="Diamond Shape" error={errors.diamond_shape?.message} {...register("diamond_shape")} />
        </div>
        <datalist id="types">{types.map((t) => <option key={t} value={t} />)}</datalist>
      </fieldset>

      <fieldset className="space-y-4 rounded-md border border-gold-soft bg-white p-5">
        <legend className="px-2 font-display text-xl text-forest">Weights</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="gross_wt" label="Gross Wt (g)" inputMode="decimal" error={errors.gross_wt?.message} {...register("gross_wt")} />
          <Field id="net_wt" label="Net Wt (g)" inputMode="decimal" error={errors.net_wt?.message} {...register("net_wt")} />
          <Field id="multiplier" label="Multiplier" inputMode="decimal" error={errors.multiplier?.message} {...register("multiplier")} />
          <Field id="dia_qty" label="Dia Qty" inputMode="numeric" error={errors.dia_qty?.message} {...register("dia_qty")} />
          <Field id="in_ct" label="IN CT" inputMode="decimal" error={errors.in_ct?.message} {...register("in_ct")} />
          <Field id="colour_stone" label="COLOUR STONE" inputMode="decimal" error={errors.colour_stone?.message} {...register("colour_stone")} />
        </div>
        <p className="text-sm text-ink-soft">Pg Wt (worked out automatically): <strong>{net && mult ? pgPreview : "—"}</strong></p>
      </fieldset>

      {isOwner && usdRate && (
        <fieldset className="space-y-4 rounded-md border border-gold-soft bg-parchment p-5">
          <legend className="px-2 font-display text-xl text-forest">Cost (owner only)</legend>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="gold_rate" label="Gold rate (₹ per g)" inputMode="decimal" error={errors.cost?.gold_rate?.message} {...register("cost.gold_rate")} />
            <Field id="diam_amount" label="Diam Amount (₹)" inputMode="decimal" error={errors.cost?.diam_amount?.message} {...register("cost.diam_amount")} />
            <Field id="l_charges" label="L CHARGES" inputMode="decimal" error={errors.cost?.l_charges?.message} {...register("cost.l_charges")} />
            <label className="flex min-h-11 items-center gap-2 self-end text-sm"><input type="checkbox" className="size-5" {...register("cost.flat_labor")} /> Flat labour (not per gram)</label>
          </div>
          {preview && (
            <dl className="grid gap-3 text-sm sm:grid-cols-4" aria-live="polite">
              <div><dt className="text-ink-soft">Gold Amount</dt><dd className="font-medium">{inr.format(preview.gold)}</dd></div>
              <div><dt className="text-ink-soft">Labor Amount</dt><dd className="font-medium">{inr.format(preview.labor)}</dd></div>
              <div><dt className="text-ink-soft">Sub Total</dt><dd className="font-medium">{inr.format(preview.sub)}</dd></div>
              <div><dt className="text-ink-soft">$ (at {usdRate})</dt><dd className="font-medium">{usd.format(preview.usd)}</dd></div>
            </dl>
          )}
          <p className="text-xs text-ink-soft">Staff can add orders but never see these amounts.</p>
        </fieldset>
      )}

      <fieldset className="space-y-4 rounded-md border border-gold-soft bg-white p-5">
        <legend className="px-2 font-display text-xl text-forest">Sale</legend>
        <p className="text-sm text-ink-soft">Leave all four empty while the piece is not sold. Pieces with the same memo number share one bill and one set of payments.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="sold_to" label="Sold To" list="buyers" error={errors.sold_to?.message} {...register("sold_to")} />
          <Field id="memo_no" label="Memo" error={errors.memo_no?.message} {...register("memo_no")} />
          <Field id="sale_price" label="Sale Price (US$)" inputMode="decimal" error={errors.sale_price?.message} {...register("sale_price")} />
          <Field id="date_sold" label="Date Sold" type="date" error={errors.date_sold?.message} {...register("date_sold")} />
        </div>
        <datalist id="buyers">{buyers.map((b) => <option key={b} value={b} />)}</datalist>
      </fieldset>

      <div className="flex gap-3">
        <Button type="submit" loading={pending}>Save order</Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
