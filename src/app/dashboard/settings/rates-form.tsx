"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveRates } from "@/app/actions/ledger";
import type { ActionResult } from "@/app/actions/auth";
import { ratesSchema, type RatesValues } from "@/lib/validation";
import { Button, Field, Notice } from "@/components/ui";

export function RatesForm({ initial }: { initial: RatesValues }) {
  const [msg, setMsg] = useState<ActionResult>();
  const [pending, start] = useTransition();
  const { register, handleSubmit, formState: { errors } } = useForm<RatesValues>({ resolver: zodResolver(ratesSchema), defaultValues: initial });
  return (
    <form onSubmit={handleSubmit((v) => start(async () => setMsg(await saveRates(v))))} noValidate className="space-y-5">
      {msg?.error && <Notice tone="error">{msg.error}</Notice>}
      {msg?.success && <Notice tone="success">{msg.success}</Notice>}
      <Field id="gold_rate" label="Gold rate (₹ per gram of pure gold)" inputMode="decimal" error={errors.gold_rate?.message} {...register("gold_rate")} />
      <Field id="usd_rate" label="Dollar rate (₹ per US$1)" inputMode="decimal" error={errors.usd_rate?.message} {...register("usd_rate")} />
      <Field id="default_multiplier" label="Default Multiplier" inputMode="decimal" error={errors.default_multiplier?.message} {...register("default_multiplier")} />
      <Field id="default_labor" label="Default L CHARGES (₹ per gram)" inputMode="decimal" error={errors.default_labor?.message} {...register("default_labor")} />
      <Button type="submit" loading={pending}>Save rates</Button>
    </form>
  );
}
