/** Impact maths for the Impact page and the printable report. */
export type ImpactLike = { createdAt: string; meals: number; kg: number; co2eKg: number; points: number };
export type Range = "30" | "90" | "all";
export type Metric = "meals" | "kg" | "co2e";

export function totals(rows: ImpactLike[]) {
  let meals = 0, kg = 0, co2e = 0, points = 0;
  for (const r of rows) {
    meals += r.meals;
    kg += r.kg;
    co2e += r.co2eKg;
    points += r.points;
  }
  return { meals, kg: Math.round(kg * 10) / 10, co2e: Math.round(co2e * 10) / 10, points, count: rows.length };
}

export function inRange<T extends ImpactLike>(rows: T[], range: Range, nowMs: number): T[] {
  if (range === "all") return rows;
  const from = nowMs - Number(range) * 86400_000;
  return rows.filter((r) => new Date(r.createdAt).getTime() >= from);
}

export type Bucket = { start: number; value: number };

/** `weeks` consecutive 7-day buckets ending now, oldest first. */
export function weeklyBuckets(rows: ImpactLike[], nowMs: number, weeks: number, metric: Metric): Bucket[] {
  const week = 7 * 86400_000;
  const out: Bucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) out.push({ start: nowMs - (i + 1) * week, value: 0 });
  for (const r of rows) {
    const t = new Date(r.createdAt).getTime();
    const age = nowMs - t;
    if (age < 0 || age >= weeks * week) continue;
    const idx = weeks - 1 - Math.floor(age / week);
    out[idx].value += metric === "meals" ? r.meals : metric === "kg" ? r.kg : r.co2eKg;
  }
  return out.map((b) => ({ ...b, value: Math.round(b.value * 10) / 10 }));
}
