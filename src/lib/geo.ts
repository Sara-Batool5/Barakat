/** Map maths shared by the live map. Mirrors the dispatcher (api/dispatch.ts) so on-screen movement matches what the agent assumed. */
export type LatLng = [number, number];

export const SPEED_KMH: Record<string, number> = { car: 32, van: 28, scooter: 26, bike: 15, on_foot: 5 };
/** Demo volunteers (no sign-in) travel at this fraction of real time. */
export const SIM_FACTOR = 0.15;

export function roadKm(a: LatLng, b: LatLng): number {
  const r = 6371;
  const p1 = (a[0] * Math.PI) / 180;
  const p2 = (b[0] * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((b[1] - a[1]) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return Math.round(2 * r * Math.asin(Math.sqrt(h)) * 1.35 * 10) / 10;
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
export const lerp = (a: LatLng, b: LatLng, f: number): LatLng => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];

/** How long a leg of `minutes` takes on screen, in seconds. */
export function durationSec(minutes: number, simulated: boolean): number {
  return simulated ? Math.max(45, minutes * 60 * SIM_FACTOR) : Math.max(30, minutes * 60);
}

export type JobProgress = {
  status: string;
  respondedAt: string | null;
  pickedUpAt: string | null;
  transport: string;
  /** true for demo volunteers that have no sign-in account */
  simulated: boolean;
};

export type Position = { pos: LatLng; phase: "offered" | "to_pickup" | "at_pickup" | "to_fridge" | "at_fridge"; progress: number };

/** Where a volunteer is right now, estimated from their job's timestamps (there is no GPS in this prototype). */
export function volunteerPosition(job: JobProgress, home: LatLng, venue: LatLng, fridge: LatLng | null, nowMs: number): Position {
  const speed = SPEED_KMH[job.transport] ?? 25;
  if (job.status === "accepted" && job.respondedAt) {
    const minutes = (roadKm(home, venue) / speed) * 60 + 3;
    const f = clamp01((nowMs - new Date(job.respondedAt).getTime()) / (durationSec(minutes, job.simulated) * 1000));
    return { pos: lerp(home, venue, f), phase: f >= 1 ? "at_pickup" : "to_pickup", progress: f };
  }
  if (job.status === "picked_up" && job.pickedUpAt) {
    if (!fridge) return { pos: venue, phase: "at_pickup", progress: 0 };
    const minutes = (roadKm(venue, fridge) / speed) * 60 + 4;
    const f = clamp01((nowMs - new Date(job.pickedUpAt).getTime()) / (durationSec(minutes, job.simulated) * 1000));
    return { pos: lerp(venue, fridge, f), phase: f >= 1 ? "at_fridge" : "to_fridge", progress: f };
  }
  return { pos: home, phase: "offered", progress: 0 };
}

export type FridgeTone = "low" | "mid" | "high" | "off";

/** Colour band for a fridge: how full it is, counting room already promised to deliveries on the way. */
export function fridgeTone(f: { status: string; stock: number; reserved: number; capacity: number }): FridgeTone {
  if (f.status !== "active") return "off";
  const load = (f.stock + f.reserved) / Math.max(1, f.capacity);
  return load < 0.6 ? "low" : load < 0.85 ? "mid" : "high";
}

export const googleDirectionsUrl = (to: LatLng) => `https://www.google.com/maps/dir/?api=1&destination=${to[0]},${to[1]}`;
