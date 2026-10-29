import type { Role } from "./AuthContext";

export type NavKey = "dashboard" | "newSurplus" | "jobs" | "review" | "map" | "impact" | "myFridge";
export type NavItem = { key: NavKey; to: string };

/** Sidebar items per role. The first item is always the overview. */
export const NAV: Record<Role, NavItem[]> = {
  restaurant: [
    { key: "dashboard", to: "/app" },
    { key: "newSurplus", to: "/app/new" },
    { key: "impact", to: "/app/impact" },
  ],
  volunteer: [
    { key: "dashboard", to: "/app" },
    { key: "jobs", to: "/app/jobs" },
    { key: "map", to: "/app/map" },
  ],
  fridge_host: [
    { key: "dashboard", to: "/app" },
    { key: "myFridge", to: "/app/fridge" },
    { key: "map", to: "/app/map" },
  ],
  coordinator: [
    { key: "dashboard", to: "/app" },
    { key: "review", to: "/app/review" },
    { key: "map", to: "/app/map" },
    { key: "impact", to: "/app/impact" },
  ],
};
