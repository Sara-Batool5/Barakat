import { supabase } from "../lib/supabase";

export type FeedEvent = {
  id: string;
  batchId: string;
  type: string;
  actor: string;
  tone: "neutral" | "green" | "amber" | "red";
  title: string;
  detail: string | null;
  createdAt: string;
  isSample: boolean;
  restaurantName: string;
  firstItem: string;
};

export type ActivityStats = {
  decisions24h: number;
  openEscalations: number;
  /** share of recent batches the agent handled without a coordinator, 0 to 100 */
  automationRate: number | null;
  medianMatchMin: number | null;
  /** how many batches are in each live stage right now */
  pipeline: { draft: number; listed: number; matched: number; transit: number; escalated: number };
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

export async function listFeed(includeSample: boolean, limit = 60): Promise<FeedEvent[]> {
  const sb = supabase;
  if (!sb) return [];
  let q = sb
    .from("agent_events")
    .select("id,batch_id,event_type,actor,tone,title,detail,created_at,is_sample,batches(restaurants(name),batch_items(name))")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!includeSample) q = q.eq("is_sample", false);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as any[]).map((e) => {
    const b = one<any>(e.batches);
    const r = b ? one<any>(b.restaurants) : null;
    const items = (b?.batch_items ?? []) as { name: string }[];
    return {
      id: e.id, batchId: e.batch_id, type: e.event_type, actor: e.actor, tone: e.tone, title: e.title, detail: e.detail ?? null,
      createdAt: e.created_at, isSample: !!e.is_sample, restaurantName: r?.name ?? "", firstItem: items[0]?.name ?? "",
    } satisfies FeedEvent;
  });
}

const median = (v: number[]) => {
  if (v.length === 0) return null;
  const s = [...v].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export async function loadStats(includeSample: boolean): Promise<ActivityStats> {
  const sb = supabase;
  const empty: ActivityStats = { decisions24h: 0, openEscalations: 0, automationRate: null, medianMatchMin: null, pipeline: { draft: 0, listed: 0, matched: 0, transit: 0, escalated: 0 } };
  if (!sb) return empty;
  const since24 = new Date(Date.now() - 24 * 3600_000).toISOString();
  const since14 = new Date(Date.now() - 14 * 86400_000).toISOString();

  let decisions = sb.from("agent_events").select("id", { count: "exact", head: true }).in("actor", ["agent", "system"]).gte("created_at", since24);
  let batchesQ = sb.from("batches").select("id,status").order("submitted_at", { ascending: false }).limit(1000);
  let eventsQ = sb
    .from("agent_events")
    .select("batch_id,event_type,created_at")
    .in("event_type", ["photo_received", "fridge_matched", "escalated", "coordinator_decision"])
    .gte("created_at", since14)
    .limit(5000);
  if (!includeSample) {
    decisions = decisions.eq("is_sample", false);
    batchesQ = batchesQ.eq("is_sample", false);
    eventsQ = eventsQ.eq("is_sample", false);
  }
  const [dec, bat, evs] = await Promise.all([decisions, batchesQ, eventsQ]);
  if (bat.error) throw bat.error;
  if (evs.error) throw evs.error;

  const pipeline = { draft: 0, listed: 0, matched: 0, transit: 0, escalated: 0 };
  for (const b of (bat.data ?? []) as { status: string }[]) {
    if (b.status === "draft") pipeline.draft++;
    else if (b.status === "listed") pipeline.listed++;
    else if (b.status === "matched") pipeline.matched++;
    else if (b.status === "dispatched" || b.status === "picked_up") pipeline.transit++;
    else if (b.status === "escalated") pipeline.escalated++;
  }

  const firstSeen = new Map<string, number>();
  const matchedAt = new Map<string, number>();
  const needsHuman = new Set<string>();
  for (const e of (evs.data ?? []) as { batch_id: string; event_type: string; created_at: string }[]) {
    const t = new Date(e.created_at).getTime();
    if (e.event_type === "photo_received") firstSeen.set(e.batch_id, Math.min(firstSeen.get(e.batch_id) ?? t, t));
    else if (e.event_type === "fridge_matched") matchedAt.set(e.batch_id, Math.min(matchedAt.get(e.batch_id) ?? t, t));
    else needsHuman.add(e.batch_id);
  }
  const total = firstSeen.size;
  let human = 0;
  for (const id of firstSeen.keys()) if (needsHuman.has(id)) human++;
  const gaps: number[] = [];
  for (const [id, t0] of firstSeen) {
    const t1 = matchedAt.get(id);
    if (t1 !== undefined && t1 >= t0) gaps.push((t1 - t0) / 60000);
  }

  return {
    decisions24h: dec.count ?? 0,
    openEscalations: pipeline.escalated,
    automationRate: total > 0 ? Math.round(((total - human) / total) * 100) : null,
    medianMatchMin: median(gaps) === null ? null : Math.round((median(gaps) as number) * 10) / 10,
    pipeline,
  };
}

/** Calls `onChange` whenever the agent writes a new event. Returns a function that stops listening. */
export function subscribeFeed(onChange: () => void): () => void {
  const sb = supabase;
  if (!sb) return () => undefined;
  const channel = sb
    .channel("barakat-agent-feed")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "agent_events" }, () => onChange())
    .subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}
