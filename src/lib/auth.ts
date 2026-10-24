import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, type Permission, type Role } from "@/lib/permissions";

export type Session = {
  userId: string;
  email: string;
  fullName: string | null;
  role: Role | null;
  isActive: boolean;
};

export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: roleRow }] = await Promise.all([
    supabase.from("profiles").select("full_name,email,is_active").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);

  const isActive = profile?.is_active ?? false;
  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? "",
    fullName: profile?.full_name ?? null,
    role: isActive ? ((roleRow?.role as Role | undefined) ?? null) : null,
    isActive,
  };
});

/** Use at the top of every private page and every server action. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requirePermission(permission: Permission): Promise<Session & { role: Role }> {
  const session = await requireSession();
  if (!session.role) redirect("/dashboard");
  if (!can(session.role, permission)) redirect("/dashboard?denied=1");
  return session as Session & { role: Role };
}
