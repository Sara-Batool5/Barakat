/**
 * POST /api/screen-batch   body: { batchId }
 * The safety gate of the BARAKAT agent. It takes a batch that a restaurant has just submitted (status "draft"),
 * applies the rules stored in app_config (safetyRules.json), and decides:
 *   listed    green or amber, safe window started, ready for matching
 *   rejected  red tier, missing required details, or too little safe time left
 *   escalated the photo reading was not confident enough, so a coordinator must look
 * Every decision is saved with its reasons (safety_checks) and written to the batch's activity timeline.
 *
 * Server-only environment variables: SUPABASE_SERVICE_ROLE_KEY, plus VITE_SUPABASE_URL (or SUPABASE_URL).
 * Self-contained on purpose (no imports). The screening logic matches src/lib/safety.ts, which powers the form's
 * live preview; a test keeps the two in step. Thresholds in the rules are placeholders until validated with
 * Dubai Municipality: BARAKAT screens food, it does not certify it.
 */

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Res = { status(code: number): Res; json(body: unknown): void; setHeader(name: string, value: string): void };

export type Tier = "green" | "amber" | "red";
export type Reason = { code: string; params?: Record<string, string | number> };
export type Screening = {
  tier: Tier;
  reasons: Reason[];
  missing: ("items" | "prepared_at" | "stored_temp_c")[];
  safeUntil: Date | null;
  safeMinutes: number | null;
};

const SEVERITY: Record<Tier, number> = { green: 0, amber: 1, red: 2 };
const PREP_CLOCK = new Set(["cooked_chilled", "sandwiches_salads", "dairy_desserts", "bakery_ambient"]);
const NEEDS_PREP = new Set(["cooked_chilled", "sandwiches_salads", "dairy_desserts"]);

const REASON_TEXT: Record<string, string> = {
  no_items: "No items were found on the batch.",
  sealed_or_whole: "Sealed, baked or whole items with no temperature condition.",
  amber_conditions: "Cooked or chilled food: listed with the restaurant's confirmation and a safe-window timer.",
  raw_meat_fish_hard_stop: "Raw meat and fish cannot be listed.",
  plate_leftovers_hard_stop: "Food that has been served on a plate cannot be listed.",
  unlabelled_unknown_hard_stop: "Unknown or unlabelled food cannot be listed.",
  temp_above_limit: "Stored at {temp} C, above the {max} C chilled limit, so it cannot be listed.",
  window_too_short: "Only {minutes} min of safe time is left, and a volunteer needs at least {min} min.",
  unknown_category: "At least one item has a category the rules do not know.",
  missing_info: "Required details are missing: {fields}.",
  low_confidence: "The photo reading was only {percent}% confident, so a coordinator will check it.",
};

export function reasonText(r: Reason): string {
  const t = REASON_TEXT[r.code] ?? r.code;
  return t.replace(/\{(\w+)\}/g, (_, k: string) => (r.params && k in r.params ? String(r.params[k]) : `{${k}}`));
}

export type ScreenInput = {
  items: { category: string }[];
  preparedMinutesAgo: number | null;
  storedTempC: number | null;
  now?: Date;
};

