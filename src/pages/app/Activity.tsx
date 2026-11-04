import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { PipelineBar } from "../../components/PipelineBar";
import { listFeed, loadStats, subscribeFeed, type ActivityStats, type FeedEvent } from "../../data/activity";
import { useLang } from "../../i18n/LanguageContext";
import { fmtDubaiTime, fmtNumber, timeAgo } from "../../lib/format";

const toneDot: Record<string, string> = { neutral: "bg-subtle", green: "bg-primary", amber: "bg-amber", red: "bg-danger" };
const actorStyle: Record<string, string> = {
  agent: "bg-primary-light text-primary",
  volunteer: "bg-sky-100 text-sky-700",
  restaurant: "bg-amber-light text-amber",
  coordinator: "bg-purple-100 text-purple-700",
  system: "bg-surface-raised text-muted-foreground",
};

export default function Activity() {
  const { t, lang } = useLang();
  const A = t.activity;
  const { user } = useAuth();
  const [includeSample, setIncludeSample] = useState(true);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [feed, setFeed] = useState<FeedEvent[] | null>(null);
  const [error, setError] = useState(false);
  const [live, setLive] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const [s, f] = await Promise.all([loadStats(includeSample), listFeed(includeSample, 60)]);
      setStats(s);
      setFeed(f);
      setError(false);
    } catch (err) {
      console.error(err);
      setError(true);
    }
  }, [includeSample]);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15000);
    // New events arrive instantly when realtime is available; the 15 second refresh is the safety net.
    const stop = subscribeFeed(() => {
      setLive(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void load(), 800);
    });
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(timer.current);
      stop();
    };
  }, [load]);

  if (!user) return null;

  const kpis = [
    { ...A.kpis[0], value: stats ? fmtNumber(stats.decisions24h) : "…" },
    { ...A.kpis[1], value: stats ? (stats.automationRate === null ? "—" : `${stats.automationRate}%`) : "…" },
    { ...A.kpis[2], value: stats ? (stats.medianMatchMin === null ? "—" : `${fmtNumber(stats.medianMatchMin)} ${A.minutes}`) : "…" },
    { ...A.kpis[3], value: stats ? fmtNumber(stats.openEscalations) : "…" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-[28px] font-extrabold tracking-[-0.04em]">
            {A.title}
            {live && <span className="rounded-full bg-primary-light px-2.5 py-1 font-mono-label text-[10px] font-semibold uppercase text-primary">{A.live}</span>}
          </h1>
          <p className="mt-2 max-w-[640px] text-[14px] font-light leading-[1.8] text-muted-foreground">{A.sub}</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-muted-foreground">
          <input type="checkbox" checked={includeSample} onChange={(e) => setIncludeSample(e.target.checked)} className="h-4 w-4 accent-[hsl(140_55%_38%)]" />
          {A.includeSample}
        </label>
      </div>

      {error && <p role="alert" className="mt-5 text-[13px] text-danger">{A.loadError}</p>}

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <div key={k.label} className={`rounded-[14px] border-[1.5px] bg-white p-5 ${i === 3 && stats && stats.openEscalations > 0 ? "border-amber" : "border-border"}`}>
            <p className="text-[12px] font-medium text-muted-foreground">{k.label}</p>
            <p className={`mt-3 text-[30px] font-extrabold tracking-[-0.04em] ${i === 3 && stats && stats.openEscalations > 0 ? "text-amber" : "text-foreground"}`}><bdi>{k.value}</bdi></p>
            <p className="mt-1 text-[11px] font-light text-muted-foreground">
              {k.note}
              {i === 3 && <> · <Link to="/app/review" className="font-semibold text-primary">{t.app.nav.review}</Link></>}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-[15px] font-bold">{A.pipelineTitle}</h2>
        {stats && <PipelineBar pipeline={stats.pipeline} />}
      </section>

      <section className="mt-8 rounded-[14px] border-[1.5px] border-border bg-white p-5">
        <h2 className="text-[15px] font-bold">{A.feedTitle}</h2>
        {feed && feed.length === 0 && <p className="mt-3 text-[13px] text-muted-foreground">{A.empty}</p>}
        <ol className="mt-4 flex flex-col">
          {(feed ?? []).map((e) => (
            <li key={e.id} className="flex items-start gap-3 border-b border-border/70 py-3 last:border-0">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${toneDot[e.tone] ?? "bg-subtle"}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="font-semibold text-foreground">{t.batches.eventTitles[e.type] ?? e.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${actorStyle[e.actor] ?? actorStyle.system}`}>{A.actors[e.actor] ?? e.actor}</span>
                  {e.isSample && <span className="rounded bg-surface-raised px-1.5 py-0.5 font-mono-label text-[9px] text-muted-foreground">{A.sample}</span>}
                </p>
                {(e.restaurantName || e.firstItem) && (
                  <p className="text-[11px] font-light text-muted-foreground">{[e.restaurantName, e.firstItem].filter(Boolean).join(" · ")}</p>
                )}
                {lang === "en" && e.detail && <p className="mt-0.5 text-[12px] font-light leading-[1.6] text-muted-foreground">{e.detail}</p>}
              </div>
              <div className="shrink-0 text-end">
                <p className="font-mono-label text-[10px] text-foreground"><bdi>{fmtDubaiTime(new Date(e.createdAt))}</bdi></p>
                <p className="text-[10px] font-light text-muted-foreground">{timeAgo(e.createdAt, lang)}</p>
              </div>
            </li>
          ))}
        </ol>
        {lang === "ar" && t.batches.detailNote && <p className="mt-4 text-[11px] font-light text-muted-foreground">{t.batches.detailNote}</p>}
      </section>
    </>
  );
}
