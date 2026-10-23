import clsx from "clsx";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { Loader2 } from "lucide-react";

export function Button({
  variant = "primary",
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger"; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-forest text-ivory hover:bg-forest-deep",
        variant === "ghost" && "border border-gold-soft bg-white text-charcoal hover:bg-parchment",
        variant === "danger" && "bg-danger text-white hover:bg-red-900",
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Field({
  label,
  error,
  hint,
  id,
  ...props
}: ComponentProps<"input"> & { label: string; error?: string; hint?: string; id: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
        className="block min-h-11 w-full rounded-md border border-gold-soft bg-white px-3 text-base placeholder:text-ink-soft/60 aria-[invalid=true]:border-danger"
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function Notice({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={clsx(
        "rounded-md border px-3 py-2 text-sm",
        tone === "error" ? "border-danger/40 bg-red-50 text-danger" : "border-forest/30 bg-emerald-50 text-forest",
      )}
    >
      {children}
    </p>
  );
}

export function SelectField({
  label,
  error,
  id,
  children,
  ...props
}: ComponentProps<"select"> & { label: string; error?: string; id: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
        className="block min-h-11 w-full rounded-md border border-gold-soft bg-white px-3 text-base aria-[invalid=true]:border-danger"
      >
        {children}
      </select>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextAreaField({
  label,
  error,
  id,
  ...props
}: ComponentProps<"textarea"> & { label: string; error?: string; id: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
        className="block w-full rounded-md border border-gold-soft bg-white px-3 py-2 text-base aria-[invalid=true]:border-danger"
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
