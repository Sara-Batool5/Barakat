/**
 * POST /api/dispatch
 * The matcher and dispatcher of the BARAKAT agent. One endpoint, four actions:
 *   { action: "match",    batchId }                         pick a fridge for a listed batch and offer the job to a volunteer
 *   { action: "respond",  jobId, accept: true | false }     a volunteer accepts or declines an offer
 *   { action: "progress", jobId, step: "picked_up" | "delivered" }
 *   { action: "review",   batchId, decision: "approve" | "decline", note? }   a coordinator settles an escalated batch
 *   { action: "fridge_stock", fridgeId, portions, reason: "taken" | "expired" }   a fridge host records food taken or removed
 *   { action: "tick" }                                      housekeeping: expire offers, simulate demo volunteers, retry matching
 *   { action: "demo_volunteers" | "demo_set_volunteer" | "demo_fridges" | "demo_set_fridge" }   demo accounts only: choose whom to play
 *
 * Server-only environment variable: SUPABASE_SERVICE_ROLE_KEY (plus VITE_SUPABASE_URL or SUPABASE_URL).
 * Self-contained on purpose (no imports). The engine functions take a small database object so they can be tested
 * without a network.
 *
 * Demo volunteers in the sample data (no sign-in account) are simulated: they answer offers and complete trips
 * on their own, in compressed time, so the whole chain can be watched without anyone playing every role.
 * Real volunteer accounts always answer for themselves.
 */

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Res = { status(code: number): Res; json(body: unknown): void; setHeader(name: string, value: string): void };

// ---------------------------------------------------------------- database access
export type Db = {
  get(path: string): Promise<any[]>;
  post(table: string, body: unknown): Promise<any[]>;
  patch(path: string, body: unknown): Promise<any[]>;
};

export class DbError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function sbHeaders(key: string, extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", ...extra };
}

function httpDb(url: string, key: string): Db {
  const call = async (path: string, init: RequestInit) => {
    const r = await fetch(`${url}/rest/v1/${path}`, init);
    let json: any = null;
    try {
      json = await r.json();
    } catch {
      json = null;
    }
    if (!r.ok) throw new DbError(r.status, String(json?.message ?? `HTTP ${r.status}`));
    return Array.isArray(json) ? json : [];
  };
  return {
    get: (path) => call(path, { headers: sbHeaders(key) }),
    post: (table, body) => call(table, { method: "POST", headers: sbHeaders(key, { Prefer: "return=representation" }), body: JSON.stringify(body) }),
    patch: (path, body) => call(path, { method: "PATCH", headers: sbHeaders(key, { Prefer: "return=representation" }), body: JSON.stringify(body) }),
  };
}

// ---------------------------------------------------------------- engine context
export type Ctx = { db: Db; rules: any; factors: any; now: Date };

const SPEED_KMH: Record<string, number> = { car: 32, van: 28, scooter: 26, bike: 15, on_foot: 5 };
const OPEN_JOB = ["offered", "accepted", "picked_up"];
/** Demo volunteers move at this fraction of real time (a 12 minute trip takes about 2 minutes). */
export const SIM_FACTOR = 0.15;

const enc = encodeURIComponent;
const iso = (d: Date) => d.toISOString();
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

export function roadKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = 6371;
  const p1 = (aLat * Math.PI) / 180;
  const p2 = (bLat * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((bLng - aLng) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return Math.round(2 * r * Math.asin(Math.sqrt(h)) * 1.35 * 10) / 10;
}

function dubaiMinuteOfDay(d: Date): number {
  return (d.getUTCHours() * 60 + d.getUTCMinutes() + 240) % 1440;
}

function fridgeOpenAt(f: any, at: Date): boolean {
  if (f.open_24h !== false || !f.open_from || !f.open_to) return true;
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const m = dubaiMinuteOfDay(at);
  return m >= toMin(f.open_from) && m <= toMin(f.open_to);
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

let lastEmitMs = 0;

async function emit(ctx: Ctx, batchId: string, events: { type: string; actor: string; tone: string; title: string; detail: string; payload?: unknown; jobId?: string | null }[]) {
  if (events.length === 0) return;
  // Timeline entries must sort in the order they happened, even when several are written in the same millisecond.
  const base = Math.max(ctx.now.getTime(), lastEmitMs + 1);
  lastEmitMs = base + events.length * 15;
  await ctx.db.post(
    "agent_events",
    events.map((e, i) => ({
      batch_id: batchId, job_id: e.jobId ?? null, event_type: e.type, actor: e.actor, tone: e.tone, title: e.title, detail: e.detail,
      payload: e.payload ?? {}, created_at: new Date(base + i * 15).toISOString(), is_sample: false,
    }))
  );
}

async function lastEventType(ctx: Ctx, batchId: string): Promise<string | null> {
  const rows = await ctx.db.get(`agent_events?batch_id=eq.${batchId}&select=event_type,created_at&order=created_at.desc&limit=1`);
  return rows[0]?.event_type ?? null;
}

async function lastEventAt(ctx: Ctx, batchId: string, type: string): Promise<Date | null> {
  const rows = await ctx.db.get(`agent_events?batch_id=eq.${batchId}&event_type=eq.${type}&select=created_at&order=created_at.desc&limit=1`);
  return rows[0]?.created_at ? new Date(rows[0].created_at) : null;
}

async function adjustFridge(ctx: Ctx, fridgeId: string, apply: (f: any) => Record<string, number>): Promise<any | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const f = (await ctx.db.get(`fridges?id=eq.${fridgeId}&select=*`))[0];
    if (!f) return null;
    const changes = apply(f);
    const updated = await ctx.db.patch(`fridges?id=eq.${fridgeId}&reserved_portions=eq.${f.reserved_portions ?? 0}&current_stock=eq.${f.current_stock}`, changes);
    if (updated.length > 0) return updated[0];
  }
  return null;
}

