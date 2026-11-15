"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { refreshUnsoldCosts, saveRates } from "@/app/actions/ledger";
import type { ActionResult } from "@/app/actions/auth";
import { ratesSchema, type RatesValues } from "@/lib/validation";
import { Button, Field, Notice } from "@/components/ui";

export function RatesForm({ initial }: { initial: RatesValues }) {
  const [msg, setMsg] = useState<ActionResult>();
  const [pending, start] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<RatesValues>({ resolver: zodResolver(ratesSchema), defaultValues: initial });

  const save = (v: RatesValues) => start(async () => {
    const r = await saveRates(v);
    setMsg(r);
    if (r.success) reset(v);   // the saved values are now the starting point, so the form is "clean" again
  });

  const refresh = () => {
    if (!window.confirm("Update the cost of every unsold order to the saved gold and dollar rates? Sold pieces keep their amounts.")) return;
    startRefresh(async () => setMsg(await refreshUnsoldCosts()));
  };

  return (
    <form onSubmit={handleSubmit(save)} noValidate className="space-y-5">
      {msg?.error && <Notice tone="error">{msg.error}</Notice>}
      {msg?.success && <Notice tone="success">{msg.success}</Notice>}
      <Field id="gold_rate" label="Gold rate (₹ per gram of pure gold)" inputMode="decimal" error={errors.gold_rate?.message} {...register("gold_rate")} />
      <Field id="usd_rate" label="Dollar rate (₹ per US$1)" inputMode="decimal" error={errors.usd_rate?.message} {...register("usd_rate")} />
      <Field id="default_multiplier" label="Default Multiplier" inputMode="decimal" error={errors.default_multiplier?.message} {...register("default_multiplier")} />
      <Field id="default_labor" label="Default L CHARGES (₹ per gram)" inputMode="decimal" error={errors.default_labor?.message} {...register("default_labor")} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>Save rates</Button>
        <Button type="button" variant="ghost" loading={refreshing} disabled={isDirty || pending} onClick={refresh}>Update unsold pieces to these rates</Button>
      </div>
      <p className="text-sm text-ink-soft">
        {isDirty ? "Save the rates first, then update the unsold pieces." : "Recalculates Gold Amount, Labor Amount, Sub Total and the $ cost of every unsold order that has a cost. Sold pieces are not changed."}
      </p>
    </form>
  );
}
