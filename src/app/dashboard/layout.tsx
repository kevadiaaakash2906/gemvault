import { requireSession } from "@/lib/auth";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { Sidebar, type NavItem } from "@/components/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  const items: NavItem[] = [{ href: "/dashboard", label: "Overview", icon: "overview" }];
  if (can(session.role, "inventory.view")) items.push({ href: "/dashboard/inventory", label: "Inventory", icon: "inventory" });
  if (can(session.role, "locations.manage")) items.push({ href: "/dashboard/locations", label: "Locations", icon: "locations" });
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
