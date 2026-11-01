import type { User } from "../auth/AuthContext";
import { blobToDataUrl } from "../lib/image";
import { screenBatch } from "../lib/safety";
import { supabase } from "../lib/supabase";
import type { Outcome } from "./screen";
import type { Tier } from "./types";

const BUCKET = "surplus-photos";
const LOCAL_KEY = "barakat-local-batches";

export type NewBatchInput = {
  photo: Blob | null;
  items: { name: string; category: string; portions: number; allergens: string[] }[];
  preparedMinutesAgo: number | null;
  storage: "ambient" | "chilled";
  storedTempC: number | null;
  pickupMinutes: number;
  notes: string;
  /** id of the photo analysis the form was filled from, if any */
  analysisId?: string | null;
};

export type MyBatch = {
  id: string;
  status: string;
  tier: Tier | null;
  portions: number;
  submittedAt: string;
  /** when the food clock started (preparation time, or submission time) */
  startedAt: string;
  safeUntil: string | null;
  notes: string | null;
  rejectReason: string | null;
  photo: string | null;
  items: { name: string; category: string; portions: number }[];
};

export type BatchEvent = {
  type: string;
  actor: string;
  tone: "neutral" | "green" | "amber" | "red";
  title: string;
  detail: string | null;
  createdAt: string;
};

export class BatchError extends Error {
  code: "photo" | "save" | "setup";
  constructor(code: "photo" | "save" | "setup", message: string) {
    super(message);
    this.code = code;
  }
}

// ---------------------------------------------------------------- local (no Supabase)
type LocalBatch = MyBatch & { events: BatchEvent[] };

function readLocal(): LocalBatch[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]") as LocalBatch[];
  } catch {
    return [];
  }
}

async function thumbnail(blob: Blob): Promise<string> {
  // Small copy so the browser's storage is not filled up.
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 420 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const small = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.6));
    return await blobToDataUrl(small);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function createLocal(input: NewBatchInput): Promise<{ id: string; outcome: Outcome }> {
  const id = `local-${Date.now()}`;
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const portions = input.items.reduce((sum, i) => sum + i.portions, 0);

  // No server in local mode, so the same screening logic runs here.
  const screening = screenBatch({
    items: input.items.map((i) => ({ category: i.category })),
    preparedMinutesAgo: input.preparedMinutesAgo,
    storedTempC: input.storedTempC,
    now: nowDate,
  });
  const listed = screening.tier !== "red" && screening.missing.length === 0;
  const status = listed ? "listed" : "rejected";
  const safeUntil = listed && screening.safeUntil ? screening.safeUntil.toISOString() : null;
  const rejectReason = listed ? null : "This batch did not pass the safety check.";
  const startedAt = input.preparedMinutesAgo === null ? now : new Date(nowDate.getTime() - input.preparedMinutesAgo * 60000).toISOString();

  const events: BatchEvent[] = [
    { type: "photo_received", actor: "restaurant", tone: "neutral", title: "Surplus submitted", detail: `${portions} portions submitted by the restaurant`, createdAt: now },
    { type: "safety_check", actor: "agent", tone: screening.tier === "red" ? "red" : screening.tier === "amber" ? "amber" : "green", title: `Safety check: ${screening.tier}`, detail: null, createdAt: new Date(nowDate.getTime() + 20).toISOString() },
    listed
      ? { type: "safe_window_set", actor: "agent", tone: "green", title: "Safe window set", detail: null, createdAt: new Date(nowDate.getTime() + 40).toISOString() }
      : { type: "rejected", actor: "agent", tone: "red", title: "Batch declined", detail: rejectReason, createdAt: new Date(nowDate.getTime() + 40).toISOString() },
  ];
  const batch: LocalBatch = {
    id,
    status,
    tier: screening.tier,
    portions,
    submittedAt: now,
    startedAt,
    safeUntil,
    notes: input.notes || null,
    rejectReason,
    photo: input.photo ? await thumbnail(input.photo) : null,
    items: input.items.map((i) => ({ name: i.name, category: i.category, portions: i.portions })),
    events,
  };
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify([batch, ...readLocal()].slice(0, 20)));
  } catch {
    throw new BatchError("save", "Browser storage is full.");
  }
  return {
    id,
    outcome: {
      outcome: listed ? "listed" : "rejected",
      status,
      tier: screening.tier,
      safeUntil,
      safeMinutes: listed ? screening.safeMinutes : null,
      reasons: screening.reasons,
      rejectReason,
    },
  };
}

