import { supabase } from "../lib/supabase";
import type { DashboardData, Fridge, RecentBatch, Tier } from "./types";

const ACTIVE = ["listed", "matched", "dispatched", "picked_up"];

// ---------------------------------------------------------------- Supabase
async function fromSupabase(): Promise<DashboardData> {
  const sb = supabase;
  if (!sb) throw new Error("Supabase is not configured");

  const head = (table: string) => sb.from(table).select("id", { count: "exact", head: true });

  const [fridgesRes, recentRes, totalsRes, activeRes, reviewRes, nextRes, restRes, volRes, batchRes] = await Promise.all([
    sb
      .from("fridges")
      .select("id,code,name,area,lat,lng,capacity_portions,current_stock,status,open_24h")
      .order("code", { ascending: true }),
    sb
      .from("batches")
      .select("id,status,tier,est_portions,submitted_at,restaurants(name,area),batch_items(name)")
      .order("submitted_at", { ascending: false })
      .limit(10),
    sb.from("v_platform_totals").select("*").maybeSingle(),
    sb.from("batches").select("id", { count: "exact", head: true }).in("status", ACTIVE),
    sb.from("batches").select("id", { count: "exact", head: true }).eq("status", "escalated"),
    sb
      .from("batches")
      .select("safe_until")
      .in("status", ACTIVE)
      .gte("safe_until", new Date().toISOString())
      .order("safe_until", { ascending: true })
      .limit(1),
    head("restaurants"),
    head("volunteers"),
    head("batches"),
  ]);

  for (const r of [fridgesRes, recentRes, totalsRes, activeRes, reviewRes, nextRes, restRes, volRes, batchRes]) {
    if (r.error) throw r.error;
  }

  const fridges: Fridge[] = (fridgesRes.data ?? []).map((f: any) => ({
    id: f.id,
    code: f.code,
    name: f.name,
    area: f.area,
    lat: f.lat,
    lng: f.lng,
    capacity: f.capacity_portions,
    stock: f.current_stock,
    status: f.status,
    open24h: f.open_24h,
  }));

  const recent: RecentBatch[] = (recentRes.data ?? []).map((b: any) => {
    const rest = Array.isArray(b.restaurants) ? b.restaurants[0] : b.restaurants;
    return {
      id: b.id,
      restaurantName: rest?.name ?? "",
      area: rest?.area ?? "",
      status: b.status,
      tier: (b.tier as Tier | null) ?? null,
      portions: b.est_portions ?? 0,
      items: (b.batch_items ?? []).map((i: any) => i.name),
      submittedAt: b.submitted_at,
    };
  });

  const totals: any = totalsRes.data ?? {};
  const next: any = (nextRes.data ?? [])[0];

  return {
    source: "supabase",
    fellBack: false,
    counts: {
      fridges: fridges.length,
      restaurants: restRes.count ?? 0,
      volunteers: volRes.count ?? 0,
      batches: batchRes.count ?? 0,
    },
    totals: {
      meals: Number(totals.meals ?? 0),
      kg: Number(totals.kg ?? 0),
      co2eKg: Number(totals.co2e_kg ?? 0),
      rescuedBatches: Number(totals.rescued_batches ?? 0),
    },
    activeRescues: activeRes.count ?? 0,
    reviewQueue: reviewRes.count ?? 0,
    nextSafeUntil: next?.safe_until ?? null,
    recent,
    fridges,
  };
}

// ---------------------------------------------------------------- local sample data (fallback)
type SeedBatch = {
  id: string;
  restaurantId: string;
  status: string;
  tier: Tier | null;
  estPortions: number;
  submittedAt: string;
  safeUntilAt: string | null;
  items: { name: string }[];
  impact: { meals: number; kg: number; co2eKg: number } | null;
};
type Seed = {
  anchor: string;
  restaurants: { id: string; name: string; area: string }[];
  fridges: Fridge[];
  volunteers: unknown[];
  batches: SeedBatch[];
};

async function fromSample(): Promise<DashboardData> {
  const mod = await import("./seed/seed.json");
  const seed = (mod.default ?? mod) as unknown as Seed;

  // The seed is "as of" a fixed moment. Shift it so the newest records look like they just happened.
  const shift = Date.now() - new Date(seed.anchor).getTime();
  const at = (iso: string) => new Date(new Date(iso).getTime() + shift).toISOString();
  const rest = new Map(seed.restaurants.map((r) => [r.id, r]));

  const batches = [...seed.batches].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  const active = seed.batches.filter((b) => ACTIVE.includes(b.status));
  const now = Date.now();
  const nextSafe = active
    .map((b) => (b.safeUntilAt ? at(b.safeUntilAt) : null))
    .filter((v): v is string => !!v && new Date(v).getTime() > now)
    .sort()[0];

  const impacts = seed.batches.map((b) => b.impact).filter((i): i is NonNullable<SeedBatch["impact"]> => !!i);

  return {
    source: "sample",
    fellBack: false,
    counts: {
      fridges: seed.fridges.length,
      restaurants: seed.restaurants.length,
      volunteers: seed.volunteers.length,
      batches: seed.batches.length,
    },
    totals: {
      meals: impacts.reduce((s, i) => s + i.meals, 0),
      kg: impacts.reduce((s, i) => s + i.kg, 0),
      co2eKg: impacts.reduce((s, i) => s + i.co2eKg, 0),
      rescuedBatches: impacts.length,
    },
    activeRescues: active.length,
    reviewQueue: seed.batches.filter((b) => b.status === "escalated").length,
    nextSafeUntil: nextSafe ?? null,
    recent: batches.slice(0, 10).map((b) => ({
      id: b.id,
      restaurantName: rest.get(b.restaurantId)?.name ?? "",
      area: rest.get(b.restaurantId)?.area ?? "",
      status: b.status,
      tier: b.tier,
      portions: b.estPortions,
      items: b.items.map((i) => i.name),
      submittedAt: at(b.submittedAt),
    })),
    fridges: seed.fridges,
  };
}

/** Reads from Supabase when configured, and quietly falls back to the bundled sample data. */
export async function loadDashboard(): Promise<DashboardData> {
  if (supabase) {
    try {
      return await fromSupabase();
    } catch (err) {
      console.warn("BARAKAT: Supabase unavailable, using local sample data.", err);
      const data = await fromSample();
      return { ...data, fellBack: true };
    }
  }
  return fromSample();
}
