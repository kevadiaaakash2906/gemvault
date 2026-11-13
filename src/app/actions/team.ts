"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { renameSchema, setActiveSchema, setRoleSchema } from "@/lib/validation";
import type { ActionResult } from "@/app/actions/auth";

// Permission is checked here AND again inside the database functions.
export async function setUserRole(values: unknown): Promise<ActionResult> {
  await requirePermission("team.manage");
  const parsed = setRoleSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_role", { target: parsed.data.userId, new_role: parsed.data.role });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/team");
  return { success: "Role updated." };
}

/** The owner chooses the name people are shown by (instead of their email). A blank name goes back to the email. */
export async function renameUser(values: unknown): Promise<ActionResult> {
  await requirePermission("team.manage");
  const parsed = renameSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_user", { target: parsed.data.userId, new_name: parsed.data.name });
  if (error) return { error: error.message };
  revalidatePath("/dashboard", "layout");   // the menu, the money ledger and the Overview all show names
  return { success: parsed.data.name ? "Name saved." : "Name cleared. The email is shown again." };
}

export async function setUserActive(values: unknown): Promise<ActionResult> {
  await requirePermission("team.manage");
  const parsed = setActiveSchema.safeParse(values);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_active", { target: parsed.data.userId, active: parsed.data.active });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/team");
  return { success: parsed.data.active ? "Account activated." : "Account deactivated." };
}
