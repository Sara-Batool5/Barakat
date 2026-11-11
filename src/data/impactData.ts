import type { User } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";

export type ImpactRow = {
  id: string; createdAt: string; meals: number; kg: number; co2eKg: number; points: number;
  restaurantId: string; restaurantName: string; items: string[]; fridgeCode: string; isSample: boolean;
};
export type Factors = { version: string; status: string; kgPerMeal: number; co2ePerKg: number; pointsPerMeal: number };
export type ImpactData = {
  factors: Factors;
  rows: ImpactRow[];
  leaderboard: { name: string; points: number }[];
  venue: { name: string; area: string } | null;
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

const defaultFactors: Factors = { version: "unknown", status: "", kgPerMeal: 0.5, co2ePerKg: 2.5, pointsPerMeal: 5 };

function toFactors(v: any): Factors {
  if (!v) return defaultFactors;
  return {
    version: String(v.version ?? "unknown"), status: String(v.status ?? ""), kgPerMeal: Number(v.kg_per_meal ?? 0.5),
    co2ePerKg: Number(v.co2e_kg_per_kg_food ?? 2.5), pointsPerMeal: Number(v.esg_points_per_meal ?? 5),
  };
}

type Seed = {
  anchor: string;
  restaurants: { id: string; name: string; area: string; esgPoints: number }[];
  fridges: { id: string; code: string }[];
  batches: {
    restaurantId: string; fridgeId: string | null; items: { name: string }[];
    impact: { id: string; meals: number; kg: number; co2eKg: number; esgPoints: number; createdAt: string; restaurantId: string } | null;
  }[];
};

async function fromSample(user: User): Promise<ImpactData> {
  const mod = await import("./seed/seed.json");
  const seed = (mod.default ?? mod) as unknown as Seed;
  const shift = Date.now() - new Date(seed.anchor).getTime();
  const mine = user.role === "restaurant" ? seed.restaurants.find((r) => r.name === "Zaytoun Mezze Bar") : null;
  const rows: ImpactRow[] = seed.batches
    .filter((b) => b.impact && (!mine || b.restaurantId === mine.id))
    .map((b) => {
      const imp = b.impact!;
      const r = seed.restaurants.find((x) => x.id === imp.restaurantId);
      return {
        id: imp.id, createdAt: new Date(new Date(imp.createdAt).getTime() + shift).toISOString(), meals: imp.meals, kg: imp.kg, co2eKg: imp.co2eKg, points: imp.esgPoints,
        restaurantId: imp.restaurantId, restaurantName: r?.name ?? "", items: b.items.map((i) => i.name), fridgeCode: seed.fridges.find((f) => f.id === b.fridgeId)?.code ?? "", isSample: true,
      };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const leaderboard = [...seed.restaurants].sort((a, b) => b.esgPoints - a.esgPoints).slice(0, 10).map((r) => ({ name: r.name, points: r.esgPoints }));
  return { factors: defaultFactors, rows, leaderboard, venue: mine ? { name: mine.name, area: mine.area } : null };
}

export async function loadImpact(user: User, includeSample: boolean): Promise<ImpactData> {
  const sb = supabase;
  if (!sb || user.mode === "local") return fromSample(user);
  const coordinator = user.role === "coordinator";

  let rowsQ = sb
    .from("impact_logs")
    .select("id,created_at,meals,kg,co2e_kg,esg_points,restaurant_id,is_sample,restaurants(name),batches(batch_items(name),fridges(code))")
    .order("created_at", { ascending: false })
    .limit(600);
  if (coordinator) {
    if (!includeSample) rowsQ = rowsQ.eq("is_sample", false);
  } else if (user.restaurantId) {
    rowsQ = rowsQ.eq("restaurant_id", user.restaurantId);
  }
  const factorsQ = sb.from("app_config").select("value").eq("key", "impact_factors").maybeSingle();
  let boardQ = sb.from("restaurants").select("name,esg_points,is_sample").order("esg_points", { ascending: false }).limit(10);
  if (!includeSample) boardQ = boardQ.eq("is_sample", false);
  const venueQ = user.restaurantId ? sb.from("restaurants").select("name,area").eq("id", user.restaurantId).maybeSingle() : null;

  const [rows, factors, board, venue] = await Promise.all([rowsQ, factorsQ, coordinator ? boardQ : Promise.resolve(null), venueQ]);
  if (rows.error) throw rows.error;

  return {
    factors: toFactors(factors.data?.value),
    rows: ((rows.data ?? []) as any[]).map((r) => {
      const b = one<any>(r.batches);
      const rest = one<any>(r.restaurants);
      return {
        id: r.id, createdAt: r.created_at, meals: r.meals, kg: Number(r.kg), co2eKg: Number(r.co2e_kg), points: r.esg_points, restaurantId: r.restaurant_id,
        restaurantName: rest?.name ?? "", items: (b?.batch_items ?? []).map((i: any) => i.name), fridgeCode: one<any>(b?.fridges)?.code ?? "", isSample: !!r.is_sample,
      } satisfies ImpactRow;
    }),
    leaderboard: board && !board.error ? ((board.data ?? []) as any[]).map((r) => ({ name: r.name, points: r.esg_points })) : [],
    venue: venue && !venue.error && venue.data ? { name: (venue.data as any).name, area: (venue.data as any).area } : null,
  };
}
