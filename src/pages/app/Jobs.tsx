import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, MapPin, Store } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { FoodArt } from "../../components/FoodArt";
import { SafeClock } from "../../components/SafeClock";
import rules from "../../config/safetyRules.json";
import { advanceTrip, answerOffer, type DispatchFail } from "../../data/dispatch";
import { listMyJobs, type MyJob } from "../../data/jobs";
import type { Tier } from "../../data/types";
import { useLang } from "../../i18n/LanguageContext";
import { fill, fmtClock, timeAgo } from "../../lib/format";
import { useNow } from "../../lib/useNow";

const tierIndex: Record<Tier, number> = { green: 0, amber: 1, red: 2 };
const tierStyle: Record<Tier, string> = { green: "bg-primary-light text-primary", amber: "bg-amber-light text-amber", red: "bg-danger-light text-danger" };
const statusTone: Record<string, string> = {
  offered: "text-amber", accepted: "text-primary", picked_up: "text-primary", delivered: "text-primary",
  declined: "text-muted-foreground", timed_out: "text-muted-foreground", cancelled: "text-danger",
};

function OfferTimer({ expiresAt }: { expiresAt: string }) {
  const now = useNow(1000);
  const { t } = useLang();
  const left = new Date(expiresAt).getTime() - now;
  return (
    <span className={`font-semibold ${left < 60000 ? "text-danger" : "text-foreground"}`}>
      {left > 0 ? <bdi>{fmtClock(left).slice(3)}</bdi> : t.jobs.expired}
    </span>
  );
}

