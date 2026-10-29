import type { Role } from "./AuthContext";

/**
 * One-tap demo accounts. They only exist if supabase/06 and 07 were run, and they only see sample data.
 * The password is public on purpose. Remove the accounts (supabase/08) before a real launch.
 */
export const DEMO_PASSWORD = "BarakatDemo#2026";

export const demoEmails: Record<Role, string> = {
  restaurant: "restaurant.demo@barakat.test",
  volunteer: "volunteer.demo@barakat.test",
  fridge_host: "host.demo@barakat.test",
  coordinator: "coordinator.demo@barakat.test",
};

/** What the role banner shows when Supabase is not connected (local demo mode). */
export const localRecords: Record<Role, { name: string; title: string; subtitle: string }> = {
  restaurant: { name: "Demo Restaurant", title: "Zaytoun Mezze Bar", subtitle: "Business Bay · Mezze" },
  volunteer: { name: "Demo Volunteer", title: "Bilal Sharma", subtitle: "Business Bay · Van" },
  fridge_host: { name: "Demo Fridge Host", title: "FR-014 Downtown Dubai Mall Entrance", subtitle: "Downtown Dubai · 29/97" },
  coordinator: { name: "Demo Coordinator", title: "", subtitle: "" },
};
