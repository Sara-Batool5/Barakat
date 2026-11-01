import { fmtClock, fmtMinutes } from "../lib/format";
import { useNow } from "../lib/useNow";
import { useLang } from "../i18n/LanguageContext";

/** The safe-window clock: how long the food stays safe, as a live countdown and a bar that drains. */
export function SafeClock({ safeUntil, startedAt }: { safeUntil: string; startedAt: string }) {
  const { t, lang } = useLang();
  const now = useNow(1000);
  const end = new Date(safeUntil).getTime();
  const start = new Date(startedAt).getTime();
  const left = end - now;
  const share = Math.max(0, Math.min(1, left / Math.max(1, end - start)));
  const expired = left <= 0;
  const tone = expired ? "bg-danger" : share > 0.5 ? "bg-primary" : share > 0.2 ? "bg-amber" : "bg-danger";
  const text = expired ? t.batches.clock.expired : left >= 3600000 ? fmtMinutes(Math.floor(left / 60000), lang) : fmtClock(left).slice(3);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[11px]">
        <span className="font-medium text-muted-foreground">{t.batches.clock.title}</span>
        <span className={`font-semibold ${expired ? "text-danger" : "text-foreground"}`}>
          <bdi>{text}</bdi> {!expired && <span className="font-light text-muted-foreground">{t.batches.clock.left}</span>}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-raised" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} aria-label={t.batches.clock.title}>
        <div className={`h-full rounded-full transition-[width] duration-1000 ${tone}`} style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}