// ---------------------------------------------------------------- matching
export type FridgeChoice = { fridge: any; distanceKm: number; score: number; considered: number };

/** Picks the best fridge: active, open on arrival, with room, close enough, reachable inside the safe window. */
export function chooseFridge(batch: any, restaurant: any, fridges: any[], rules: any, now: Date): FridgeChoice | null {
  const maxKm = rules.dispatch?.max_distance_km ?? 25;
  const safeUntil = batch.safe_until ? new Date(batch.safe_until) : null;
  const portions = Number(batch.est_portions ?? 0);
  const scored: FridgeChoice[] = [];
  for (const f of fridges) {
    if (f.status !== "active") continue;
    const km = roadKm(restaurant.lat, restaurant.lng, f.lat, f.lng);
    if (km > maxKm) continue;
    const room = f.capacity_portions - f.current_stock - (f.reserved_portions ?? 0);
    if (room < portions) continue;
    const tripMin = (km / SPEED_KMH.van) * 60 + 15;
    const arrival = addMin(now, tripMin + 5);
    if (!fridgeOpenAt(f, arrival)) continue;
    if (safeUntil && arrival.getTime() > safeUntil.getTime() - 5 * 60000) continue;
    const load = (f.current_stock + (f.reserved_portions ?? 0)) / f.capacity_portions;
    scored.push({ fridge: f, distanceKm: km, score: km + 4 * load, considered: 0 });
  }
  if (scored.length === 0) return null;
  scored.sort((a, b) => a.score - b.score || String(a.fridge.code).localeCompare(String(b.fridge.code)));
  return { ...scored[0], considered: scored.length };
}

export type MatchResult = {
  stage: "matched" | "no_fridge" | "already" | "not_listed";
  status: string;
  fridge?: { code: string; name: string; area: string; distanceKm: number };
  offer?: { sent: boolean; reason?: "no_volunteer" | "escalated" };
};

export async function matchAndDispatch(ctx: Ctx, batchId: string): Promise<MatchResult> {
  const batch = (await ctx.db.get(`batches?id=eq.${batchId}&select=*`))[0];
  if (!batch) throw new DbError(404, "Batch not found.");
  const restaurant = (await ctx.db.get(`restaurants?id=eq.${batch.restaurant_id}&select=id,name,lat,lng,esg_points`))[0];
  if (!restaurant) throw new DbError(404, "Venue not found.");

  if (batch.status === "matched" && batch.fridge_id) {
    const fridge = (await ctx.db.get(`fridges?id=eq.${batch.fridge_id}&select=*`))[0];
    const offer = await offerNext(ctx, batch, restaurant, fridge);
    return { stage: "already", status: (await currentStatus(ctx, batchId)) ?? batch.status, fridge: fridge && fridgeInfo(fridge, restaurant), offer };
  }
  if (batch.status !== "listed") return { stage: "not_listed", status: batch.status };

  const fridges = await ctx.db.get(`fridges?status=eq.active&select=*`);
  const choice = chooseFridge(batch, restaurant, fridges, ctx.rules, ctx.now);
  if (!choice) {
    if ((await lastEventType(ctx, batchId)) !== "no_fridge") {
      await emit(ctx, batchId, [{ type: "no_fridge", actor: "agent", tone: "amber", title: "No fridge available", detail: "No open fridge with room can be reached inside the safe window right now. The agent will keep trying.", payload: { fridges_checked: fridges.length } }]);
    }
    return { stage: "no_fridge", status: "listed" };
  }

  // Claim the batch first (status guard), then reserve room in the fridge.
  const claimed = await ctx.db.patch(`batches?id=eq.${batchId}&status=eq.listed`, { status: "matched", fridge_id: choice.fridge.id });
  if (claimed.length === 0) return { stage: "already", status: "matched" };
  const reserved = await adjustFridge(ctx, choice.fridge.id, (f) => ({ reserved_portions: (f.reserved_portions ?? 0) + Number(batch.est_portions ?? 0) }));
  if (!reserved) {
    await ctx.db.patch(`batches?id=eq.${batchId}&status=eq.matched`, { status: "listed", fridge_id: null });
    return { stage: "no_fridge", status: "listed" };
  }
  await emit(ctx, batchId, [{
    type: "fridge_matched", actor: "agent", tone: "green", title: "Fridge matched",
    detail: `${choice.fridge.code} ${choice.fridge.name}, ${choice.distanceKm.toFixed(1)} km away`,
    payload: { distance_km: choice.distanceKm, considered: choice.considered },
  }]);

  const offer = await offerNext(ctx, { ...batch, status: "matched", fridge_id: choice.fridge.id }, restaurant, choice.fridge);
  return { stage: "matched", status: (await currentStatus(ctx, batchId)) ?? "matched", fridge: fridgeInfo(choice.fridge, restaurant), offer };
}

function fridgeInfo(f: any, restaurant: any) {
  return { code: f.code, name: f.name, area: f.area, distanceKm: roadKm(restaurant.lat, restaurant.lng, f.lat, f.lng) };
}

async function currentStatus(ctx: Ctx, batchId: string): Promise<string | null> {
  return (await ctx.db.get(`batches?id=eq.${batchId}&select=status`))[0]?.status ?? null;
}

// ---------------------------------------------------------------- dispatch
export type VolunteerChoice = { volunteer: any; pickupKm: number; etaMin: number };

