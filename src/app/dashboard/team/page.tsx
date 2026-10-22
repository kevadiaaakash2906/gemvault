import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TeamRow } from "./team-row";
import type { Role } from "@/lib/permissions";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const session = await requirePermission("team.manage");
  const supabase = await createClient();

  const [{ data: profiles }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("id,email,full_name,is_active").order("created_at"),
    supabase.from("user_roles").select("user_id,role"),
  ]);
  const roleOf = new Map((roles ?? []).map((r) => [r.user_id as string, r.role as Role]));

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl text-forest">Team</h1>
        <p className="mt-1 text-ink-soft">
          Add people in Supabase (Authentication, then Users), then give them a role here. You cannot change your own role.
        </p>
      </div>
      <ul className="divide-y divide-gold-soft rounded-md border border-gold-soft bg-white">
        {(profiles ?? []).map((p) => (
          <TeamRow
            key={p.id}
            userId={p.id}
            email={p.email}
            name={p.full_name}
            role={roleOf.get(p.id) ?? null}
            active={p.is_active}
            isSelf={p.id === session.userId}
          />
        ))}
        {(profiles ?? []).length === 0 && <li className="p-4 text-ink-soft">No accounts yet.</li>}
      </ul>
    </div>
  );
}