export default function Jobs() {
  const { t, lang } = useLang();
  const J = t.jobs;
  const { user } = useAuth();
  const [jobs, setJobs] = useState<MyJob[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const now = useNow(5000);

  const load = useCallback(() => {
    if (!user) return Promise.resolve();
    return listMyJobs(user)
      .then((list) => {
        setJobs(list);
        setError(false);
      })
      .catch((err) => {
        console.error(err);
        setError(true);
      });
  }, [user?.id, user?.volunteerId, user?.mode]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 8000);
    return () => window.clearInterval(id);
  }, [load]);

  if (!user) return null;
  const categoryLabel = (key: string) => (rules.categories as Record<string, { label: { en: string; ar: string } }>)[key]?.label[lang] ?? key;

  const act = async (jobId: string, run: () => Promise<{ ok: true } | { ok: false; code: DispatchFail }>) => {
    setBusy(jobId);
    setMessage(null);
    const r = await run();
    setBusy(null);
    if (!r.ok) setMessage(J.errors[r.code] ?? J.errors.upstream);
    await load();
  };

  const isOpenOffer = (j: MyJob) => j.status === "offered" && (!j.expiresAt || new Date(j.expiresAt).getTime() > now);
  const offers = (jobs ?? []).filter(isOpenOffer);
  const active = (jobs ?? []).filter((j) => j.status === "accepted" || j.status === "picked_up");
  const history = (jobs ?? []).filter((j) => !isOpenOffer(j) && j.status !== "accepted" && j.status !== "picked_up").slice(0, 10);

  const Card = ({ job, mode }: { job: MyJob; mode: "offer" | "active" }) => {
    const first = job.batch?.items[0];
    return (
      <article className={`rounded-[14px] border-[1.5px] bg-white p-4 ${mode === "offer" ? "border-primary" : "border-border"}`}>
        <div className="flex flex-wrap gap-4">
          <div className="h-[84px] w-28 shrink-0 overflow-hidden rounded-lg bg-surface-raised">
            <FoodArt name={first?.name} category={first?.category} className="h-full w-full" />
          </div>
          <div className="min-w-[220px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[14px] font-semibold text-foreground">
                {first?.name ?? "—"}
                {job.batch && job.batch.items.length > 1 && <span className="font-light text-muted-foreground"> +{job.batch.items.length - 1}</span>}
              </p>
              {job.batch?.tier && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tierStyle[job.batch.tier]}`}>{t.safety.cards[tierIndex[job.batch.tier]].name}</span>}
            </div>
            <p className="mt-0.5 text-[12px] font-light text-muted-foreground">
              {first ? categoryLabel(first.category) : ""} · <bdi>{job.batch?.portions ?? 0}</bdi> {t.app.overview.portions}
            </p>
            <div className="mt-3 flex flex-col gap-1.5 text-[12px]">
              <p className="flex items-start gap-2 text-foreground">
                <Store size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                <span><span className="font-medium text-muted-foreground">{J.pickupFrom}</span> {job.batch?.restaurant?.name} <span className="font-light text-muted-foreground">· {job.batch?.restaurant?.area}</span></span>
              </p>
              <p className="flex items-start gap-2 text-foreground">
                <MapPin size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                <span><span className="font-medium text-muted-foreground">{J.deliverTo}</span> {job.fridge ? `${job.fridge.code} ${job.fridge.name}` : "—"}{job.distanceKm !== null && <span className="font-light text-muted-foreground"> · <bdi>{job.distanceKm}</bdi> {J.kmShort}</span>}</span>
              </p>
              {job.pickupEtaMin !== null && mode === "offer" && <p className="font-light text-muted-foreground">{fill(J.eta, { n: job.pickupEtaMin })}</p>}
              {job.batch?.notes && <p className="font-light italic text-muted-foreground">{job.batch.notes}</p>}
            </div>
            {job.batch?.safeUntil && (
              <div className="mt-3 max-w-[300px]">
                <SafeClock safeUntil={job.batch.safeUntil} startedAt={job.offeredAt} />
              </div>
            )}
          </div>

          <div className="flex min-w-[170px] flex-col justify-between gap-3">
            {mode === "offer" && job.expiresAt && (
              <p className="text-[12px] text-muted-foreground">{J.respondIn} <OfferTimer expiresAt={job.expiresAt} /></p>
            )}
            {mode === "offer" ? (
              <div className="flex gap-2">
                <button type="button" disabled={busy === job.id} onClick={() => void act(job.id, () => answerOffer(job.id, true))} className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60">
                  {busy === job.id ? J.saving : J.accept}
                </button>
                <button type="button" disabled={busy === job.id} onClick={() => void act(job.id, () => answerOffer(job.id, false))} className="rounded-lg border border-border px-4 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:border-foreground disabled:opacity-60">
                  {J.decline}
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy === job.id}
                onClick={() => void act(job.id, () => advanceTrip(job.id, job.status === "accepted" ? "picked_up" : "delivered"))}
                className="rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
              >
                {busy === job.id ? J.saving : job.status === "accepted" ? J.pickedUp : J.delivered}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <>
      <h1 className="text-[28px] font-extrabold tracking-[-0.04em]">{J.title}</h1>
      <p className="mt-2 max-w-[600px] text-[14px] font-light leading-[1.8] text-muted-foreground">{J.sub}</p>
      {user.mode === "local" && <p className="mt-5 rounded-lg bg-amber-light px-4 py-3 text-[13px] text-amber">{J.errors.local}</p>}
      {error && <p role="alert" className="mt-5 text-[13px] text-danger">{J.loadError}</p>}
      {message && <p role="alert" className="mt-5 rounded-lg bg-danger-light px-4 py-3 text-[13px] text-danger">{message}</p>}

      <section className="mt-8">
        <h2 className="text-[15px] font-bold">{J.offersTitle}</h2>
        {jobs && offers.length === 0 && <p className="mt-3 rounded-[14px] border-[1.5px] border-dashed border-primary-muted bg-white p-5 text-[13px] text-muted-foreground">{J.noOffers}</p>}
        <div className="mt-3 flex flex-col gap-3">{offers.map((j) => <Card key={j.id} job={j} mode="offer" />)}</div>
      </section>

      <section className="mt-8">
        <h2 className="text-[15px] font-bold">{J.activeTitle}</h2>
        {jobs && active.length === 0 && <p className="mt-3 text-[13px] text-muted-foreground">{J.noActive}</p>}
        <div className="mt-3 flex flex-col gap-3">{active.map((j) => <Card key={j.id} job={j} mode="active" />)}</div>
      </section>

      <section className="mt-8">
        <h2 className="text-[15px] font-bold">{J.historyTitle}</h2>
        {jobs && history.length === 0 && <p className="mt-3 text-[13px] text-muted-foreground">{J.noHistory}</p>}
        <ul className="mt-3 flex flex-col gap-2">
          {history.map((j) => (
            <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 text-[12px]">
              <span className="text-foreground">
                <span className="font-semibold">{j.batch?.restaurant?.name ?? "—"}</span>
                <span className="inline-flex items-center gap-1.5 font-light text-muted-foreground"> <ArrowRight size={12} className="rtl-flip" aria-hidden="true" /> {j.fridge?.code ?? "—"} · <bdi>{j.batch?.portions ?? 0}</bdi> {t.app.overview.portions}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1 font-medium ${statusTone[j.status] ?? "text-foreground"}`}>
                  {j.status === "delivered" && <Check size={12} strokeWidth={3} aria-hidden="true" />}
                  {J.statuses[j.status] ?? j.status}
                </span>
                <span className="text-muted-foreground">{timeAgo(j.offeredAt, lang)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-8 text-[11px] font-light text-muted-foreground">
        <Link to="/app" className="hover:text-foreground">{t.app.soon.back}</Link>
      </p>
    </>
  );
}