/** Orders eligible volunteers: real accounts first, then the nearest. */
export function rankVolunteers(batch: any, restaurant: any, fridge: any, volunteers: any[], busyIds: Set<string>, triedIds: Set<string>, now: Date): VolunteerChoice[] {
  const portions = Number(batch.est_portions ?? 0);
  const safeUntil = batch.safe_until ? new Date(batch.safe_until) : null;
  const pickupUntil = batch.pickup_until ? new Date(batch.pickup_until) : null;
  const out: VolunteerChoice[] = [];
  for (const v of volunteers) {
    if (v.status !== "available" || busyIds.has(v.id) || triedIds.has(v.id)) continue;
    if (Number(v.max_portions) < portions) continue;
    const pickupKm = roadKm(v.lat, v.lng, restaurant.lat, restaurant.lng);
    if (pickupKm > Number(v.max_radius_km)) continue;
    const speed = SPEED_KMH[v.transport] ?? 25;
    const etaMin = Math.round((pickupKm / speed) * 60) + 3;
    const tripMin = Math.round((roadKm(restaurant.lat, restaurant.lng, fridge.lat, fridge.lng) / speed) * 60) + 4;
    const pickupAt = addMin(now, etaMin);
    if (pickupUntil && pickupAt.getTime() > pickupUntil.getTime()) continue;
    if (safeUntil && addMin(pickupAt, tripMin).getTime() > safeUntil.getTime() - 5 * 60000) continue;
    out.push({ volunteer: v, pickupKm, etaMin });
  }
  out.sort((a, b) => Number(!!b.volunteer.user_id) - Number(!!a.volunteer.user_id) || a.pickupKm - b.pickupKm || String(a.volunteer.id).localeCompare(String(b.volunteer.id)));
  return out;
}

export async function offerNext(ctx: Ctx, batch: any, restaurant: any, fridge: any): Promise<{ sent: boolean; reason?: "no_volunteer" | "escalated" }> {
  if (!fridge) return { sent: false, reason: "no_volunteer" };
  const jobs = await ctx.db.get(`jobs?batch_id=eq.${batch.id}&select=*`);
  if (jobs.some((j) => OPEN_JOB.includes(j.status))) return { sent: false }; // an offer or trip is already running
  const maxAttempts = ctx.rules.dispatch?.max_offer_attempts ?? 3;
  // After a coordinator approves an escalated batch, dispatch starts a fresh round.
  const decidedAt = await lastEventAt(ctx, batch.id, "coordinator_decision");
  const round = decidedAt ? jobs.filter((j) => new Date(j.offered_at).getTime() > decidedAt.getTime() - 2000) : jobs;
  const failed = round.filter((j) => j.status === "declined" || j.status === "timed_out");
  if (failed.length >= maxAttempts) {
    await escalateUnserved(ctx, batch, failed.length);
    return { sent: false, reason: "escalated" };
  }

  const volunteers = await ctx.db.get(`volunteers?status=eq.available&select=*`);
  // Sample jobs in the seed data do not block a volunteer from receiving real offers.
  const open = await ctx.db.get(`jobs?status=in.(${OPEN_JOB.join(",")})&is_sample=eq.false&select=volunteer_id`);
  const busy = new Set<string>(open.map((j) => j.volunteer_id));
  const tried = new Set<string>(round.map((j) => j.volunteer_id));
  const ranked = rankVolunteers(batch, restaurant, fridge, volunteers, busy, tried, ctx.now);
  if (ranked.length === 0) {
    if ((await lastEventType(ctx, batch.id)) !== "no_volunteer") {
      await emit(ctx, batch.id, [{ type: "no_volunteer", actor: "agent", tone: "amber", title: "No volunteer available", detail: "No eligible volunteer is free right now. The agent will keep trying until the safe window runs out.", payload: { volunteers_checked: volunteers.length } }]);
    }
    return { sent: false, reason: "no_volunteer" };
  }

  const pick = ranked[0];
  const robotMinutes = ctx.rules.dispatch?.offer_timeout_minutes ?? 6;
  // A person has to switch windows and read the offer; demo volunteers answer by themselves.
  const timeout = pick.volunteer.user_id ? ctx.rules.dispatch?.human_offer_timeout_minutes ?? robotMinutes : robotMinutes;
  const fridgeKm = roadKm(restaurant.lat, restaurant.lng, fridge.lat, fridge.lng);
  let job: any;
  try {
    [job] = await ctx.db.post("jobs", {
      batch_id: batch.id, volunteer_id: pick.volunteer.id, fridge_id: fridge.id, status: "offered", attempt: failed.length + 1,
      offered_at: iso(ctx.now), expires_at: iso(addMin(ctx.now, timeout)), distance_km: fridgeKm, pickup_eta_min: pick.etaMin, is_sample: false,
    });
  } catch (err) {
    if (err instanceof DbError && (err.status === 409 || /duplicate|unique/i.test(err.message))) return { sent: false }; // another process just made an offer
    throw err;
  }
  await emit(ctx, batch.id, [{
    type: "volunteer_offered", actor: "agent", tone: "neutral", title: "Offer sent", jobId: job?.id,
    detail: `Offered to ${pick.volunteer.full_name} (${String(pick.volunteer.transport).replace("_", " ")}), about ${pick.etaMin} min from pickup`,
    payload: { attempt: failed.length + 1, eta_min: pick.etaMin, expires_in_min: timeout },
  }]);
  return { sent: true };
}

async function releaseFridge(ctx: Ctx, batch: any) {
  if (batch.fridge_id) await adjustFridge(ctx, batch.fridge_id, (f) => ({ reserved_portions: Math.max(0, (f.reserved_portions ?? 0) - Number(batch.est_portions ?? 0)) }));
}

async function escalateUnserved(ctx: Ctx, batch: any, offers: number) {
  const moved = await ctx.db.patch(`batches?id=eq.${batch.id}&status=eq.matched`, { status: "escalated", fridge_id: null });
  if (moved.length === 0) return;
  await releaseFridge(ctx, batch);
  await emit(ctx, batch.id, [{ type: "escalated", actor: "agent", tone: "amber", title: "Sent to coordinator", detail: `No volunteer accepted after ${offers} offers`, payload: { reason: "no_volunteer_accepted", offers } }]);
}

