import type { BatchEvent } from "../data/batches";
import { useLang } from "../i18n/LanguageContext";
import { fmtDubaiTime } from "../lib/format";

const toneDot: Record<string, string> = { neutral: "bg-subtle", green: "bg-primary", amber: "bg-amber", red: "bg-danger" };

/** A batch's activity timeline. Titles are translated; details are stored in English, so they show in English only. */
export function EventList({ events }: { events: BatchEvent[] }) {
  const { t, lang } = useLang();
  const B = t.batches;
  if (events.length === 0) return <p className="text-[12px] text-muted-foreground">{B.noActivity}</p>;
  return (
    <>
      <ol className="flex flex-col gap-3.5">
        {events.map((e, i) => (
          <li key={`${e.type}-${i}`} className="flex items-start gap-3">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${toneDot[e.tone] ?? "bg-subtle"}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-foreground">{B.eventTitles[e.type] ?? e.title}</p>
              {lang === "en" && e.detail && <p className="text-[12px] font-light leading-[1.6] text-muted-foreground">{e.detail}</p>}
            </div>
            <span className="shrink-0 font-mono-label text-[10px] text-muted-foreground"><bdi>{fmtDubaiTime(new Date(e.createdAt))}</bdi></span>
          </li>
        ))}
      </ol>
      {lang === "ar" && B.detailNote && <p className="mt-4 text-[11px] font-light text-muted-foreground">{B.detailNote}</p>}
    </>
  );
}
