import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Notice } from "@/components/ui";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset password" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  return (
    <AuthShell title="Reset your password" intro="Enter your email and we will send you a link to choose a new password.">
      {expired && (
        <div className="mb-5">
          <Notice tone="error">That link has expired or was already used. Request a new one below.</Notice>
        </div>
      )}
      <ForgotForm />
      <p className="mt-6 text-sm">
        <Link href="/login" className="font-medium text-gold-deep underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