/** Pure screening logic (same as src/lib/safety.ts, with the rules passed in). */
export function screenBatch(input: ScreenInput, rules: any): Screening {
  const cats = rules.categories as Record<string, { tier: Tier; storage: string; max_safe_hours: number }>;
  const tierOf = (c: string): Tier => (cats[c]?.tier ?? "red") as Tier;
  const storageOf = (c: string) => cats[c]?.storage ?? "ambient";
  const now = input.now ?? new Date();
  const reasons: Reason[] = [];
  const missing: Screening["missing"] = [];

  if (input.items.length === 0) {
    return { tier: "green", reasons: [{ code: "no_items" }], missing: ["items"], safeUntil: null, safeMinutes: null };
  }

  let tier: Tier = "green";
  for (const it of input.items) {
    const t = tierOf(it.category);
    if (SEVERITY[t] > SEVERITY[tier]) tier = t;
  }
  for (const it of input.items) {
    if (!cats[it.category]) reasons.push({ code: "unknown_category" });
  }
  for (const hs of (rules.hard_stops ?? []) as { code: string; category?: string }[]) {
    if (hs.category && input.items.some((it) => it.category === hs.category)) reasons.push({ code: hs.code });
  }

  const hasChilled = input.items.some((it) => storageOf(it.category) === "chilled" && tierOf(it.category) !== "red");
  const max = rules.temperature_c.chilled_max as number;
  if (hasChilled) {
    if (input.storedTempC === null) missing.push("stored_temp_c");
    else if (input.storedTempC > max) {
      tier = "red";
      reasons.push({ code: "temp_above_limit", params: { max, temp: input.storedTempC } });
    }
  }
  if (input.items.some((it) => NEEDS_PREP.has(it.category)) && input.preparedMinutesAgo === null) missing.push("prepared_at");

  if (tier === "red") return { tier, reasons, missing, safeUntil: null, safeMinutes: null };

  let earliest = Infinity;
  for (const it of input.items) {
    const hours = cats[it.category]?.max_safe_hours ?? 0;
    const startMs = PREP_CLOCK.has(it.category) && input.preparedMinutesAgo !== null ? now.getTime() - input.preparedMinutesAgo * 60000 : now.getTime();
    earliest = Math.min(earliest, startMs + hours * 3600000);
  }
  const safeMinutes = Math.max(0, Math.floor((earliest - now.getTime()) / 60000));
  const minWindow = rules.dispatch.min_window_minutes_after_match as number;
  if (safeMinutes < minWindow) {
    reasons.push({ code: "window_too_short", params: { minutes: safeMinutes, min: minWindow } });
    return { tier: "red", reasons, missing, safeUntil: new Date(earliest), safeMinutes };
  }
  reasons.push({ code: tier === "amber" ? "amber_conditions" : "sealed_or_whole" });
  return { tier, reasons, missing, safeUntil: new Date(earliest), safeMinutes };
}

export type Decision = {
  outcome: "listed" | "rejected" | "escalated";
  tier: Tier;
  reasons: Reason[];
  safeUntil: Date | null;
  safeMinutes: number | null;
  rejectReason: string | null;
};

/** The gate's decision: the screening plus the "is it good enough to list?" rules. */
export function decide(input: ScreenInput & { confidence: number | null }, rules: any): Decision {
  const s = screenBatch(input, rules);
  if (s.tier === "red") {
    return { outcome: "rejected", tier: "red", reasons: s.reasons, safeUntil: null, safeMinutes: s.safeMinutes, rejectReason: reasonText(s.reasons[0] ?? { code: "unknown_category" }) };
  }
  if (s.missing.length > 0) {
    const fields = s.missing.map((m) => (m === "prepared_at" ? "preparation time" : m === "stored_temp_c" ? "storage temperature" : "items")).join(" and ");
    const r: Reason = { code: "missing_info", params: { fields } };
    return { outcome: "rejected", tier: s.tier, reasons: [r, ...s.reasons], safeUntil: null, safeMinutes: s.safeMinutes, rejectReason: reasonText(r) };
  }
  const autoMin = rules.confidence?.auto_list_min ?? 0.75;
  if (input.confidence !== null && input.confidence < autoMin) {
    const r: Reason = { code: "low_confidence", params: { percent: Math.round(input.confidence * 100) } };
    return { outcome: "escalated", tier: s.tier, reasons: [r, ...s.reasons], safeUntil: s.safeUntil, safeMinutes: s.safeMinutes, rejectReason: null };
  }
  return { outcome: "listed", tier: s.tier, reasons: s.reasons, safeUntil: s.safeUntil, safeMinutes: s.safeMinutes, rejectReason: null };
}

function fail(res: Res, status: number, code: string, message: string) {
  res.status(status).json({ ok: false, code, message });
}

function sbHeaders(key: string, extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", ...extra };
}

