/**
 * POST /api/health  (coordinators only)
 * Reports whether BARAKAT is set up correctly: server keys present, database tables and settings in place,
 * photo storage ready, and the scheduler running. It never returns a secret value, only yes or no.
 *
 * Deliberately self-contained (no imports), like the other functions.
 */
type Req = { method?: string; headers: Record<string, string | string[] | undefined> };
type Res = { status(code: number): Res; json(body: unknown): void; setHeader(name: string, value: string): void };
type Check = { id: string; ok: boolean; detail?: string };

function fail(res: Res, status: number, code: string, message: string) {
  res.status(status).json({ ok: false, code, message });
}

export default async function handler(req: Req, res: Res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST" && req.method !== "GET") return fail(res, 405, "bad_request", "Use POST.");
  const env = ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}) as Record<string, string | undefined>;
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return fail(res, 503, "not_configured", "The server is missing SUPABASE_SERVICE_ROLE_KEY or the Supabase URL.");

  const authHeader = String(req.headers["authorization"] ?? req.headers["Authorization"] ?? "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return fail(res, 401, "unauthorized", "Please sign in.");
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  try {
    const u = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
    if (!u.ok) return fail(res, 401, "unauthorized", "Your session is not valid. Please sign in again.");
    const userId = String(((await u.json()) as { id?: string }).id ?? "");
    const pr = await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role`, { headers });
    const role = ((await pr.json()) as { role?: string }[])[0]?.role;
    if (role !== "coordinator") return fail(res, 403, "forbidden", "Only a coordinator can run the system check.");
  } catch {
    return fail(res, 502, "upstream", "Could not reach the database.");
  }

  const checks: Check[] = [
    { id: "env_supabase_url", ok: !!url },
    { id: "env_service_key", ok: !!key },
    { id: "env_gemini", ok: !!env.GEMINI_API_KEY },
    { id: "env_cron_secret", ok: !!env.CRON_SECRET },
  ];

  /** A GET that must succeed; reports the database's own message when it does not. */
  const probe = async (id: string, path: string, test?: (rows: any[]) => string | true): Promise<void> => {
    try {
      const r = await fetch(`${url}/rest/v1/${path}`, { headers });
      const body = (await r.json().catch(() => null)) as any;
      if (!r.ok) return void checks.push({ id, ok: false, detail: String(body?.message ?? `HTTP ${r.status}`).slice(0, 140) });
      const verdict = test ? test(Array.isArray(body) ? body : []) : true;
      checks.push(verdict === true ? { id, ok: true } : { id, ok: false, detail: verdict });
    } catch {
      checks.push({ id, ok: false, detail: "Could not reach the database." });
    }
  };

  await probe("db_rules", "app_config?key=eq.safety_rules&select=value", (rows) => {
    const v = rows[0]?.value;
    return v && v.categories && v.categories.packaged_chilled ? true : "Rules missing or out of date (run 13 and 14).";
  });
  await probe("db_factors", "app_config?key=eq.impact_factors&select=value", (rows) => (rows[0]?.value?.sources ? true : "Factors missing or not sourced (run 14)."));
  await probe("db_demo_mode", "app_config?key=eq.demo_mode&select=value", (rows) => (rows[0] ? true : "Setting missing (run 14)."));
  await probe("db_seed", "fridges?select=id&limit=1", (rows) => (rows.length > 0 ? true : "No fridges found (run the seed files)."));
  await probe("db_dispatch", "fridges?select=reserved_portions&limit=1");
  await probe("db_review_flag", "batches?select=review_requested&limit=1");
  await probe("db_vision", "vision_analyses?select=id&limit=1");

  try {
    const r = await fetch(`${url}/storage/v1/bucket/surplus-photos`, { headers });
    checks.push(r.ok ? { id: "storage_bucket", ok: true } : { id: "storage_bucket", ok: false, detail: `HTTP ${r.status}` });
  } catch {
    checks.push({ id: "storage_bucket", ok: false, detail: "Could not reach storage." });
  }

  await probe("scheduler", "app_config?key=eq.last_cron_tick&select=value", (rows) => {
    const at = rows[0]?.value?.at;
    if (!at) return "The scheduler has not run yet.";
    const minutes = Math.round((Date.now() - new Date(at).getTime()) / 60000);
    return minutes <= 6 ? true : `Last run ${minutes} minutes ago.`;
  });

  const withTime = (id: string) => checks.find((c) => c.id === id);
  const sched = withTime("scheduler");
  if (sched && sched.ok) {
    try {
      const r = await fetch(`${url}/rest/v1/app_config?key=eq.last_cron_tick&select=value`, { headers });
      const at = ((await r.json()) as any[])[0]?.value?.at;
      if (at) sched.detail = `Last run ${Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 60000))} minutes ago.`;
    } catch {
      /* the check itself already passed */
    }
  }

  res.status(200).json({ ok: true, checks, serverNow: new Date().toISOString() });
}