export async function expireBatch(ctx: Ctx, batch: any, reason: string) {
  const live = ["listed", "matched", "dispatched", "picked_up", "escalated"];
  if (!live.includes(batch.status)) return false;
  const moved = await ctx.db.patch(`batches?id=eq.${batch.id}&status=eq.${batch.status}`, { status: "expired", reject_reason: reason });
  if (moved.length === 0) return false;
  if (["matched", "dispatched", "picked_up"].includes(batch.status)) await releaseFridge(ctx, batch);
  const open = await ctx.db.get(`jobs?batch_id=eq.${batch.id}&status=in.(${OPEN_JOB.join(",")})&select=id,volunteer_id`);
  if (open.length > 0) {
    await ctx.db.patch(`jobs?batch_id=eq.${batch.id}&status=in.(${OPEN_JOB.join(",")})`, { status: "cancelled" });
    for (const j of open) await ctx.db.patch(`volunteers?id=eq.${j.volunteer_id}&status=eq.busy`, { status: "available" });
  }
  await emit(ctx, batch.id, [{ type: "expired", actor: "system", tone: "red", title: "Batch expired", detail: reason }]);
  return true;
}

// ---------------------------------------------------------------- volunteer actions
export type Actor = { kind: "volunteer"; volunteerId: string } | { kind: "coordinator" } | { kind: "system" };

function allowed(actor: Actor, job: any): boolean {
  return actor.kind !== "volunteer" || actor.volunteerId === job.volunteer_id;
}

export type JobResult = { ok: true; status: string; batchStatus?: string } | { ok: false; code: "not_found" | "forbidden" | "wrong_state" | "expired" };

export async function respondToOffer(ctx: Ctx, jobId: string, accept: boolean, actor: Actor): Promise<JobResult> {
  const job = (await ctx.db.get(`jobs?id=eq.${jobId}&select=*`))[0];
  if (!job) return { ok: false, code: "not_found" };
  if (!allowed(actor, job)) return { ok: false, code: "forbidden" };
  if (job.status !== "offered") return { ok: false, code: "wrong_state" };
  const batch = (await ctx.db.get(`batches?id=eq.${job.batch_id}&select=*`))[0];
  const vol = (await ctx.db.get(`volunteers?id=eq.${job.volunteer_id}&select=*`))[0];
  if (!batch || !vol) return { ok: false, code: "not_found" };
  if (job.expires_at && new Date(job.expires_at).getTime() < ctx.now.getTime()) {
    await timeoutOffer(ctx, job);
    return { ok: false, code: "expired" };
  }

  if (!accept) {
    const moved = await ctx.db.patch(`jobs?id=eq.${jobId}&status=eq.offered`, { status: "declined", responded_at: iso(ctx.now) });
    if (moved.length === 0) return { ok: false, code: "wrong_state" };
    await emit(ctx, batch.id, [{ type: "offer_declined", actor: "volunteer", tone: "amber", title: "Offer declined", detail: `${vol.full_name} declined`, jobId }]);
    await redispatch(ctx, batch.id);
    return { ok: true, status: "declined" };
  }

  const moved = await ctx.db.patch(`jobs?id=eq.${jobId}&status=eq.offered`, { status: "accepted", responded_at: iso(ctx.now) });
  if (moved.length === 0) return { ok: false, code: "wrong_state" };
  await ctx.db.patch(`volunteers?id=eq.${vol.id}`, { status: "busy" });
  await ctx.db.patch(`batches?id=eq.${batch.id}&status=eq.matched`, { status: "dispatched" });
  await emit(ctx, batch.id, [{ type: "volunteer_accepted", actor: "volunteer", tone: "green", title: "Volunteer assigned", detail: `${vol.full_name} accepted; pickup in about ${job.pickup_eta_min ?? "?"} min`, payload: { eta_min: job.pickup_eta_min }, jobId }]);
  return { ok: true, status: "accepted", batchStatus: "dispatched" };
}

async function timeoutOffer(ctx: Ctx, job: any) {
  const moved = await ctx.db.patch(`jobs?id=eq.${job.id}&status=eq.offered`, { status: "timed_out" });
  if (moved.length === 0) return;
  const vol = (await ctx.db.get(`volunteers?id=eq.${job.volunteer_id}&select=full_name`))[0];
  const minutes = job.expires_at && job.offered_at ? Math.round((new Date(job.expires_at).getTime() - new Date(job.offered_at).getTime()) / 60000) : ctx.rules.dispatch?.offer_timeout_minutes ?? 6;
  await emit(ctx, job.batch_id, [{ type: "offer_timed_out", actor: "system", tone: "amber", title: "Offer timed out", detail: `No reply from ${vol?.full_name ?? "the volunteer"} after ${minutes} min`, jobId: job.id }]);
  await redispatch(ctx, job.batch_id);
}

async function redispatch(ctx: Ctx, batchId: string) {
  const batch = (await ctx.db.get(`batches?id=eq.${batchId}&select=*`))[0];
  if (!batch || batch.status !== "matched" || !batch.fridge_id) return;
  const restaurant = (await ctx.db.get(`restaurants?id=eq.${batch.restaurant_id}&select=id,name,lat,lng,esg_points`))[0];
  const fridge = (await ctx.db.get(`fridges?id=eq.${batch.fridge_id}&select=*`))[0];
  if (restaurant && fridge) await offerNext(ctx, batch, restaurant, fridge);
}

