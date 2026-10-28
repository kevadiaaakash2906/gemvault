import { requireSession } from "@/lib/auth";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { Sidebar, type NavItem } from "@/components/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  const items: NavItem[] = [{ href: "/dashboard", label: "Overview", icon: "overview" }];
  if (can(session.role, "orders.view")) items.push({ href: "/dashboard/orders", label: "Orders", icon: "orders" });
  if (can(session.role, "styles.view")) items.push({ href: "/dashboard/styles", label: "Styles", icon: "styles" });
  if (can(session.role, "trades.view")) items.push({ href: "/dashboard/trading", label: "Trading", icon: "trading" });
  if (can(session.role, "memos.view")) items.push({ href: "/dashboard/memos", label: "Memos", icon: "memos" });
  if (can(session.role, "receivables.view")) items.push({ href: "/dashboard/receivables", label: "Who owes me", icon: "receivables" });
  if (can(session.role, "returns.view")) items.push({ href: "/dashboard/returns", label: "Returns", icon: "returns" });
  if (can(session.role, "expenses.manage")) items.push({ href: "/dashboard/expenses", label: "Expenses", icon: "expenses" });
  if (can(session.role, "reports.profit")) items.push({ href: "/dashboard/profit", label: "Profit", icon: "profit" });
  if (can(session.role, "settings.edit")) items.push({ href: "/dashboard/settings", label: "Rates", icon: "settings" });
  if (can(session.role, "team.manage")) items.push({ href: "/dashboard/team", label: "Team", icon: "team" });

  return (
    <div className="min-h-dvh lg:flex">
      <Sidebar
        items={items}
        name={session.fullName || session.email}
        roleLabel={session.role ? ROLE_LABEL[session.role] : "No role yet"}
      />
      <main id="main" className="min-w-0 flex-1 px-5 py-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
