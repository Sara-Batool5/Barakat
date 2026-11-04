import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { EventList } from "../../components/EventList";
import { FoodArt } from "../../components/FoodArt";
import { SafeClock } from "../../components/SafeClock";
import rules from "../../config/safetyRules.json";
import { loadBatchEvents, type BatchEvent } from "../../data/batches";
import { reviewBatch } from "../../data/dispatch";
import { listEscalated, loadSafetyChecks, type ReviewItem, type SafetyCheck } from "../../data/review";
import type { Tier } from "../../data/types";
import { useLang } from "../../i18n/LanguageContext";
import { fill, timeAgo } from "../../lib/format";

const tierIndex: Record<Tier, number> = { green: 0, amber: 1, red: 2 };
const tierStyle: Record<Tier, string> = { green: "bg-primary-light text-primary", amber: "bg-amber-light text-amber", red: "bg-danger-light text-danger" };
/** What is saved in the database for each decline reason (English, so the restaurant sees it too). */
const PRESET_TEXT: Record<string, string> = {
  unclear: "The photo or details were too unclear to confirm the food is safe.",
  unsafe: "The food looks unsafe to donate.",
  missing: "Important details are missing.",
  other: "Declined by a coordinator.",
};

type Reasoning = { checks: SafetyCheck[]; events: BatchEvent[] } | "loading" | "error";