export async function advanceJob(ctx: Ctx, jobId: string, step: "picked_up" | "delivered", actor: Actor): Promise<JobResult> {
  const job = (await ctx.db.get(`jobs?id=eq.${jobId}&select=*`))[0];
  if (!job) return { ok: false, code: "not_found" };
  if (!allowed(actor, job)) return { ok: false, code: "forbidden" };
  const batch = (await ctx.db.get(`batches?id=eq.${job.batch_id}&select=*`))[0];
  const vol = (await ctx.db.get(`volunteers?id=eq.${job.volunteer_id}&select=*`))[0];
  if (!batch || !vol) return { ok: false, code: "not_found" };

  const needed = step === "picked_up" ? "accepted" : "picked_up";
  if (job.status !== needed) return { ok: false, code: "wrong_state" };
  if (batch.safe_until && new Date(batch.safe_until).getTime() < ctx.now.getTime()) {
    await expireBatch(ctx, batch, "The safe window closed before the food reached a fridge.");
    return { ok: false, code: "expired" };
  }

  if (step === "picked_up") {
    const moved = await ctx.db.patch(`jobs?id=eq.${jobId}&status=eq.accepted`, { status: "picked_up", picked_up_at: iso(ctx.now) });
    if (moved.length === 0) return { ok: false, code: "wrong_state" };
    await ctx.db.patch(`batches?id=eq.${batch.id}&status=eq.dispatched`, { status: "picked_up" });
    await emit(ctx, batch.id, [{ type: "picked_up", actor: "volunteer", tone: "green", title: "Picked up", detail: `${vol.full_name} collected ${batch.est_portions} portions`, payload: { portions: batch.est_portions }, jobId }]);
    return { ok: true, status: "picked_up", batchStatus: "picked_up" };
  }

  const moved = await ctx.db.patch(`jobs?id=eq.${jobId}&status=eq.picked_up`, { status: "delivered", delivered_at: iso(ctx.now) });
  if (moved.length === 0) return { ok: false, code: "wrong_state" };
  const portions = Number(batch.est_portions ?? 0);
  const fridge = await adjustFridge(ctx, job.fridge_id, (f) => ({
    reserved_portions: Math.max(0, (f.reserved_portions ?? 0) - portions),
    current_stock: Math.min(f.capacity_portions, f.current_stock + portions),
  }));
  await ctx.db.post("fridge_stock_log", { fridge_id: job.fridge_id, batch_id: batch.id, delta_portions: portions, reason: "delivered", is_sample: false });
  await ctx.db.patch(`volunteers?id=eq.${vol.id}`, { status: "available", total_deliveries: Number(vol.total_deliveries ?? 0) + 1 });

  const items = await ctx.db.get(`batch_items?batch_id=eq.${batch.id}&select=kg,portions`);
  const kgKnown = items.length > 0 && items.every((i) => i.kg !== null && i.kg !== undefined);
  const kg = Math.round((kgKnown ? items.reduce((s, i) => s + Number(i.kg), 0) : portions * Number(ctx.factors.kg_per_meal ?? 0.5)) * 10) / 10;
  const co2 = Math.round(kg * Number(ctx.factors.co2e_kg_per_kg_food ?? 2.5) * 10) / 10;
  const points = portions * Number(ctx.factors.esg_points_per_meal ?? 5);
  await ctx.db.patch(`batches?id=eq.${batch.id}&status=in.(dispatched,picked_up)`, { status: "closed", est_kg: kg });
  await ctx.db.post("impact_logs", { batch_id: batch.id, restaurant_id: batch.restaurant_id, meals: portions, kg, co2e_kg: co2, esg_points: points, factor_version: String(ctx.factors.version ?? "unknown"), is_sample: false });
  const rest = (await ctx.db.get(`restaurants?id=eq.${batch.restaurant_id}&select=id,esg_points`))[0];
  if (rest) await ctx.db.patch(`restaurants?id=eq.${rest.id}`, { esg_points: Number(rest.esg_points ?? 0) + points });
  await emit(ctx, batch.id, [
    { type: "delivered", actor: "volunteer", tone: "green", title: "Delivered to fridge", detail: `${fridge?.code ?? "The fridge"} stock +${portions}`, payload: { portions }, jobId },
    { type: "impact_logged", actor: "system", tone: "green", title: "Impact recorded", detail: `${portions} meals, ${kg} kg, about ${co2} kg CO2e`, payload: { meals: portions, kg, co2e_kg: co2, esg_points: points, factor_version: ctx.factors.version } },
  ]);
  return { ok: true, status: "delivered", batchStatus: "closed" };
}

// ---------------------------------------------------------------- coordinator review
export type ReviewResult =
  | { ok: true; status: string; match?: MatchResult }
  | { ok: false; code: "not_found" | "wrong_state" | "expired" | "forbidden" };

/** A coordinator settles a batch the agent escalated: approve it for dispatch, or decline it. */
export async function reviewBatch(ctx: Ctx, batchId: string, decision: "approve" | "decline", note: string): Promise<ReviewResult> {
  const batch = (await ctx.db.get(`batches?id=eq.${batchId}&select=*`))[0];
  if (!batch) return { ok: false, code: "not_found" };
  if (batch.status !== "escalated") return { ok: false, code: "wrong_state" };
  const cleanNote = note.trim().slice(0, 300);

  if (decision === "approve" && batch.safe_until && new Date(batch.safe_until).getTime() < ctx.now.getTime()) {
    await expireBatch(ctx, batch, "The safe window closed before the food reached a fridge.");
    return { ok: false, code: "expired" };
  }

  const approved = decision === "approve";
  const moved = await ctx.db.patch(
    `batches?id=eq.${batchId}&status=eq.escalated`,
    approved ? { status: "listed", fridge_id: null, reject_reason: null } : { status: "rejected", reject_reason: cleanNote || "Declined by a coordinator." }
  );
  if (moved.length === 0) return { ok: false, code: "wrong_state" };
  if (batch.fridge_id) await releaseFridge(ctx, batch);

  const text = approved ? cleanNote || "Approved by a coordinator after review." : cleanNote || "Declined by a coordinator.";
  await ctx.db.post("safety_checks", {
    batch_id: batchId, rule_set_version: String(ctx.rules.version ?? "unknown"), tier: batch.tier ?? "amber", passed: approved,
    confidence: batch.confidence ?? null, reasons: [{ code: approved ? "coordinator_override" : "coordinator_decline", text }], decided_by: "coordinator", is_sample: false,
  });
  await emit(ctx, batchId, [{
    type: "coordinator_decision", actor: "coordinator", tone: approved ? "green" : "red",
    title: approved ? "Coordinator approved" : "Coordinator declined", detail: text, payload: { approved },
  }]);
  if (!approved) return { ok: true, status: "rejected" };

  const match = await matchAndDispatch(ctx, batchId);
  return { ok: true, status: match.status, match };
}

