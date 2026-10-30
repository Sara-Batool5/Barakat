import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ImageOff } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
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
  }, [user?.id, user?.restaurantId, user?.mode]);

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
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-raised text-subtle">
                  {b.photo ? <img src={b.photo} alt="" className="h-full w-full object-cover" /> : <ImageOff size={20} aria-label={B.noPhoto} />}
                </div>
                <div className="min-w-[200px] flex-1">
                  <p className="text-[14px] font-semibold text-foreground">
                    {first?.name ?? "—"}
                    {b.items.length > 1 && <span className="font-light text-muted-foreground"> +{b.items.length - 1}</span>}
                  </p>
                  <p className="mt-0.5 text-[12px] font-light text-muted-foreground">
                    {first ? categoryLabel(first.category) : ""} · <bdi>{b.portions}</bdi> {t.app.overview.portions} · {timeAgo(b.submittedAt, lang)}
                  </p>
                  {b.status === "draft" && <p className="mt-1 text-[11px] font-medium text-muted-foreground">{B.waiting}</p>}
                  {b.safeUntil && b.tier !== "red" && (
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
