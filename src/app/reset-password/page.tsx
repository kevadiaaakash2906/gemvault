import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AuthShell title="Link expired" intro="This reset link is no longer valid.">
        <Link href="/forgot-password" className="font-medium text-gold-deep underline underline-offset-4">
          Request a new reset link
        </Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Choose a new password" intro="Use at least 10 characters, with letters and numbers.">
      <ResetForm />
    </AuthShell>
  );
}
