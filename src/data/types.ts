export type Tier = "green" | "amber" | "red";

export type Fridge = {
  id: string;
  code: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  capacity: number;
  stock: number;
  status: "active" | "paused" | "offline";
  open24h: boolean;
};

export type RecentBatch = {
  id: string;
  restaurantName: string;
  area: string;
  status: string;
  tier: Tier | null;
  portions: number;
  items: string[];
  submittedAt: string;
};

export type DashboardData = {
  /** where the numbers came from */
  source: "supabase" | "sample";
  /** true when Supabase is configured but could not be reached, so sample data is shown instead */
  fellBack: boolean;
  counts: { fridges: number; restaurants: number; volunteers: number; batches: number };
  totals: { meals: number; kg: number; co2eKg: number; rescuedBatches: number };
  activeRescues: number;
  reviewQueue: number;
  /** soonest safe-until time among live batches, if any */
  nextSafeUntil: string | null;
  recent: RecentBatch[];
  fridges: Fridge[];
};
