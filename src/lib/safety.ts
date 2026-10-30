import rulesJson from "../config/safetyRules.json";

/**
 * Pure screening logic shared by the form's live preview now, and by the server-side agent later.
 * It only reads safetyRules.json. Thresholds there are placeholders until validated with Dubai Municipality.
 */
export type Tier = "green" | "amber" | "red";

export type ScreenItem = { category: string; portions?: number };
export type ScreenInput = {
  items: ScreenItem[];
  /** minutes since the food was prepared, or null when not given */
  preparedMinutesAgo: number | null;
  storedTempC: number | null;
  now?: Date;
};

export type Reason = { code: string; params?: Record<string, string | number> };
export type Screening = {
  tier: Tier;
  reasons: Reason[];
  /** things the restaurant still has to fill in */
  missing: ("items" | "prepared_at" | "stored_temp_c")[];
  safeUntil: Date | null;
  safeMinutes: number | null;
};

type Rules = typeof rulesJson;
const SEVERITY: Record<Tier, number> = { green: 0, amber: 1, red: 2 };
/** Categories whose clock starts at preparation time rather than at listing time. */
const PREP_CLOCK = new Set(["cooked_chilled", "sandwiches_salads", "dairy_desserts", "bakery_ambient"]);
const NEEDS_PREP = new Set(["cooked_chilled", "sandwiches_salads", "dairy_desserts"]);

export function categoryTier(category: string, rules: Rules = rulesJson): Tier {
  return ((rules.categories as Record<string, { tier: Tier }>)[category]?.tier ?? "red") as Tier;
}

export function categoryStorage(category: string, rules: Rules = rulesJson): "ambient" | "chilled" {
  return ((rules.categories as Record<string, { storage: string }>)[category]?.storage ?? "ambient") as "ambient" | "chilled";
}

export function screenBatch(input: ScreenInput, rules: Rules = rulesJson): Screening {
  const cats = rules.categories as Record<string, { tier: Tier; storage: string; max_safe_hours: number }>;
  const now = input.now ?? new Date();
  const reasons: Reason[] = [];
  const missing: Screening["missing"] = [];

  if (input.items.length === 0) {
    return { tier: "green", reasons: [{ code: "no_items" }], missing: ["items"], safeUntil: null, safeMinutes: null };
  }

  let tier: Tier = "green";
  for (const it of input.items) {
    const t = categoryTier(it.category, rules);
    if (SEVERITY[t] > SEVERITY[tier]) tier = t;
  }

  for (const it of input.items) {
    if (!(rules.categories as Record<string, unknown>)[it.category]) reasons.push({ code: "unknown_category" });
  }

  // Hard stops
  const hardStops = rules.hard_stops as { code: string; category?: string }[];
  for (const hs of hardStops) {
    if (hs.category && input.items.some((it) => it.category === hs.category)) {
      reasons.push({ code: hs.code });
    }
  }

  const hasChilled = input.items.some((it) => categoryStorage(it.category, rules) === "chilled" && cats[it.category]?.tier !== "red");
  const max = rules.temperature_c.chilled_max;
  if (hasChilled) {
    if (input.storedTempC === null) {
      missing.push("stored_temp_c");
    } else if (input.storedTempC > max) {
      tier = "red";
      reasons.push({ code: "temp_above_limit", params: { max, temp: input.storedTempC } });
    }
  }
  if (input.items.some((it) => NEEDS_PREP.has(it.category)) && input.preparedMinutesAgo === null) {
    missing.push("prepared_at");
  }

  if (tier === "red") {
    return { tier, reasons, missing, safeUntil: null, safeMinutes: null };
  }

  // Safe window: earliest expiry across items
  let earliest = Infinity;
  for (const it of input.items) {
    const hours = cats[it.category]?.max_safe_hours ?? 0;
    const startMs =
      PREP_CLOCK.has(it.category) && input.preparedMinutesAgo !== null
        ? now.getTime() - input.preparedMinutesAgo * 60000
        : now.getTime();
    earliest = Math.min(earliest, startMs + hours * 3600000);
  }
  const safeMinutes = Math.max(0, Math.floor((earliest - now.getTime()) / 60000));
  const minWindow = rules.dispatch.min_window_minutes_after_match;
  if (safeMinutes < minWindow) {
    // Not enough safe time left for a volunteer to collect and deliver it.
    reasons.push({ code: "window_too_short", params: { minutes: safeMinutes, min: minWindow } });
    return { tier: "red", reasons, missing, safeUntil: new Date(earliest), safeMinutes };
  }
  reasons.push({ code: tier === "amber" ? "amber_conditions" : "sealed_or_whole" });

  return { tier, reasons, missing, safeUntil: new Date(earliest), safeMinutes };
}
