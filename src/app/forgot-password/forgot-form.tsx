"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { requestPasswordReset } from "@/app/actions/auth";
import { resetRequestSchema, type ResetRequestValues } from "@/lib/validation";
import { Button, Field, Notice } from "@/components/ui";

export function ForgotForm() {
  const [result, setResult] = useState<{ error?: string; success?: string }>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetRequestValues>({ resolver: zodResolver(resetRequestSchema) });

  const onSubmit = (values: ResetRequestValues) =>
    startTransition(async () => setResult(await requestPasswordReset(values)));

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {result?.error && <Notice tone="error">{result.error}</Notice>}
      {result?.success && <Notice tone="success">{result.success}</Notice>}
      <Field id="email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
      <Button type="submit" loading={pending} className="w-full">
        Send reset link
      </Button>
    </form>
  );
}
