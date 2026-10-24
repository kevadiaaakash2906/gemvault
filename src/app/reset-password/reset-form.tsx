"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updatePassword } from "@/app/actions/auth";
import { newPasswordSchema, type NewPasswordValues } from "@/lib/validation";
import { Button, Field, Notice } from "@/components/ui";

export function ResetForm() {
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewPasswordValues>({ resolver: zodResolver(newPasswordSchema) });

  const onSubmit = (values: NewPasswordValues) =>
    startTransition(async () => {
      setServerError(undefined);
      const result = await updatePassword(values);
      if (result?.error) setServerError(result.error);
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {serverError && <Notice tone="error">{serverError}</Notice>}
      <Field id="password" label="New password" type="password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
      <Field id="confirm" label="Repeat new password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
      <Button type="submit" loading={pending} className="w-full">
        Save new password
      </Button>
    </form>
  );
}
