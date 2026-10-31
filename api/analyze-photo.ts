/**
 * POST /api/analyze-photo
 * The vision step of the BARAKAT intake agent.
 *
 * A signed-in restaurant sends one compressed food photo. This function asks Gemini to identify the items
 * (name, category, portions, likely allergens), checks and cleans the answer, stores it in vision_analyses
 * with the service key, and returns it. The restaurant reviews it in the form and confirms before submitting.
 *
 * Server-only environment variables (never prefix these with VITE_):
 *   GEMINI_API_KEY             from Google AI Studio (free tier is enough)
 *   SUPABASE_SERVICE_ROLE_KEY  the project's secret / service_role key
 * It also reads VITE_SUPABASE_URL (or SUPABASE_URL), which the website already uses.
 * Optional: GEMINI_MODEL (default gemini-2.5-flash), GEMINI_FALLBACK_MODEL (default gemini-2.5-flash-lite).
 *
 * This file is deliberately self-contained (no imports) so it deploys the same way everywhere.
 * Keep CATEGORIES in sync with src/config/safetyRules.json.
 */

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Res = { status(code: number): Res; json(body: unknown): void; setHeader(name: string, value: string): void };

export const CATEGORIES = [
  "packaged_sealed", "beverages_sealed", "produce_whole", "bakery_ambient", "cooked_chilled",
  "sandwiches_salads", "dairy_desserts", "raw_meat_fish", "plate_leftovers", "unlabelled_unknown",
] as const;
export const ALLERGENS = ["gluten", "milk", "eggs", "nuts", "peanuts", "sesame", "soy", "fish", "shellfish"] as const;

export type VisionItem = { name: string; category: string; portions: number; allergens: string[]; confidence: number };
export type VisionResult = {
  isFood: boolean;
  confidence: number;
  photoQuality: "good" | "fair" | "poor";
  summary: string;
  items: VisionItem[];
};

