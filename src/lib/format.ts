import type { Lang } from "../i18n/translations";

const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
export const fmtNumber = (n: number) => nf.format(n);

/** "5 minutes ago", "in 2 hours" ... with Western digits in both languages. */
export function timeAgo(iso: string, lang: Lang): string {
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(lang === "ar" ? "ar-u-nu-latn" : "en", { numeric: "auto" });
  const abs = Math.abs(diffMin);
  if (abs < 60) return rtf.format(diffMin, "minute");
  if (abs < 1440) return rtf.format(Math.round(diffMin / 60), "hour");
  return rtf.format(Math.round(diffMin / 1440), "day");
}

/** HH:MM:SS from a number of milliseconds (never negative). */
export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

/** "5h 20m" in English, "5 س 20 د" in Arabic. */
export function fmtMinutes(total: number, lang: Lang): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (lang === "ar") return h > 0 ? `${h} س ${m} د` : `${m} د`;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`;
}

/** Clock time in Dubai (UTC+4), 24-hour. */
export function fmtDubaiTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dubai" }).format(date);
}

/** Replaces {name} placeholders. */
export function fill(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}
