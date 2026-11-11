import type { User } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";

export type MapFridge = {
  id: string; code: string; name: string; area: string; lat: number; lng: number;
  stock: number; capacity: number; reserved: number; status: string; open24h: boolean; openFrom: string | null; openTo: string | null; incoming: number;
};
export type MapBatch = {
  id: string; status: string; portions: number; safeUntil: string | null; fridgeId: string | null; isSample: boolean;
  venue: { name: string; area: string; lat: number; lng: number } | null; items: string[];
};
export type MapVolunteer = { id: string; name: string; lat: number; lng: number; transport: string; simulated: boolean };
export type MapJob = {
  id: string; batchId: string; status: string; offeredAt: string; respondedAt: string | null; pickedUpAt: string | null;
  pickupEtaMin: number | null; fridgeId: string | null; volunteer: MapVolunteer | null;
};
export type MapData = { fridges: MapFridge[]; batches: MapBatch[]; jobs: MapJob[]; available: MapVolunteer[] };

const LIVE = ["listed", "matched", "dispatched", "picked_up", "escalated"];
const OPEN_JOB = ["offered", "accepted", "picked_up"];
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

function withIncoming(fridges: Omit<MapFridge, "incoming">[], batches: MapBatch[]): MapFridge[] {
  const counts = new Map<string, number>();
  for (const b of batches) if (b.fridgeId && ["matched", "dispatched", "picked_up"].includes(b.status)) counts.set(b.fridgeId, (counts.get(b.fridgeId) ?? 0) + 1);
  return fridges.map((f) => ({ ...f, incoming: counts.get(f.id) ?? 0 }));
}

type Seed = {
  anchor: string;
  restaurants: { id: string; name: string; area: string; lat: number; lng: number }[];
  fridges: { id: string; code: string; name: string; area: string; lat: number; lng: number; capacity: number; stock: number; status: string; open24h: boolean; openFrom: string | null; openTo: string | null }[];
  volunteers: { id: string; fullName: string; lat: number; lng: number; transport: string; status: string }[];
  batches: {
    id: string; restaurantId: string; status: string; estPortions: number; safeUntilAt: string | null; fridgeId: string | null;
    items: { name: string }[];
    jobs: { id: string; status: string; volunteerId: string; fridgeId: string; offeredAt: string; respondedAt: string | null; pickedUpAt: string | null; pickupEtaMin: number | null }[];
  }[];
};

async function fromSample(): Promise<MapData> {
  const mod = await import("./seed/seed.json");
  const seed = (mod.default ?? mod) as unknown as Seed;
  const shift = Date.now() - new Date(seed.anchor).getTime();
  const at = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + shift).toISOString() : null);
  const vol = (id: string): MapVolunteer | null => {
    const v = seed.volunteers.find((x) => x.id === id);
    return v ? { id: v.id, name: v.fullName, lat: v.lat, lng: v.lng, transport: v.transport, simulated: true } : null;
  };
  const batches: MapBatch[] = seed.batches
    .filter((b) => LIVE.includes(b.status))
    .map((b) => {
      const r = seed.restaurants.find((x) => x.id === b.restaurantId);
      return { id: b.id, status: b.status, portions: b.estPortions, safeUntil: at(b.safeUntilAt), fridgeId: b.fridgeId, isSample: true, venue: r ? { name: r.name, area: r.area, lat: r.lat, lng: r.lng } : null, items: b.items.map((i) => i.name) };
    });
  const jobs: MapJob[] = seed.batches
    .filter((b) => LIVE.includes(b.status))
    .flatMap((b) => b.jobs.filter((j) => OPEN_JOB.includes(j.status)).map((j) => ({
      id: j.id, batchId: b.id, status: j.status, offeredAt: at(j.offeredAt) ?? "", respondedAt: at(j.respondedAt), pickedUpAt: at(j.pickedUpAt),
      pickupEtaMin: j.pickupEtaMin, fridgeId: j.fridgeId, volunteer: vol(j.volunteerId),
    })));
  const fridges = withIncoming(
    seed.fridges.map((f) => ({ id: f.id, code: f.code, name: f.name, area: f.area, lat: f.lat, lng: f.lng, stock: f.stock, capacity: f.capacity, reserved: 0, status: f.status, open24h: f.open24h, openFrom: f.openFrom, openTo: f.openTo })),
    batches
  );
  const available = seed.volunteers.filter((v) => v.status === "available").map((v) => vol(v.id)).filter((v): v is MapVolunteer => !!v);
  return { fridges, batches, jobs, available };
}

export async function loadMapData(user: User): Promise<MapData> {
  const sb = supabase;
  if (!sb || user.mode === "local") return fromSample();

  const [fr, ba, jo, av] = await Promise.all([
    sb.from("fridges").select("id,code,name,area,lat,lng,capacity_portions,current_stock,reserved_portions,status,open_24h,open_from,open_to"),
    sb.from("batches").select("id,status,est_portions,safe_until,fridge_id,is_sample,restaurants(name,area,lat,lng),batch_items(name)").in("status", LIVE).limit(100),
    sb.from("jobs").select("id,batch_id,status,offered_at,responded_at,picked_up_at,pickup_eta_min,fridge_id,volunteers(id,full_name,lat,lng,transport,user_id)").in("status", OPEN_JOB).limit(100),
    sb.from("volunteers").select("id,full_name,lat,lng,transport,user_id").eq("status", "available").limit(80),
  ]);
  for (const r of [fr, ba, jo, av]) if (r.error) throw r.error;

  const batches: MapBatch[] = ((ba.data ?? []) as any[]).map((b) => {
    const r = one<any>(b.restaurants);
    return {
      id: b.id, status: b.status, portions: b.est_portions ?? 0, safeUntil: b.safe_until ?? null, fridgeId: b.fridge_id ?? null, isSample: !!b.is_sample,
      venue: r ? { name: r.name, area: r.area, lat: r.lat, lng: r.lng } : null, items: (b.batch_items ?? []).map((i: any) => i.name),
    };
  });
  const jobs: MapJob[] = ((jo.data ?? []) as any[]).map((j) => {
    const v = one<any>(j.volunteers);
    return {
      id: j.id, batchId: j.batch_id, status: j.status, offeredAt: j.offered_at, respondedAt: j.responded_at ?? null, pickedUpAt: j.picked_up_at ?? null,
      pickupEtaMin: j.pickup_eta_min ?? null, fridgeId: j.fridge_id ?? null,
      volunteer: v ? { id: v.id, name: v.full_name, lat: v.lat, lng: v.lng, transport: v.transport, simulated: !v.user_id } : null,
    };
  });
  const fridges = withIncoming(
    ((fr.data ?? []) as any[]).map((f) => ({
      id: f.id, code: f.code, name: f.name, area: f.area, lat: f.lat, lng: f.lng, stock: f.current_stock, capacity: f.capacity_portions, reserved: f.reserved_portions ?? 0,
      status: f.status, open24h: !!f.open_24h, openFrom: f.open_from ?? null, openTo: f.open_to ?? null,
    })),
    batches
  );
  const available: MapVolunteer[] = ((av.data ?? []) as any[]).map((v) => ({ id: v.id, name: v.full_name, lat: v.lat, lng: v.lng, transport: v.transport, simulated: !v.user_id }));
  return { fridges, batches, jobs, available };
}
