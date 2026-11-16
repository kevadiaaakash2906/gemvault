"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ArrowLeftRight, Banknote, Contact, Gem, HandCoins, Images, LayoutDashboard, LogOut, Menu, Package, PanelLeftClose, PanelLeftOpen, ReceiptText, RotateCcw, Settings, TrendingUp, Users, Wallet, X } from "lucide-react";
import { logout } from "@/app/actions/auth";

export type NavItem = { href: string; label: string; icon: "overview" | "team" | "orders" | "styles" | "trading" | "memos" | "expenses" | "settings" | "receivables" | "profit" | "returns" | "buyers" | "out" | "money" };
const ICONS = { overview: LayoutDashboard, team: Users, orders: Gem, styles: Images, trading: ArrowLeftRight, memos: ReceiptText, expenses: Wallet, settings: Settings, receivables: HandCoins, profit: TrendingUp, returns: RotateCcw, buyers: Contact, out: Package, money: Banknote };

/** The menu is shown in these groups. A page the person may not open is simply missing from `items`, and an empty group is not drawn. */
const GROUPS: { label: string; hrefs: string[] }[] = [
  { label: "Sales", hrefs: ["/dashboard/orders", "/dashboard/styles", "/dashboard/trading", "/dashboard/out"] },
  { label: "Money", hrefs: ["/dashboard/memos", "/dashboard/buyers", "/dashboard/receivables", "/dashboard/money", "/dashboard/returns"] },
  { label: "Reports", hrefs: ["/dashboard/expenses", "/dashboard/profit"] },
  { label: "Admin", hrefs: ["/dashboard/settings", "/dashboard/team"] },
];

export function Sidebar({ items, name, roleLabel }: { items: NavItem[]; name: string; roleLabel: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const byHref = new Map(items.map((i) => [i.href, i] as const));
  const grouped = new Set(GROUPS.flatMap((g) => g.hrefs));
  const sections = [
    { label: "", items: items.filter((i) => i.href === "/dashboard") },
    ...GROUPS.map((g) => ({ label: g.label, items: g.hrefs.map((h) => byHref.get(h)).filter((i): i is NavItem => !!i) })),
    { label: "More", items: items.filter((i) => i.href !== "/dashboard" && !grouped.has(i.href)) },
  ].filter((s) => s.items.length > 0);

  const link = ({ href, label, icon }: NavItem) => {
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
          "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium lg:min-h-10",
          active ? "bg-gold/20 text-ivory" : "text-gold-soft hover:bg-white/10",
        )}
      >
        <Icon className="size-5 shrink-0" aria-hidden />
        <span className={clsx(collapsed && "lg:sr-only")}>{label}</span>
      </Link>
    );
  };

  const nav = (
    <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 [scrollbar-width:thin]">
      {sections.map((s, i) => (
        <div key={s.label || "top"} role="group" aria-label={s.label || "Overview"} className={clsx("space-y-0.5", i > 0 && "mt-3")}>
          {s.label && (
            <>
              <p className={clsx("px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-gold-soft/75", collapsed && "lg:hidden")}>{s.label}</p>
              {collapsed && <div className="mx-3 hidden border-t border-white/10 lg:block" aria-hidden />}
            </>
          )}
          {s.items.map(link)}
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="shrink-0 border-t border-white/10 p-3">
      <div className="mb-2 flex items-center gap-3 px-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold/25 text-sm font-semibold text-ivory" aria-hidden>{(name.trim()[0] ?? "?").toUpperCase()}</span>
        <div className={clsx("min-w-0", collapsed && "lg:sr-only")}>
          <p className="truncate text-sm font-medium text-ivory">{name}</p>
          <p className="text-xs text-gold-soft">{roleLabel}</p>
        </div>
      </div>
      <form action={logout}>
        <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm text-gold-soft hover:bg-white/10 lg:min-h-10">
          <LogOut className="size-5 shrink-0" aria-hidden />
          <span className={clsx(collapsed && "lg:sr-only")}>Sign out</span>
        </button>
      </form>
    </div>
  );

  return (
    <>
      <header className="flex items-center justify-between bg-forest px-4 py-2 lg:hidden print:hidden">
        <p className="font-display text-xl text-ivory">Vinere</p>
        <button onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="grid size-11 place-items-center text-ivory">
          <Menu aria-hidden />
        </button>
      </header>

      {open && <div className="fade-in fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      <aside
        className={clsx(
          "print:hidden fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-forest pt-4 transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 lg:transition-[width]",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-[4.5rem]" : "lg:w-64",
        )}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between px-5">
          <p className={clsx("font-display text-2xl text-ivory", collapsed && "lg:sr-only")}>Vinere</p>
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