type SeedBatch = {
  id: string;
  restaurantId: string;
  status: string;
  tier: Tier | null;
  estPortions: number;
  submittedAt: string;
  preparedAt: string | null;
  safeUntilAt: string | null;
  notes: string | null;
  rejectReason: string | null;
  items: { name: string; category: string; portions: number }[];
  events: { type: string; actor: string; tone: BatchEvent["tone"]; title: string; detail: string | null; createdAt: string }[];
};
type Seed = { anchor: string; restaurants: { id: string; name: string }[]; batches: SeedBatch[] };

async function localSample(): Promise<{ batches: LocalBatch[] }> {
  const mod = await import("./seed/seed.json");
  const seed = (mod.default ?? mod) as unknown as Seed;
  const shift = Date.now() - new Date(seed.anchor).getTime();
  const at = (iso: string) => new Date(new Date(iso).getTime() + shift).toISOString();
  const mine = seed.restaurants.find((r) => r.name === "Zaytoun Mezze Bar");
  const batches = seed.batches
    .filter((b) => b.restaurantId === mine?.id)
    .map<LocalBatch>((b) => ({
      id: b.id,
      status: b.status,
      tier: b.tier,
      portions: b.estPortions,
      submittedAt: at(b.submittedAt),
      startedAt: at(b.preparedAt ?? b.submittedAt),
      safeUntil: b.safeUntilAt ? at(b.safeUntilAt) : null,
      notes: b.notes,
      rejectReason: b.rejectReason,
      photo: null,
      items: b.items,
      events: b.events.map((e) => ({ ...e, detail: e.detail, createdAt: at(e.createdAt) })),
    }));
  return { batches };
}

// ---------------------------------------------------------------- public API
export async function createBatch(user: User, input: NewBatchInput): Promise<{ id: string; outcome?: Outcome }> {
  const sb = supabase;
  if (!sb || user.mode === "local") return createLocal(input);

  const id = crypto.randomUUID();
  let photoPath: string | null = null;
  if (input.photo) {
    photoPath = `${user.id}/${id}.jpg`;
    const { error } = await sb.storage.from(BUCKET).upload(photoPath, input.photo, { contentType: "image/jpeg", upsert: false });
    if (error) throw new BatchError("photo", error.message);
  }

  const preparedAt = input.preparedMinutesAgo === null ? null : new Date(Date.now() - input.preparedMinutesAgo * 60000).toISOString();
  const { error } = await sb.rpc("submit_surplus_batch", {
    p_batch_id: id,
    p_prepared_at: preparedAt,
    p_storage: input.storage,
    p_temp: input.storedTempC,
    p_pickup_minutes: input.pickupMinutes,
    p_notes: input.notes || null,
    p_photo_path: photoPath,
    p_items: input.items,
    p_analysis_id: input.analysisId ?? null,
  });
  if (error) {
    if (photoPath) await sb.storage.from(BUCKET).remove([photoPath]);
    const missingFunction = error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message);
    throw new BatchError(missingFunction ? "setup" : "save", error.message);
  }
  return { id };
}

export async function listMyBatches(user: User): Promise<MyBatch[]> {
  const sb = supabase;
  if (!sb || user.mode === "local") {
    const sample = await localSample();
    return [...readLocal(), ...sample.batches].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)).map(({ events: _e, ...rest }) => rest);
  }
  if (!user.restaurantId) return [];

  const { data, error } = await sb
    .from("batches")
    .select("id,status,tier,est_portions,submitted_at,prepared_at,safe_until,photo_path,notes,reject_reason,batch_items(name,category,portions)")
    .eq("restaurant_id", user.restaurantId)
    .order("submitted_at", { ascending: false })
    .limit(60);
  if (error) throw error;

  const rows = (data ?? []) as any[];
  const paths = rows.map((r) => r.photo_path as string | null).filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    tier: (r.tier as Tier | null) ?? null,
    portions: r.est_portions ?? 0,
    submittedAt: r.submitted_at,
    startedAt: r.prepared_at ?? r.submitted_at,
    safeUntil: r.safe_until ?? null,
    notes: r.notes ?? null,
    rejectReason: r.reject_reason ?? null,
    photo: r.photo_path ? urls.get(r.photo_path) ?? null : null,
    items: (r.batch_items ?? []).map((i: any) => ({ name: i.name, category: i.category, portions: i.portions })),
  }));
}

export async function loadBatchEvents(user: User, batchId: string): Promise<BatchEvent[]> {
  const sb = supabase;
  if (!sb || user.mode === "local") {
    const local = readLocal().find((b) => b.id === batchId);
    if (local) return local.events;
    const sample = await localSample();
    return sample.batches.find((b) => b.id === batchId)?.events ?? [];
  }
  const { data, error } = await sb
    .from("agent_events")
    .select("event_type,actor,tone,title,detail,created_at")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((e: any) => ({
    type: e.event_type,
    actor: e.actor,
    tone: e.tone,
    title: e.title,
    detail: e.detail ?? null,
    createdAt: e.created_at,
  }));
}
