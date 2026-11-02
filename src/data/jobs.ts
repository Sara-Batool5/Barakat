import type { User } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";
import type { Tier } from "./types";

export type MyJob = {
  id: string;
  status: string;
  attempt: number;
  offeredAt: string;
  expiresAt: string | null;
  respondedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  distanceKm: number | null;
  pickupEtaMin: number | null;
  batch: {
    id: string;
    status: string;
    tier: Tier | null;
    portions: number;
    safeUntil: string | null;
    notes: string | null;
    restaurant: { name: string; area: string } | null;
    items: { name: string; category: string; portions: number }[];
  } | null;
  fridge: { code: string; name: string; area: string } | null;
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

export async function listMyJobs(user: User): Promise<MyJob[]> {
  const sb = supabase;
  if (!sb || user.mode === "local" || !user.volunteerId) return [];
  const { data, error } = await sb
    .from("jobs")
    .select(
      "id,status,attempt,offered_at,expires_at,responded_at,picked_up_at,delivered_at,distance_km,pickup_eta_min," +
        "batches(id,status,tier,est_portions,safe_until,notes,restaurants(name,area),batch_items(name,category,portions))," +
        "fridges(code,name,area)"
    )
    .eq("volunteer_id", user.volunteerId)
    .order("offered_at", { ascending: false })
    .limit(30);
  if (error) throw error;

  return ((data ?? []) as any[]).map((j) => {
    const b = one<any>(j.batches);
    const f = one<any>(j.fridges);
    const r = b ? one<any>(b.restaurants) : null;
    return {
      id: j.id,
      status: j.status,
      attempt: j.attempt,
      offeredAt: j.offered_at,
      expiresAt: j.expires_at ?? null,
      respondedAt: j.responded_at ?? null,
      pickedUpAt: j.picked_up_at ?? null,
      deliveredAt: j.delivered_at ?? null,
      distanceKm: j.distance_km === null || j.distance_km === undefined ? null : Number(j.distance_km),
      pickupEtaMin: j.pickup_eta_min ?? null,
      batch: b
        ? {
            id: b.id,
            status: b.status,
            tier: (b.tier as Tier | null) ?? null,
            portions: b.est_portions ?? 0,
            safeUntil: b.safe_until ?? null,
            notes: b.notes ?? null,
            restaurant: r ? { name: r.name, area: r.area } : null,
            items: (b.batch_items ?? []).map((i: any) => ({ name: i.name, category: i.category, portions: i.portions })),
          }
        : null,
      fridge: f ? { code: f.code, name: f.name, area: f.area } : null,
    } satisfies MyJob;
  });
}
