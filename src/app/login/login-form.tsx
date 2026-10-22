"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { login } from "@/app/actions/auth";
import { loginSchema, type LoginValues } from "@/lib/validation";
import { Button, Field, Notice } from "@/components/ui";

export function LoginForm() {
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = (values: LoginValues) =>
    startTransition(async () => {
      setServerError(undefined);
      const result = await login(values);
      if (result?.error) setServerError(result.error);
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {serverError && <Notice tone="error">{serverError}</Notice>}
      <Field id="email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
      <Field id="password" label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register("password")} />
      <Button type="submit" loading={pending} className="w-full">
        Sign in
      </Button>
    </form>
  );
}
