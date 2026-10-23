"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Gem, LayoutDashboard, LogOut, MapPin, Menu, PanelLeftClose, PanelLeftOpen, Users, X } from "lucide-react";
import { logout } from "@/app/actions/auth";

export type NavItem = { href: string; label: string; icon: "overview" | "team" | "inventory" | "locations" };
const ICONS = { overview: LayoutDashboard, team: Users, inventory: Gem, locations: MapPin };

export function Sidebar({ items, name, roleLabel }: { items: NavItem[]; name: string; roleLabel: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const nav = (
    <nav aria-label="Main" className="flex-1 space-y-1 px-3">
      {items.map(({ href, label, icon }) => {
        const Icon = ICONS[icon];
        const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            title={collapsed ? label : undefined}
            className={clsx(
              "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium",
              active ? "bg-gold/20 text-ivory" : "text-gold-soft hover:bg-white/10",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            <span className={clsx(collapsed && "lg:sr-only")}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-white/10 p-3">
      <div className={clsx("mb-2 px-3", collapsed && "lg:sr-only")}>
        <p className="truncate text-sm font-medium text-ivory">{name}</p>
        <p className="text-xs text-gold-soft">{roleLabel}</p>
      </div>
      <form action={logout}>
        <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm text-gold-soft hover:bg-white/10">
          <LogOut className="size-5 shrink-0" aria-hidden />
          <span className={clsx(collapsed && "lg:sr-only")}>Sign out</span>
        </button>
      </form>
    </div>
  );

  return (
    <>
      <header className="flex items-center justify-between bg-forest px-4 py-2 lg:hidden">
        <p className="font-display text-xl text-ivory">GemVault</p>
        <button onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="grid size-11 place-items-center text-ivory">
          <Menu aria-hidden />
        </button>
      </header>

      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-forest py-4 transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 lg:transition-[width]",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-[4.5rem]" : "lg:w-64",
        )}
      >
        <div className="mb-6 flex items-center justify-between px-5">
          <p className={clsx("font-display text-2xl text-ivory", collapsed && "lg:sr-only")}>GemVault</p>
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="grid size-11 place-items-center text-ivory lg:hidden">
            <X aria-hidden />
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden size-11 place-items-center text-gold-soft hover:text-ivory lg:grid"
          >
            {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
          </button>
        </div>
        {nav}
        {footer}
      </aside>
    </>
  );
}
