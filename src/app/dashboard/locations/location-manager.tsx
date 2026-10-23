"use client";

import { useState, useTransition } from "react";
import { createLocation, setLocationActive } from "@/app/actions/inventory";
import type { ActionResult } from "@/app/actions/auth";
import { Button, Field, Notice } from "@/components/ui";

export function LocationManager({ locations }: { locations: { id: string; name: string; is_active: boolean }[] }) {
  const [msg, setMsg] = useState<ActionResult>();
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-5">
      <ul className="divide-y divide-gold-soft rounded-md border border-gold-soft bg-white">
        {locations.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 p-4">
            <span className={l.is_active ? "font-medium" : "text-ink-soft line-through"}>{l.name}</span>
            <Button
              variant="ghost"
              loading={pending}
              onClick={() => window.confirm(`${l.is_active ? "Switch off" : "Switch on"} ${l.name}?`) &&
                start(async () => setMsg(await setLocationActive({ id: l.id, active: !l.is_active })))}
            >
              {l.is_active ? "Switch off" : "Switch on"}
            </Button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => { const r = await createLocation({ name }); setMsg(r); if (r.success) setName(""); });
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="min-w-56 flex-1"><Field id="loc-name" label="New location" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <Button type="submit" loading={pending}>Add location</Button>
      </form>
      {msg?.error && <Notice tone="error">{msg.error}</Notice>}
      {msg?.success && <Notice tone="success">{msg.success}</Notice>}
    </div>
  );
}
