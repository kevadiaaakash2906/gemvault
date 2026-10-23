import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LocationManager } from "./location-manager";

export const metadata: Metadata = { title: "Locations" };

export default async function LocationsPage() {
  await requirePermission("locations.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("stock_locations").select("id,name,is_active").order("name");
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl text-forest">Stock locations</h1>
        <p className="mt-1 text-ink-soft">Places where stock is kept, such as a shop, a vault or a workshop. A location cannot be deleted, but it can be switched off.</p>
      </div>
      <LocationManager locations={data ?? []} />
    </div>
  );
}