// ---------------------------------------------------------------- fridge stock (hosts)
export type StockResult = { ok: true; stock: number; removed: number } | { ok: false; code: "not_found" | "nothing_to_remove" };

/** A fridge host records portions taken by people, or removed because they expired. Keeps room accurate for matching. */
export async function recordFridgeStock(ctx: Ctx, fridgeId: string, portions: number, reason: "taken" | "expired"): Promise<StockResult> {
  const f = (await ctx.db.get(`fridges?id=eq.${fridgeId}&select=*`))[0];
  if (!f) return { ok: false, code: "not_found" };
  const removed = Math.min(Math.max(0, Math.floor(portions)), Number(f.current_stock ?? 0));
  if (removed <= 0) return { ok: false, code: "nothing_to_remove" };
  const updated = await adjustFridge(ctx, fridgeId, (x) => ({ current_stock: Math.max(0, Number(x.current_stock) - removed) }));
  if (!updated) return { ok: false, code: "not_found" };
  await ctx.db.post("fridge_stock_log", { fridge_id: fridgeId, batch_id: null, delta_portions: -removed, reason, is_sample: false });
  return { ok: true, stock: Number(updated.current_stock), removed };
}

// ---------------------------------------------------------------- housekeeping
export type TickSummary = { timedOut: number; simulated: number; matched: number; offered: number; expired: number };

export async function tick(ctx: Ctx): Promise<TickSummary> {
  const summary: TickSummary = { timedOut: 0, simulated: 0, matched: 0, offered: 0, expired: 0 };
  const nowMs = ctx.now.getTime();
  const system: Actor = { kind: "system" };

  // 1. Offers nobody answered in time
  const lapsed = await ctx.db.get(`jobs?status=eq.offered&is_sample=eq.false&expires_at=lt.${enc(iso(ctx.now))}&select=*`);
  for (const job of lapsed.slice(0, 10)) {
    await timeoutOffer(ctx, job);
    summary.timedOut++;
  }

  // 2. Demo volunteers (sample records with no sign-in account) answer and travel on their own
  const open = await ctx.db.get(`jobs?status=in.(${OPEN_JOB.join(",")})&is_sample=eq.false&select=*`);
  if (open.length > 0) {
    const ids = Array.from(new Set(open.map((j) => j.volunteer_id)));
    const vols = await ctx.db.get(`volunteers?id=in.(${ids.join(",")})&select=*`);
    const byId = new Map<string, any>(vols.map((v) => [v.id, v]));
    for (const job of open.slice(0, 10)) {
      const vol = byId.get(job.volunteer_id);
      if (!vol || vol.user_id) continue;
      const h = hash(job.id);
      if (job.status === "offered") {
        const delaySec = 15 + (h % 60);
        if (nowMs < new Date(job.offered_at).getTime() + delaySec * 1000) continue;
        const roll = (h >>> 8) % 100;
        if (roll < 72) await respondToOffer(ctx, job.id, true, system);
        else if (roll < 86) await respondToOffer(ctx, job.id, false, system);
        else continue; // ignored: the offer will time out
        summary.simulated++;
      } else if (job.status === "accepted") {
        const wait = Math.max(45, Number(job.pickup_eta_min ?? 8) * 60 * SIM_FACTOR) * 1000;
        if (nowMs < new Date(job.responded_at).getTime() + wait) continue;
        await advanceJob(ctx, job.id, "picked_up", system);
        summary.simulated++;
      } else if (job.status === "picked_up") {
        const speed = SPEED_KMH[vol.transport] ?? 25;
        const tripMin = (Number(job.distance_km ?? 3) / speed) * 60 + 4;
        const wait = Math.max(45, tripMin * 60 * SIM_FACTOR) * 1000;
        if (nowMs < new Date(job.picked_up_at).getTime() + wait) continue;
        await advanceJob(ctx, job.id, "delivered", system);
        summary.simulated++;
      }
    }
  }

  // 3. Listed batches still waiting for a fridge, and matched batches waiting for a volunteer
  const listed = await ctx.db.get(`batches?status=eq.listed&is_sample=eq.false&select=id`);
  for (const b of listed.slice(0, 5)) {
    const r = await matchAndDispatch(ctx, b.id);
    if (r.stage === "matched") summary.matched++;
    if (r.offer?.sent) summary.offered++;
  }
  const matched = await ctx.db.get(`batches?status=eq.matched&is_sample=eq.false&select=id`);
  for (const b of matched.slice(0, 5)) {
    const r = await matchAndDispatch(ctx, b.id);
    if (r.offer?.sent) summary.offered++;
  }

  // 4. Safe windows that have closed
  const stale = await ctx.db.get(`batches?status=in.(listed,matched,dispatched,picked_up,escalated)&is_sample=eq.false&safe_until=lt.${enc(iso(ctx.now))}&select=*`);
  for (const b of stale.slice(0, 10)) {
    if (await expireBatch(ctx, b, "The safe window closed before the food reached a fridge.")) summary.expired++;
  }
  return summary;
}

// ---------------------------------------------------------------- demo accounts: choose whom to play
export const DEMO_VOLUNTEER_EMAIL = "volunteer.demo@barakat.test";
export const DEMO_HOST_EMAIL = "host.demo@barakat.test";

export type DemoVolunteer = { id: string; name: string; area: string; transport: string; status: string; hasOffer: boolean; onTrip: boolean; current: boolean };