function hm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`;
}

export default async function handler(req: Req, res: Res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return fail(res, 405, "bad_request", "Use POST.");

  const env = ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}) as Record<string, string | undefined>;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  if (!serviceKey || !url) return fail(res, 503, "not_configured", "The server is missing SUPABASE_SERVICE_ROLE_KEY or the Supabase URL.");

  // 1. Who is asking?
  const authHeader = String(req.headers["authorization"] ?? req.headers["Authorization"] ?? "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return fail(res, 401, "unauthorized", "Please sign in.");
  let userId = "";
  try {
    const u = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${token}` } });
    if (!u.ok) return fail(res, 401, "unauthorized", "Your session is not valid. Please sign in again.");
    userId = String(((await u.json()) as { id?: string }).id ?? "");
  } catch {
    return fail(res, 502, "upstream", "Could not reach the database.");
  }
  if (!userId) return fail(res, 401, "unauthorized", "Please sign in.");

  let profile: { role?: string; restaurant_id?: string | null } | undefined;
  try {
    const p = await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role,restaurant_id`, { headers: sbHeaders(serviceKey) });
    const rows = (await p.json()) as { role?: string; restaurant_id?: string | null }[];
    profile = Array.isArray(rows) ? rows[0] : undefined;
  } catch {
    return fail(res, 502, "upstream", "Could not reach the database.");
  }
  const isCoordinator = profile?.role === "coordinator";
  if (!profile || (!isCoordinator && !(profile.role === "restaurant" && profile.restaurant_id))) {
    return fail(res, 403, "forbidden", "Only the restaurant that submitted the batch, or a coordinator, can run the safety check.");
  }

  // 2. The batch
  let body: Record<string, unknown> = {};
  try {
    body = (typeof req.body === "string" ? JSON.parse(req.body) : (req.body as Record<string, unknown>)) ?? {};
  } catch {
    return fail(res, 400, "bad_request", "The request body must be JSON.");
  }
  const batchId = String(body.batchId ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(batchId)) return fail(res, 400, "bad_request", "Send a valid batchId.");

  let batch: any;
  try {
    const b = await fetch(
      `${url}/rest/v1/batches?id=eq.${batchId}&select=id,restaurant_id,status,tier,submitted_at,prepared_at,stored_temp_c,confidence,pickup_until,safe_until,reject_reason,batch_items(category)`,
      { headers: sbHeaders(serviceKey) }
    );
    const rows = (await b.json()) as any[];
    batch = Array.isArray(rows) ? rows[0] : undefined;
  } catch {
    return fail(res, 502, "upstream", "Could not reach the database.");
  }
  if (!batch || (!isCoordinator && batch.restaurant_id !== profile.restaurant_id)) return fail(res, 404, "not_found", "Batch not found.");

  // Already screened: report the earlier decision, change nothing.
  if (batch.status !== "draft") {
    return res.status(200).json({
      ok: true, alreadyScreened: true, outcome: batch.status === "rejected" ? "rejected" : batch.status === "escalated" ? "escalated" : "listed",
      status: batch.status, tier: batch.tier, safeUntil: batch.safe_until, safeMinutes: batch.safe_until ? Math.max(0, Math.floor((new Date(batch.safe_until).getTime() - Date.now()) / 60000)) : null,
      reasons: [], rejectReason: batch.reject_reason ?? null,
    });
  }

  // 3. The rules
  let rules: any;
  try {
    const r = await fetch(`${url}/rest/v1/app_config?key=eq.safety_rules&select=value`, { headers: sbHeaders(serviceKey) });
    const rows = (await r.json()) as { value?: unknown }[];
    rules = Array.isArray(rows) ? rows[0]?.value : undefined;
  } catch {
    return fail(res, 502, "upstream", "Could not reach the database.");
  }
  if (!rules) return fail(res, 500, "setup", "The safety rules are missing. Run the seed files first.");

  // 4. Decide
  const now = new Date();
  const prepared = batch.prepared_at ? Math.max(0, Math.round((now.getTime() - new Date(batch.prepared_at).getTime()) / 60000)) : null;
  const decision = decide(
    {
      items: (batch.batch_items ?? []).map((i: { category: string }) => ({ category: i.category })),
      preparedMinutesAgo: prepared,
      storedTempC: batch.stored_temp_c === null || batch.stored_temp_c === undefined ? null : Number(batch.stored_temp_c),
      confidence: batch.confidence === null || batch.confidence === undefined ? null : Number(batch.confidence),
      now,
    },
    rules
  );

  const status = decision.outcome === "listed" ? "listed" : decision.outcome;
  const minWindow = rules.dispatch.min_window_minutes_after_match as number;
  let pickupUntil: string | null = batch.pickup_until ?? null;
  if (decision.safeUntil && pickupUntil) {
    const cap = new Date(decision.safeUntil.getTime() - minWindow * 60000);
    if (new Date(pickupUntil) > cap) pickupUntil = cap.toISOString();
  }

  // 5. Save. The status guard makes this safe if two requests arrive together.
  try {
    const patch = await fetch(`${url}/rest/v1/batches?id=eq.${batchId}&status=eq.draft`, {
      method: "PATCH",
      headers: sbHeaders(serviceKey, { Prefer: "return=representation" }),
      body: JSON.stringify({
        status,
        tier: decision.tier,
        safe_until: decision.safeUntil ? decision.safeUntil.toISOString() : null,
        pickup_until: pickupUntil,
        reject_reason: decision.rejectReason,
      }),
    });
    const updated = (await patch.json()) as unknown[];
    if (!patch.ok || !Array.isArray(updated) || updated.length === 0) {
      return res.status(200).json({ ok: true, alreadyScreened: true, outcome: decision.outcome, status, tier: decision.tier, safeUntil: null, safeMinutes: null, reasons: [], rejectReason: null });
    }

    const reasonsJson = decision.reasons.map((r) => ({ code: r.code, text: reasonText(r), params: r.params }));
    await fetch(`${url}/rest/v1/safety_checks`, {
      method: "POST",
      headers: sbHeaders(serviceKey),
      body: JSON.stringify({
        batch_id: batchId,
        rule_set_version: String(rules.version ?? "unknown"),
        tier: decision.tier,
        passed: decision.outcome === "listed",
        confidence: batch.confidence ?? null,
        reasons: reasonsJson,
        decided_by: "agent",
      }),
    });

    const t0 = now.getTime();
    const events: Record<string, unknown>[] = [
      {
        batch_id: batchId, event_type: "safety_check", actor: "agent",
        tone: decision.tier === "red" ? "red" : decision.tier === "amber" ? "amber" : "green",
        title: `Safety check: ${decision.tier}`, detail: reasonText(decision.reasons[0]),
        payload: { tier: decision.tier, rule_set: rules.version, reasons: decision.reasons.map((r) => r.code), outcome: decision.outcome },
        created_at: new Date(t0).toISOString(), is_sample: false,
      },
    ];
    if (decision.outcome === "listed") {
      events.push({
        batch_id: batchId, event_type: "safe_window_set", actor: "agent", tone: "green", title: "Safe window set",
        detail: `Safe for ${hm(decision.safeMinutes ?? 0)} from now`, payload: { safe_until_minutes: decision.safeMinutes },
        created_at: new Date(t0 + 20).toISOString(), is_sample: false,
      });
    } else if (decision.outcome === "rejected") {
      events.push({
        batch_id: batchId, event_type: "rejected", actor: "agent", tone: "red", title: "Batch declined", detail: decision.rejectReason,
        payload: { reason: decision.reasons[0]?.code }, created_at: new Date(t0 + 20).toISOString(), is_sample: false,
      });
    } else {
      events.push({
        batch_id: batchId, event_type: "escalated", actor: "agent", tone: "amber", title: "Sent to coordinator", detail: reasonText(decision.reasons[0]),
        payload: { reason: decision.reasons[0]?.code, safe_until_minutes: decision.safeMinutes }, created_at: new Date(t0 + 20).toISOString(), is_sample: false,
      });
    }
    await fetch(`${url}/rest/v1/agent_events`, { method: "POST", headers: sbHeaders(serviceKey), body: JSON.stringify(events) });
  } catch (err) {
    console.error("screen-batch: could not save the decision", err);
    return fail(res, 502, "upstream", "The decision could not be saved.");
  }

  res.status(200).json({
    ok: true,
    outcome: decision.outcome,
    status,
    tier: decision.tier,
    safeUntil: decision.safeUntil ? decision.safeUntil.toISOString() : null,
    safeMinutes: decision.safeMinutes,
    reasons: decision.reasons,
    rejectReason: decision.rejectReason,
  });
}