export default function ReviewQueue() {
  const { t, lang } = useLang();
  const R = t.review;
  const { user } = useAuth();
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState<Record<string, Reasoning>>({});
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [preset, setPreset] = useState("unclear");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(() => {
    if (!user) return Promise.resolve();
    return listEscalated(user)
      .then((list) => {
        setItems(list);
        setError(false);
      })
      .catch((err) => {
        console.error(err);
        setError(true);
      });
  }, [user?.id, user?.mode]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10000);
    return () => window.clearInterval(id);
  }, [load]);

  if (!user) return null;
  const categoryLabel = (key: string) => (rules.categories as Record<string, { label: { en: string; ar: string } }>)[key]?.label[lang] ?? key;

  const toggleReasoning = (id: string) => {
    if (openId === id) return setOpenId(null);
    setOpenId(id);
    if (!reasoning[id]) {
      setReasoning((cur) => ({ ...cur, [id]: "loading" }));
      Promise.all([loadSafetyChecks(user, id), loadBatchEvents(user, id)])
        .then(([checks, events]) => setReasoning((cur) => ({ ...cur, [id]: { checks, events } })))
        .catch(() => setReasoning((cur) => ({ ...cur, [id]: "error" })));
    }
  };

  const decide = async (id: string, decision: "approve" | "decline") => {
    setBusy(id);
    setMessage(null);
    const text = decision === "decline" ? note.trim() || PRESET_TEXT[preset] : "";
    const r = await reviewBatch(id, decision, text);
    setBusy(null);
    if (r.ok) {
      setMessage({ kind: "ok", text: decision === "approve" ? R.done.approved : R.done.declined });
      setDecliningId(null);
      setNote("");
      setReasoning((cur) => {
        const next = { ...cur };
        delete next[id];
        return next;
      });
    } else {
      setMessage({ kind: "error", text: R.errors[r.code] ?? R.errors.upstream });
    }
    await load();
  };

  const checkReason = (c: { code: string; text?: string; params?: Record<string, string | number> }) => {
    const tpl = t.surplus.reasons[c.code] ?? R.checkReasons[c.code];
    if (tpl) return fill(tpl, c.params);
    return lang === "en" && c.text ? c.text : c.code;
  };

  return (
    <>
      <h1 className="text-[28px] font-extrabold tracking-[-0.04em]">{R.title}</h1>
      <p className="mt-2 max-w-[640px] text-[14px] font-light leading-[1.8] text-muted-foreground">{R.sub}</p>
      {user.mode === "local" && <p className="mt-5 rounded-lg bg-amber-light px-4 py-3 text-[13px] text-amber">{R.errors.local}</p>}
      {error && <p role="alert" className="mt-5 text-[13px] text-danger">{R.loadError}</p>}
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={`mt-5 rounded-lg px-4 py-3 text-[13px] ${message.kind === "error" ? "bg-danger-light text-danger" : "bg-primary-light text-primary"}`}>
          {message.text}
        </p>
      )}

      {items && items.length === 0 && (
        <p className="mt-8 rounded-[14px] border-[1.5px] border-dashed border-primary-muted bg-white p-6 text-[13px] text-muted-foreground">{R.empty}</p>
      )}

      <ul className="mt-6 flex flex-col gap-4">
        {(items ?? []).map((b) => {
          const first = b.items[0];
          const declining = decliningId === b.id;
          const detail = reasoning[b.id];
          return (
            <li key={b.id} className="rounded-[14px] border-[1.5px] border-amber bg-white">
              <div className="flex flex-wrap gap-5 p-5">
                <div className="h-[132px] w-[176px] shrink-0 overflow-hidden rounded-xl border border-border bg-surface-raised">
                  {b.photo ? <img src={b.photo} alt="" className="h-full w-full object-cover" /> : <FoodArt name={first?.name} category={first?.category} className="h-full w-full" />}
                </div>

                <div className="min-w-[240px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-bold tracking-[-0.01em] text-foreground">{b.restaurantName}</p>
                    <span className="text-[12px] font-light text-muted-foreground">{b.area}</span>
                    {b.tier && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tierStyle[b.tier]}`}>{t.safety.cards[tierIndex[b.tier]].name}</span>}
                    {b.isSample && <span className="rounded bg-surface-raised px-1.5 py-0.5 font-mono-label text-[9px] text-muted-foreground">{R.sample}</span>}
                  </div>
                  <p className="mt-0.5 text-[12px] font-light text-muted-foreground">{timeAgo(b.submittedAt, lang)} · <bdi>{b.portions}</bdi> {t.app.overview.portions}</p>

                  <ul className="mt-3 flex flex-col gap-1">
                    {b.items.map((it, k) => (
                      <li key={`${it.name}-${k}`} className="text-[12px] text-foreground">
                        <span className="font-semibold">{it.name}</span>
                        <span className="font-light text-muted-foreground"> · {categoryLabel(it.category)} · <bdi>{it.portions}</bdi></span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 rounded-lg bg-amber-light px-3.5 py-2.5">
                    <p className="text-[11px] font-semibold text-amber">{R.whyTitle}</p>
                    <p className="mt-0.5 text-[12px] font-light leading-[1.6] text-foreground">{fill(R.reasons[b.reason.code] ?? R.reasons.generic, { percent: b.reason.percent ?? "" })}</p>
                  </div>
                  {b.notes && <p className="mt-2 text-[12px] font-light italic text-muted-foreground">{b.notes}</p>}
                  {b.safeUntil && <div className="mt-3 max-w-[300px]"><SafeClock safeUntil={b.safeUntil} startedAt={b.startedAt} /></div>}
                </div>

                <div className="flex min-w-[190px] flex-col gap-2.5">
                  <button type="button" disabled={busy === b.id} onClick={() => void decide(b.id, "approve")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60">
                    <Check size={15} strokeWidth={3} aria-hidden="true" />
                    {busy === b.id && !declining ? R.approving : R.approve}
                  </button>
                  <button type="button" disabled={busy === b.id} onClick={() => setDecliningId(declining ? null : b.id)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-danger px-4 py-2.5 text-[13px] font-semibold text-danger transition-colors hover:bg-danger-light disabled:opacity-60">
                    <X size={15} strokeWidth={3} aria-hidden="true" />
                    {R.decline}
                  </button>
                </div>
              </div>

              {declining && (
                <div className="border-t border-border bg-surface/60 px-5 py-4">
                  <p className="text-[13px] font-semibold">{R.declineTitle}</p>
                  <div className="mt-2.5 flex flex-wrap gap-2" role="radiogroup" aria-label={R.declineTitle}>
                    {Object.keys(PRESET_TEXT).map((k) => (
                      <label key={k} className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-primary ${preset === k ? "border-danger bg-danger-light text-danger" : "border-border bg-white text-muted-foreground"}`}>
                        <input type="radio" name={`preset-${b.id}`} className="sr-only" checked={preset === k} onChange={() => setPreset(k)} />
                        {R.presets[k]}
                      </label>
                    ))}
                  </div>
                  <label htmlFor={`note-${b.id}`} className="mt-3 block text-[12px] font-medium">{R.noteLabel}</label>
                  <textarea id={`note-${b.id}`} rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5 w-full rounded-lg border-[1.5px] border-border bg-white px-3.5 py-2.5 text-[13px] focus:border-primary focus:outline-none" />
                  <div className="mt-3 flex gap-3">
                    <button type="button" disabled={busy === b.id} onClick={() => void decide(b.id, "decline")} className="rounded-lg bg-danger px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-60">
                      {busy === b.id ? R.declining : R.confirmDecline}
                    </button>
                    <button type="button" onClick={() => setDecliningId(null)} className="rounded-lg border border-border px-4 py-2 text-[12px] font-semibold text-foreground">{R.cancel}</button>
                  </div>
                </div>
              )}

              <div className="border-t border-border px-5 py-3">
                <button type="button" onClick={() => toggleReasoning(b.id)} aria-expanded={openId === b.id} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary">
                  {openId === b.id ? R.hideReasoning : R.showReasoning}
                  <ChevronDown size={14} className={`transition-transform ${openId === b.id ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {openId === b.id && (
                  <div className="mt-4 grid gap-6 md:grid-cols-2">
                    {detail === "loading" || detail === undefined ? (
                      <p className="text-[12px] text-muted-foreground" role="status">{R.loading}</p>
                    ) : detail === "error" ? (
                      <p className="text-[12px] text-danger" role="alert">{R.loadError}</p>
                    ) : (
                      <>
                        <div>
                          <p className="mb-2.5 text-[12px] font-bold">{R.checksTitle}</p>
                          {detail.checks.length === 0 ? (
                            <p className="text-[12px] text-muted-foreground">{t.batches.noActivity}</p>
                          ) : (
                            <ul className="flex flex-col gap-3">
                              {detail.checks.map((c, i) => (
                                <li key={i} className="rounded-lg border border-border p-3">
                                  <p className="flex flex-wrap items-center gap-2 text-[12px]">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tierStyle[c.tier]}`}>{t.safety.cards[tierIndex[c.tier]].name}</span>
                                    <span className="font-semibold text-foreground">{c.decidedBy === "agent" ? R.byAgent : R.byCoordinator}</span>
                                    <span className={c.passed ? "font-medium text-primary" : "font-medium text-danger"}>{c.passed ? R.passed : R.notPassed}</span>
                                    {c.confidence !== null && <span className="font-light text-muted-foreground">{R.confidence} <bdi>{Math.round(c.confidence * 100)}%</bdi></span>}
                                  </p>
                                  <ul className="mt-2 flex flex-col gap-1">
                                    {c.reasons.map((r, k) => (
                                      <li key={k} className="text-[11px] font-light leading-[1.6] text-muted-foreground">{checkReason(r)}</li>
                                    ))}
                                  </ul>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <p className="mb-2.5 text-[12px] font-bold">{R.timelineTitle}</p>
                          <EventList events={detail.events} />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
