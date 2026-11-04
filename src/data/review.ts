import type { User } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";
import type { Tier } from "./types";

export type ReviewItem = {
  id: string;
  restaurantName: string;
  area: string;
  tier: Tier | null;
  portions: number;
  confidence: number | null;
  submittedAt: string;
  startedAt: string;
  safeUntil: string | null;
  notes: string | null;
  photo: string | null;
  isSample: boolean;
  /** why the agent asked for a human */
  reason: { code: "low_confidence" | "no_volunteer_accepted" | "generic"; percent?: number };
  items: { name: string; category: string; portions: number }[];
};

export type SafetyCheck = {
  tier: Tier;
  passed: boolean;
  confidence: number | null;
  decidedBy: "agent" | "coordinator";
  createdAt: string;
  reasons: { code: string; text?: string; params?: Record<string, string | number> }[];
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

type SeedBatch = {
  id: string; restaurantId: string; status: string; tier: Tier | null; estPortions: number; confidence: number | null;
  submittedAt: string; preparedAt: string | null; safeUntilAt: string | null; notes: string | null;
  items: { name: string; category: string; portions: number }[];
};
type Seed = { anchor: string; restaurants: { id: string; name: string; area: string }[]; batches: SeedBatch[] };

export async function listEscalated(user: User): Promise<ReviewItem[]> {
  const sb = supabase;
  if (!sb || user.mode === "local") {
    const mod = await import("./seed/seed.json");
    const seed = (mod.default ?? mod) as unknown as Seed;
    const shift = Date.now() - new Date(seed.anchor).getTime();
    const at = (iso: string) => new Date(new Date(iso).getTime() + shift).toISOString();
    return seed.batches
      .filter((b) => b.status === "escalated")
      .map((b) => {
        const r = seed.restaurants.find((x) => x.id === b.restaurantId);
        return {
          id: b.id, restaurantName: r?.name ?? "", area: r?.area ?? "", tier: b.tier, portions: b.estPortions, confidence: b.confidence,
          submittedAt: at(b.submittedAt), startedAt: at(b.preparedAt ?? b.submittedAt), safeUntil: b.safeUntilAt ? at(b.safeUntilAt) : null,
          notes: b.notes, photo: null, isSample: true,
          reason: { code: "low_confidence" as const, percent: b.confidence !== null ? Math.round(b.confidence * 100) : undefined },
          items: b.items,
        };
      });
  }

  const { data, error } = await sb
    .from("batches")
    .select("id,tier,est_portions,confidence,submitted_at,prepared_at,safe_until,photo_path,notes,is_sample,restaurants(name,area),batch_items(name,category,portions)")
    .eq("status", "escalated")
    .order("submitted_at", { ascending: true })
    .limit(30);
  if (error) throw error;
  const rows = (data ?? []) as any[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id as string);
  const reasons = new Map<string, string>();
  try {
    const { data: evs } = await sb
      .from("agent_events")
      .select("batch_id,payload,created_at")
      .in("batch_id", ids)
      .eq("event_type", "escalated")
      .order("created_at", { ascending: false });
    for (const e of (evs ?? []) as any[]) if (!reasons.has(e.batch_id)) reasons.set(e.batch_id, String(e.payload?.reason ?? ""));
  } catch {
    /* the reason falls back to a generic one */
  }

  const paths = rows.map((r) => r.photo_path as string | null).filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    try {
      const { data: signed } = await sb.storage.from("surplus-photos").createSignedUrls(paths, 3600);
      for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    } catch {
      /* illustrations instead */
    }
  }

  return rows.map((r) => {
    const rest = one<any>(r.restaurants);
    const code = reasons.get(r.id);
    const conf = r.confidence === null || r.confidence === undefined ? null : Number(r.confidence);
    const reasonCode: ReviewItem["reason"]["code"] = code === "no_volunteer_accepted" ? "no_volunteer_accepted" : code === "low_confidence" || (conf !== null && conf < 0.75) ? "low_confidence" : "generic";
    return {
      id: r.id,
      restaurantName: rest?.name ?? "",
      area: rest?.area ?? "",
      tier: (r.tier as Tier | null) ?? null,
      portions: r.est_portions ?? 0,
      confidence: conf,
      submittedAt: r.submitted_at,
      startedAt: r.prepared_at ?? r.submitted_at,
      safeUntil: r.safe_until ?? null,
      notes: r.notes ?? null,
      photo: r.photo_path ? urls.get(r.photo_path) ?? null : null,
      isSample: !!r.is_sample,
      reason: { code: reasonCode, percent: conf !== null ? Math.round(conf * 100) : undefined },
      items: (r.batch_items ?? []).map((i: any) => ({ name: i.name, category: i.category, portions: i.portions })),
    } satisfies ReviewItem;
  });
}

export async function loadSafetyChecks(user: User, batchId: string): Promise<SafetyCheck[]> {
  const sb = supabase;
  if (!sb || user.mode === "local") return [];
  const { data, error } = await sb
    .from("safety_checks")
    .select("tier,passed,confidence,decided_by,created_at,reasons")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as any[]).map((c) => ({
    tier: c.tier,
    passed: !!c.passed,
    confidence: c.confidence === null || c.confidence === undefined ? null : Number(c.confidence),
    decidedBy: c.decided_by,
    createdAt: c.created_at,
    reasons: Array.isArray(c.reasons) ? c.reasons : [],
  }));
}
