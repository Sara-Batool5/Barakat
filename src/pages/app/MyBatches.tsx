import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { FoodArt } from "../../components/FoodArt";
import { SafeClock } from "../../components/SafeClock";
import { runSafetyCheck } from "../../data/screen";
import rules from "../../config/safetyRules.json";
import { listMyBatches, loadBatchEvents, type BatchEvent, type MyBatch } from "../../data/batches";
import type { Tier } from "../../data/types";
import { useLang } from "../../i18n/LanguageContext";
import { fmtDubaiTime, timeAgo } from "../../lib/format";

const tierIndex: Record<Tier, number> = { green: 0, amber: 1, red: 2 };
const tierStyle: Record<Tier, string> = {
  green: "bg-primary-light text-primary",
  amber: "bg-amber-light text-amber",
  red: "bg-danger-light text-danger",
};
const toneDot: Record<string, string> = { neutral: "bg-subtle", green: "bg-primary", amber: "bg-amber", red: "bg-danger" };

function statusStyle(status: string): string {
  if (status === "closed" || status === "delivered") return "text-primary";
  if (status === "rejected" || status === "expired") return "text-danger";
  if (status === "escalated") return "text-amber";
  return "text-foreground";
}

export default function MyBatches() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const B = t.batches;
  const [state, setState] = useState<{ loading: boolean; batches: MyBatch[]; error: boolean }>({ loading: true, batches: [], error: false });
  const [openId, setOpenId] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [checkState, setCheckState] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<Record<string, BatchEvent[] | "loading" | "error">>({});

  useEffect(() => {
    if (!user) return;
    let alive = true;
    listMyBatches(user)
      .then((batches) => alive && setState({ loading: false, batches, error: false }))
      .catch((err) => {
        console.error(err);
        if (alive) setState({ loading: false, batches: [], error: true });
      });
    return () => {
      alive = false;
    };
  }, [user?.id, user?.restaurantId, user?.mode, reload]);

  if (!user) return null;

  const toggle = (id: string) => {
    if (openId === id) return setOpenId(null);
    setOpenId(id);
    if (!events[id]) {
      setEvents((cur) => ({ ...cur, [id]: "loading" }));
      loadBatchEvents(user, id)
        .then((list) => setEvents((cur) => ({ ...cur, [id]: list })))
        .catch(() => setEvents((cur) => ({ ...cur, [id]: "error" })));
    }
  };

  const runCheck = async (id: string) => {
    setCheckState((cur) => ({ ...cur, [id]: "running" }));
    const r = await runSafetyCheck(id);
    if (r.ok) {
      setCheckState((cur) => {
        const next = { ...cur };
        delete next[id];
        return next;
      });
      setEvents((cur) => {
        const next = { ...cur };
        delete next[id];
        return next;
      });
      setReload((n) => n + 1);
    } else {
      setCheckState((cur) => ({ ...cur, [id]: r.code }));
    }
  };

  const categoryLabel = (key: string) => (rules.categories as Record<string, { label: { en: string; ar: string } }>)[key]?.label[lang] ?? key;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.04em]">{B.title}</h1>
          <p className="mt-2 text-[14px] font-light leading-[1.8] text-muted-foreground">{B.sub}</p>
        </div>
        <Link to="/app/new" className="rounded-lg bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark">
          {B.submitCta}
        </Link>
      </div>

      {state.loading && <p className="mt-8 text-[13px] text-muted-foreground" role="status">{B.loading}</p>}
      {state.error && <p className="mt-8 text-[13px] text-danger" role="alert">{B.error}</p>}
      {!state.loading && !state.error && state.batches.length === 0 && (
        <p className="mt-8 rounded-[14px] border-[1.5px] border-dashed border-primary-muted bg-white p-6 text-[13px] text-muted-foreground">{B.empty}</p>
      )}

      <ul className="mt-6 flex flex-col gap-3">
        {state.batches.map((b) => {
          const open = openId === b.id;
          const list = events[b.id];
          const first = b.items[0];
          return (
            <li key={b.id} className="rounded-[14px] border-[1.5px] border-border bg-white">
              <div className="flex flex-wrap items-center gap-4 p-4">
                <div className="h-[72px] w-24 shrink-0 overflow-hidden rounded-lg bg-surface-raised">
                  {b.photo ? (
                    <img src={b.photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <FoodArt name={first?.name} category={first?.category} className="h-full w-full" />
                  )}
                </div>
                <div className="min-w-[200px] flex-1">
                  <p className="text-[14px] font-semibold text-foreground">
                    {first?.name ?? "—"}
                    {b.items.length > 1 && <span className="font-light text-muted-foreground"> +{b.items.length - 1}</span>}
                  </p>
                  <p className="mt-0.5 text-[12px] font-light text-muted-foreground">
                    {first ? categoryLabel(first.category) : ""} · <bdi>{b.portions}</bdi> {t.app.overview.portions} · {timeAgo(b.submittedAt, lang)}
                  </p>
                  {b.status === "draft" && (
                    <div className="mt-1.5">
                      <p className="text-[11px] font-medium text-muted-foreground">{B.waiting}</p>
                      <button
                        type="button"
                        disabled={checkState[b.id] === "running"}
                        onClick={() => void runCheck(b.id)}
                        className="mt-1.5 rounded-lg border border-primary px-3 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary-light disabled:opacity-60"
                      >
                        {checkState[b.id] === "running" ? B.checking : B.runCheck}
                      </button>
                      {checkState[b.id] && checkState[b.id] !== "running" && (
                        <p role="alert" className="mt-1 text-[11px] text-danger">{B.checkErrors[checkState[b.id]] ?? B.checkErrors.upstream}</p>
                      )}
                    </div>
                  )}
                  {b.safeUntil && ["listed", "matched", "dispatched", "picked_up", "escalated"].includes(b.status) && (
                    <div className="mt-2 max-w-[280px]">
                      <SafeClock safeUntil={b.safeUntil} startedAt={b.startedAt} />
                    </div>
                  )}
                  {b.safeUntil && b.tier !== "red" && !["listed", "matched", "dispatched", "picked_up", "escalated"].includes(b.status) && (
                    <p className="mt-1 text-[11px] font-light text-muted-foreground">{B.safeUntil} <bdi className="font-medium">{fmtDubaiTime(new Date(b.safeUntil))}</bdi></p>
                  )}
                  {b.rejectReason && lang === "en" && <p className="mt-1 text-[11px] text-danger">{B.reason}: {b.rejectReason}</p>}
                </div>
                <div className="flex items-center gap-3">
                  {b.tier && (
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tierStyle[b.tier]}`}>{t.safety.cards[tierIndex[b.tier]].name}</span>
                  )}
                  <span className={`text-[12px] font-medium ${statusStyle(b.status)}`}>{t.app.dash.status[b.status] ?? b.status}</span>
                </div>
                <button type="button" onClick={() => toggle(b.id)} aria-expanded={open} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary">
                  {open ? B.hideActivity : B.showActivity}
                  <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
              </div>

              {open && (
                <div className="border-t border-border px-5 py-4">
                  <div className="mb-4 flex flex-wrap items-start gap-4">
                    <div className="h-[150px] w-[200px] shrink-0 overflow-hidden rounded-xl border border-border bg-surface-raised">
                      {b.photo ? (
                        <img src={b.photo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <FoodArt name={first?.name} category={first?.category} className="h-full w-full" label={first?.name ?? ""} />
                      )}
                    </div>
                    <div className="min-w-[200px] flex-1">
                      <ul className="flex flex-col gap-1.5">
                        {b.items.map((it, k) => (
                          <li key={`${it.name}-${k}`} className="text-[12px] text-foreground">
                            <span className="font-semibold">{it.name}</span>
                            <span className="font-light text-muted-foreground"> · {categoryLabel(it.category)} · <bdi>{it.portions}</bdi></span>
                          </li>
                        ))}
                      </ul>
                      {!b.photo && <p className="mt-2 text-[11px] font-light text-muted-foreground">{B.sampleImage}</p>}
                      {b.notes && <p className="mt-2 text-[12px] font-light text-muted-foreground">{b.notes}</p>}
                    </div>
                  </div>
                  {list === "loading" || list === undefined ? (
                    <p className="text-[12px] text-muted-foreground" role="status">{B.loading}</p>
                  ) : list === "error" ? (
                    <p className="text-[12px] text-danger" role="alert">{B.error}</p>
                  ) : list.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground">{B.noActivity}</p>
                  ) : (
                    <>
                      <ol className="flex flex-col gap-3.5">
                        {list.map((e, i) => (
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
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