/** Sample volunteers, with the ones holding an open offer first, so the demo can play whoever got the job. */
export async function demoVolunteers(ctx: Ctx, currentId: string | null): Promise<DemoVolunteer[]> {
  const vols = await ctx.db.get(`volunteers?is_sample=eq.true&select=id,full_name,area,transport,status`);
  const open = await ctx.db.get(`jobs?status=in.(${OPEN_JOB.join(",")})&is_sample=eq.false&select=volunteer_id,status`);
  const offered = new Set<string>(open.filter((j) => j.status === "offered").map((j) => j.volunteer_id));
  const onTrip = new Set<string>(open.filter((j) => j.status !== "offered").map((j) => j.volunteer_id));
  return vols
    .map((v) => ({ id: v.id, name: v.full_name, area: v.area, transport: v.transport, status: v.status, hasOffer: offered.has(v.id), onTrip: onTrip.has(v.id), current: v.id === currentId }))
    .sort((a, b) => Number(b.hasOffer) - Number(a.hasOffer) || Number(b.onTrip) - Number(a.onTrip) || a.name.localeCompare(b.name));
}

export async function switchDemoVolunteer(ctx: Ctx, userId: string, currentId: string | null, targetId: string): Promise<{ ok: true } | { ok: false; code: "not_found" | "forbidden" }> {
  const target = (await ctx.db.get(`volunteers?id=eq.${targetId}&select=id,is_sample,status,user_id`))[0];
  if (!target || !target.is_sample) return { ok: false, code: "not_found" };
  if (target.user_id && target.user_id !== userId) return { ok: false, code: "forbidden" };
  // The volunteer we leave goes back to the simulation, so nobody is left waiting for a human.
  if (currentId && currentId !== targetId) await ctx.db.patch(`volunteers?id=eq.${currentId}&user_id=eq.${userId}`, { user_id: null });
  const trips = await ctx.db.get(`jobs?volunteer_id=eq.${targetId}&status=in.(accepted,picked_up)&is_sample=eq.false&select=id`);
  const change: Record<string, unknown> = { user_id: userId };
  if (target.status !== "available" && trips.length === 0) change.status = "available";
  await ctx.db.patch(`volunteers?id=eq.${targetId}`, change);
  await ctx.db.patch(`profiles?id=eq.${userId}`, { volunteer_id: targetId });
  return { ok: true };
}

export type DemoFridge = { id: string; code: string; name: string; area: string; stock: number; capacity: number; incoming: number; current: boolean };

export async function demoFridges(ctx: Ctx, currentId: string | null): Promise<DemoFridge[]> {
  const fridges = await ctx.db.get(`fridges?is_sample=eq.true&select=id,code,name,area,current_stock,capacity_portions`);
  const live = await ctx.db.get(`batches?status=in.(matched,dispatched,picked_up)&is_sample=eq.false&select=fridge_id`);
  const counts = new Map<string, number>();
  for (const b of live) if (b.fridge_id) counts.set(b.fridge_id, (counts.get(b.fridge_id) ?? 0) + 1);
  return fridges
    .map((f) => ({ id: f.id, code: f.code, name: f.name, area: f.area, stock: f.current_stock, capacity: f.capacity_portions, incoming: counts.get(f.id) ?? 0, current: f.id === currentId }))
    .sort((a, b) => b.incoming - a.incoming || String(a.code).localeCompare(String(b.code)));
}

export async function switchDemoFridge(ctx: Ctx, userId: string, targetId: string): Promise<{ ok: true } | { ok: false; code: "not_found" }> {
  const f = (await ctx.db.get(`fridges?id=eq.${targetId}&select=id,is_sample`))[0];
  if (!f || !f.is_sample) return { ok: false, code: "not_found" };
  await ctx.db.patch(`profiles?id=eq.${userId}`, { fridge_id: targetId });
  return { ok: true };
}

// ---------------------------------------------------------------- HTTP handler
function fail(res: Res, status: number, code: string, message: string) {
  res.status(status).json({ ok: false, code, message });
}

let lastTickAt = 0;