const PROMPT = `You are the intake assistant for BARAKAT, a food-rescue service in Dubai that moves surplus food from restaurants to community fridges.
You are shown ONE photo of surplus food that a restaurant wants to donate. Return JSON only.

Rules
- List each distinct food item you can see (at most 6). Use a short, plain English name such as "Chicken biryani trays".
- Choose exactly one category per item:
  packaged_sealed = shop-bought sealed packs or boxes
  beverages_sealed = sealed bottles or cans
  produce_whole = whole fruit or vegetables
  bakery_ambient = bread, pastries and cakes baked and kept at room temperature
  cooked_chilled = cooked meals in trays or boxes
  sandwiches_salads = sandwiches, wraps, salads, cut fruit
  dairy_desserts = puddings, yoghurt, cheesecake, cream desserts
  raw_meat_fish = any raw meat or fish
  plate_leftovers = food that has been served, or is on used plates
  unlabelled_unknown = you cannot tell what it is, or whether it is safe
- Safety first: never assume food is safe. If you are unsure, pick the more cautious category (raw_meat_fish, plate_leftovers or unlabelled_unknown) and lower the confidence.
- portions = your estimate of individual servings, as a whole number from 1 to 500. A full catering tray is usually 15 to 40 servings.
- allergens = only from the allowed list, and only when visually likely (for example bread suggests gluten). These are suggestions; the restaurant must confirm them.
- is_food = false if the photo does not show food. photo_quality = "poor" if it is blurry, dark or crowded.
- confidence is between 0 and 1. Be honest: use a low value when the photo is unclear.
- summary = one short sentence describing what you see.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_food: { type: "BOOLEAN" },
    confidence: { type: "NUMBER" },
    photo_quality: { type: "STRING", enum: ["good", "fair", "poor"] },
    summary: { type: "STRING" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          category: { type: "STRING", enum: [...CATEGORIES] },
          portions: { type: "INTEGER" },
          allergens: { type: "ARRAY", items: { type: "STRING", enum: [...ALLERGENS] } },
          confidence: { type: "NUMBER" },
        },
        required: ["name", "category", "portions", "allergens", "confidence"],
      },
    },
  },
  required: ["is_food", "confidence", "photo_quality", "summary", "items"],
};

const clamp = (n: unknown, lo: number, hi: number, fallback: number) => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.min(hi, Math.max(lo, v));
};

/** Turns whatever the model returned into a safe, predictable shape. Exported so it can be tested. */
export function sanitize(raw: unknown): VisionResult {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const isFood = r.is_food !== false;
  const items: VisionItem[] = [];
  if (isFood && Array.isArray(r.items)) {
    for (const it of r.items.slice(0, 8)) {
      const o = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name.trim().slice(0, 120) : "";
      if (!name) continue;
      const category = (CATEGORIES as readonly string[]).includes(String(o.category)) ? String(o.category) : "unlabelled_unknown";
      const allergens = Array.isArray(o.allergens)
        ? Array.from(new Set(o.allergens.filter((a): a is string => typeof a === "string" && (ALLERGENS as readonly string[]).includes(a))))
        : [];
      items.push({
        name,
        category,
        portions: Math.round(clamp(o.portions, 1, 500, 1)),
        allergens,
        confidence: Math.round(clamp(o.confidence, 0, 1, 0.5) * 100) / 100,
      });
    }
  }
  const quality = r.photo_quality === "good" || r.photo_quality === "fair" || r.photo_quality === "poor" ? r.photo_quality : "fair";
  let confidence = Math.round(clamp(r.confidence, 0, 1, 0.5) * 100) / 100;
  if (isFood && items.length === 0) confidence = Math.min(confidence, 0.3);
  return {
    isFood,
    confidence,
    photoQuality: quality,
    summary: typeof r.summary === "string" ? r.summary.trim().slice(0, 300) : "",
    items,
  };
}

function fail(res: Res, status: number, code: string, message: string) {
  res.status(status).json({ ok: false, code, message });
}

function sbHeaders(key: string, extra: Record<string, string> = {}): Record<string, string> {
  // Legacy service_role keys are JWTs and also go in Authorization. New secret keys go in apikey only.
  return { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", ...extra };
}

async function callGemini(model: string, apiKey: string, mime: string, b64: string): Promise<{ status: number; json: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: PROMPT }, { inline_data: { mime_type: mime, data: b64 } }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 2048,
        },
      }),
    });
    let json: any = null;
    try {
      json = await r.json();
    } catch {
      json = null;
    }
    return { status: r.status, json };
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: Req, res: Res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return fail(res, 405, "bad_request", "Use POST.");

  const env = ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}) as Record<string, string | undefined>;
  const geminiKey = env.GEMINI_API_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  if (!geminiKey || !serviceKey || !supabaseUrl) {
    return fail(res, 503, "not_configured", "The server is missing GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY or the Supabase URL.");
  }

  // 1. Who is asking? (Check the signed-in user's token with Supabase.)
  const authHeader = String(req.headers["authorization"] ?? req.headers["Authorization"] ?? "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return fail(res, 401, "unauthorized", "Please sign in.");
  let userId = "";
  try {
    const u = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${token}` } });
    if (!u.ok) return fail(res, 401, "unauthorized", "Your session is not valid. Please sign in again.");
    userId = String(((await u.json()) as { id?: string }).id ?? "");
  } catch {
    return fail(res, 502, "upstream", "Could not reach the database.");
  }
  if (!userId) return fail(res, 401, "unauthorized", "Please sign in.");

  // 2. Only restaurants with a venue may use it.
  let restaurantId: string | null = null;
  try {
    const p = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role,restaurant_id`, { headers: sbHeaders(serviceKey) });
    const rows = (await p.json()) as { role?: string; restaurant_id?: string | null }[];
    const profile = Array.isArray(rows) ? rows[0] : undefined;
    if (!profile || profile.role !== "restaurant" || !profile.restaurant_id) {
      return fail(res, 403, "forbidden", "Only a restaurant account with a venue can analyse photos.");
    }
    restaurantId = profile.restaurant_id;
  } catch {
    return fail(res, 502, "upstream", "Could not reach the database.");
  }

  // 3. Check the request body.
  let body: Record<string, unknown> = {};
  try {
    body = (typeof req.body === "string" ? JSON.parse(req.body) : (req.body as Record<string, unknown>)) ?? {};
  } catch {
    return fail(res, 400, "bad_request", "The request body must be JSON.");
  }
  const mime = String(body.mimeType ?? "image/jpeg");
  const b64 = typeof body.imageBase64 === "string" ? body.imageBase64.replace(/^data:[^,]*,/, "") : "";
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime) || b64.length < 100) {
    return fail(res, 400, "bad_request", "Send a JPEG, PNG or WebP photo as base64.");
  }
  if (b64.length > 3_400_000) return fail(res, 413, "too_large", "The photo is too large.");

  // 4. A simple limit: 30 analyses per user per hour.
  try {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const c = await fetch(`${supabaseUrl}/rest/v1/vision_analyses?select=id&user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(since)}&limit=60`, { headers: sbHeaders(serviceKey) });
    const recent = (await c.json()) as unknown[];
    if (Array.isArray(recent) && recent.length >= 30) return fail(res, 429, "rate_limited", "Too many analyses. Please wait a few minutes.");
  } catch {
    /* if the check fails, carry on; Gemini's own limits still apply */
  }

  // 5. Ask Gemini (primary model first, then a lighter fallback if it is busy or unavailable).
  const models = [env.GEMINI_MODEL || "gemini-2.5-flash", env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite"];
  let parsed: unknown = null;
  let usedModel = "";
  let lastStatus = 0;
  let blocked = false;
  for (const model of models) {
    try {
      const { status, json } = await callGemini(model, geminiKey, mime, b64);
      lastStatus = status;
      if (status === 200) {
        if (json?.promptFeedback?.blockReason) {
          blocked = true;
          break;
        }
        const text = (json?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("").trim();
        const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
        parsed = cleaned ? JSON.parse(cleaned) : null;
        if (parsed) {
          usedModel = model;
          break;
        }
      }
    } catch {
      lastStatus = 0;
    }
  }
  if (blocked) return fail(res, 422, "blocked", "The photo could not be analysed.");
  if (!parsed) {
    return fail(res, lastStatus === 429 ? 429 : 502, lastStatus === 429 ? "rate_limited" : "upstream", "The AI service did not return a usable answer.");
  }

  const result = sanitize(parsed);

  // 6. Save the analysis (so the batch can point at it later) and answer.
  let analysisId: string | null = null;
  try {
    const ins = await fetch(`${supabaseUrl}/rest/v1/vision_analyses`, {
      method: "POST",
      headers: sbHeaders(serviceKey, { Prefer: "return=representation" }),
      body: JSON.stringify({ user_id: userId, restaurant_id: restaurantId, model: usedModel, confidence: result.confidence, result }),
    });
    const rows = (await ins.json()) as { id?: string }[];
    analysisId = Array.isArray(rows) && rows[0]?.id ? rows[0].id : null;
  } catch {
    analysisId = null;
  }
  if (!analysisId) return fail(res, 502, "upstream", "The analysis could not be saved. Run supabase/10_vision.sql first.");

  res.status(200).json({ ok: true, analysisId, model: usedModel, result });
}
