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