export default async function handler(req: Req, res: Res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return fail(res, 405, "bad_request", "Use POST.");

  const env = ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}) as Record<string, string | undefined>;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  if (!serviceKey || !url) return fail(res, 503, "not_configured", "The server is missing SUPABASE_SERVICE_ROLE_KEY or the Supabase URL.");

  const authHeader = String(req.headers["authorization"] ?? req.headers["Authorization"] ?? "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return fail(res, 401, "unauthorized", "Please sign in.");
  let userId = "";
  let userEmail = "";
  try {
    const u = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${token}` } });
    if (!u.ok) return fail(res, 401, "unauthorized", "Your session is not valid. Please sign in again.");
    const who = (await u.json()) as { id?: string; email?: string };
    userId = String(who.id ?? "");
    userEmail = String(who.email ?? "").toLowerCase();
  } catch {
    return fail(res, 502, "upstream", "Could not reach the database.");
  }
  if (!userId) return fail(res, 401, "unauthorized", "Please sign in.");

  const db = httpDb(url, serviceKey);
  // Every success answer carries the server clock, so the app can correct for a wrong clock on the visitor's device.
  const reply = (payload: Record<string, unknown>) => res.status(200).json({ ...payload, serverNow: new Date().toISOString() });
  let body: Record<string, unknown> = {};
  try {
    body = (typeof req.body === "string" ? JSON.parse(req.body) : (req.body as Record<string, unknown>)) ?? {};
  } catch {
    return fail(res, 400, "bad_request", "The request body must be JSON.");
  }
  const action = String(body.action ?? "");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  try {
    const profile = (await db.get(`profiles?id=eq.${encodeURIComponent(userId)}&select=role,restaurant_id,volunteer_id,fridge_id`))[0];
    if (!profile) return fail(res, 403, "forbidden", "No profile for this account.");

    const configs = await db.get(`app_config?key=in.(safety_rules,impact_factors)&select=key,value`);
    const rules = configs.find((c) => c.key === "safety_rules")?.value;
    const factors = configs.find((c) => c.key === "impact_factors")?.value ?? {};
    if (!rules) return fail(res, 500, "setup", "The safety rules are missing. Run the seed files first.");
    const ctx: Ctx = { db, rules, factors, now: new Date() };

    if (action === "tick") {
      if (Date.now() - lastTickAt < 8000) return reply({ ok: true, skipped: true });
      lastTickAt = Date.now();
      return reply({ ok: true, summary: await tick(ctx) });
    }

    if (action === "match") {
      const batchId = String(body.batchId ?? "");
      if (!uuid.test(batchId)) return fail(res, 400, "bad_request", "Send a valid batchId.");
      const batch = (await db.get(`batches?id=eq.${batchId}&select=id,restaurant_id`))[0];
      const isCoordinator = profile.role === "coordinator";
      if (!batch || (!isCoordinator && !(profile.role === "restaurant" && profile.restaurant_id === batch.restaurant_id))) return fail(res, 404, "not_found", "Batch not found.");
      return reply({ ok: true, ...(await matchAndDispatch(ctx, batchId)) });
    }

    if (action === "demo_volunteers" || action === "demo_set_volunteer") {
      if (userEmail !== DEMO_VOLUNTEER_EMAIL) return fail(res, 403, "forbidden", "Only the demo volunteer account can choose a volunteer.");
      if (action === "demo_volunteers") return reply({ ok: true, volunteers: await demoVolunteers(ctx, profile.volunteer_id ?? null) });
      const targetId = String(body.volunteerId ?? "");
      if (!uuid.test(targetId)) return fail(res, 400, "bad_request", "Send a valid volunteerId.");
      const r = await switchDemoVolunteer(ctx, userId, profile.volunteer_id ?? null, targetId);
      return r.ok ? reply({ ok: true }) : fail(res, r.code === "not_found" ? 404 : 403, r.code, "That volunteer cannot be chosen.");
    }

    if (action === "demo_fridges" || action === "demo_set_fridge") {
      if (userEmail !== DEMO_HOST_EMAIL) return fail(res, 403, "forbidden", "Only the demo fridge host account can choose a fridge.");
      if (action === "demo_fridges") return reply({ ok: true, fridges: await demoFridges(ctx, profile.fridge_id ?? null) });
      const targetId = String(body.fridgeId ?? "");
      if (!uuid.test(targetId)) return fail(res, 400, "bad_request", "Send a valid fridgeId.");
      const r = await switchDemoFridge(ctx, userId, targetId);
      return r.ok ? reply({ ok: true }) : fail(res, 404, r.code, "That fridge cannot be chosen.");
    }

    if (action === "fridge_stock") {
      const fridgeId = String(body.fridgeId ?? "");
      if (!uuid.test(fridgeId)) return fail(res, 400, "bad_request", "Send a valid fridgeId.");
      const portions = Number(body.portions);
      const reason = body.reason === "expired" ? "expired" : body.reason === "taken" ? "taken" : null;
      if (!reason || !Number.isInteger(portions) || portions < 1 || portions > 500) return fail(res, 400, "bad_request", "Send portions (1 to 500) and a reason (taken or expired).");
      const mine = profile.role === "fridge_host" && profile.fridge_id === fridgeId;
      if (!mine && profile.role !== "coordinator") return fail(res, 403, "forbidden", "Only the host of this fridge, or a coordinator, can record stock.");
      const r = await recordFridgeStock(ctx, fridgeId, portions, reason);
      return r.ok ? reply({ ...r }) : fail(res, r.code === "not_found" ? 404 : 409, r.code, `Could not record this (${r.code}).`);
    }

    if (action === "review") {
      if (profile.role !== "coordinator") return fail(res, 403, "forbidden", "Only a coordinator can review a batch.");
      const batchId = String(body.batchId ?? "");
      if (!uuid.test(batchId)) return fail(res, 400, "bad_request", "Send a valid batchId.");
      const decision = body.decision === "approve" ? "approve" : body.decision === "decline" ? "decline" : null;
      if (!decision) return fail(res, 400, "bad_request", "decision must be approve or decline.");
      const result = await reviewBatch(ctx, batchId, decision, typeof body.note === "string" ? body.note : "");
      if (!result.ok) return fail(res, result.code === "not_found" ? 404 : 409, result.code, `Could not complete this review (${result.code}).`);
      return reply({ ...result });
    }

    if (action === "respond" || action === "progress") {
      const jobId = String(body.jobId ?? "");
      if (!uuid.test(jobId)) return fail(res, 400, "bad_request", "Send a valid jobId.");
      const actor: Actor = profile.role === "coordinator" ? { kind: "coordinator" } : profile.role === "volunteer" && profile.volunteer_id ? { kind: "volunteer", volunteerId: profile.volunteer_id } : { kind: "volunteer", volunteerId: "none" };
      let result: JobResult;
      if (action === "respond") {
        result = await respondToOffer(ctx, jobId, body.accept === true, actor);
      } else {
        const step = body.step === "delivered" ? "delivered" : body.step === "picked_up" ? "picked_up" : null;
        if (!step) return fail(res, 400, "bad_request", "step must be picked_up or delivered.");
        result = await advanceJob(ctx, jobId, step, actor);
      }
      if (!result.ok) return fail(res, result.code === "not_found" ? 404 : result.code === "forbidden" ? 403 : 409, result.code, `Could not complete this step (${result.code}).`);
      return reply({ ...result });
    }

    return fail(res, 400, "bad_request", "Unknown action.");
  } catch (err) {
    console.error("dispatch: failed", err);
    if (err instanceof DbError && err.status === 404) return fail(res, 404, "not_found", err.message);
    const msg = err instanceof Error ? err.message : "error";
    const setup = /reserved_portions|expires_at|column .* does not exist|uniq_open_job/i.test(msg);
    return fail(res, 502, setup ? "setup" : "upstream", setup ? "The database is missing the Step 7 setup. Run supabase/12_dispatch.sql." : "The dispatcher could not finish.");
  }
}
