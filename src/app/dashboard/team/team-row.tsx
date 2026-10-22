"use client";

import { useState, useTransition } from "react";
import { setUserActive, setUserRole } from "@/app/actions/team";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/permissions";
import { Button, Notice } from "@/components/ui";

type Props = { userId: string; email: string; name: string | null; role: Role | null; active: boolean; isSelf: boolean };

export function TeamRow({ userId, email, name, role, active, isSelf }: Props) {
  const [choice, setChoice] = useState<Role | "">(role ?? "");
  const [message, setMessage] = useState<{ error?: string; success?: string }>();
  const [pending, startTransition] = useTransition();

  const saveRole = () => {
    if (!choice) return setMessage({ error: "Choose a role first." });
    if (!window.confirm(`Make ${name || email} ${ROLE_LABEL[choice]}?`)) return;
    startTransition(async () => setMessage(await setUserRole({ userId, role: choice })));
  };

  const toggleActive = () => {
    const verb = active ? "Deactivate" : "Activate";
    if (!window.confirm(`${verb} ${name || email}?`)) return;
    startTransition(async () => setMessage(await setUserActive({ userId, active: !active })));
  };

  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {name || email} {isSelf && <span className="text-sm text-ink-soft">(you)</span>}
          </p>
          <p className="truncate text-sm text-ink-soft">
            {name ? email + " · " : ""}
            {role ? ROLE_LABEL[role] : "No role yet"}
            {!active && " · Deactivated"}
          </p>
        </div>
        {!isSelf && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`role-${userId}`}>
              Role for {name || email}
            </label>
            <select
              id={`role-${userId}`}
              value={choice}
              onChange={(e) => setChoice(e.target.value as Role | "")}
              className="min-h-11 rounded-md border border-gold-soft bg-white px-3"
            >
              <option value="">Choose role</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <Button onClick={saveRole} loading={pending} disabled={choice === (role ?? "")}>
              Save role
            </Button>
            <Button variant={active ? "danger" : "ghost"} onClick={toggleActive} loading={pending}>
              {active ? "Deactivate" : "Activate"}
            </Button>
          </div>
        )}
      </div>
      {message?.error && <Notice tone="error">{message.error}</Notice>}
      {message?.success && <Notice tone="success">{message.success}</Notice>}
    </li>
  );
}
