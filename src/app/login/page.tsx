import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthShell title="Sign in" intro="Use the email and password your owner set up for you.">
      <LoginForm />
      <p className="mt-6 text-sm">
        <Link href="/forgot-password" className="font-medium text-gold-deep underline underline-offset-4">
          Forgot your password?
        </Link>
      </p>
    </AuthShell>
  );
}
