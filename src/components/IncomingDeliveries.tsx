import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { FoodArt } from "./FoodArt";
import { SafeClock } from "./SafeClock";
import { listIncoming, type Incoming } from "../data/incoming";
import { useLang } from "../i18n/LanguageContext";
import { timeAgo } from "../lib/format";

const tone: Record<string, string> = { matched: "text-amber", dispatched: "text-primary", picked_up: "text-primary", closed: "text-primary" };

/** For fridge hosts: what is on its way to the fridge, and what arrived recently. */
export function IncomingDeliveries() {
  const { t, lang } = useLang();
  const F = t.fridge;
  const { user } = useAuth();
  const [rows, setRows] = useState<Incoming[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () =>
      listIncoming(user)
        .then((r) => alive && (setRows(r), setError(false)))
        .catch((e) => {
          console.error(e);
          if (alive) setError(true);
        });
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 12000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [user?.id, user?.fridgeId, user?.mode]);

  if (!user) return null;
  return (
    <section className="mt-6">
      <h2 className="text-[15px] font-bold">{F.incomingTitle}</h2>
      {error && <p role="alert" className="mt-2 text-[12px] text-danger">{F.loadError}</p>}
      {rows && rows.length === 0 && <p className="mt-3 rounded-[14px] border-[1.5px] border-dashed border-primary-muted bg-white p-5 text-[13px] text-muted-foreground">{F.incomingEmpty}</p>}
      <ul className="mt-3 flex flex-col gap-3">
        {(rows ?? []).map((b) => {
          const first = b.items[0];
          const moving = b.status !== "closed";
          return (
            <li key={b.id} className="flex flex-wrap items-center gap-4 rounded-[14px] border-[1.5px] border-border bg-white p-4">
              <div className="h-[72px] w-24 shrink-0 overflow-hidden rounded-lg bg-surface-raised">
                {b.photo ? <img src={b.photo} alt="" className="h-full w-full object-cover" /> : <FoodArt name={first?.name} category={first?.category} className="h-full w-full" />}
              </div>
              <div className="min-w-[200px] flex-1">
                <p className="text-[14px] font-semibold">
                  {first?.name ?? "—"}
                  {b.items.length > 1 && <span className="font-light text-muted-foreground"> +{b.items.length - 1}</span>}
                </p>
                <p className="mt-0.5 text-[12px] font-light text-muted-foreground">
                  {b.restaurantName}{b.area ? ` · ${b.area}` : ""} · <bdi>{b.portions}</bdi> {t.app.overview.portions} · {timeAgo(b.submittedAt, lang)}
                </p>
                {moving && b.safeUntil && <div className="mt-2 max-w-[260px]"><SafeClock safeUntil={b.safeUntil} startedAt={b.startedAt} /></div>}
              </div>
              <span className={`text-[12px] font-semibold ${tone[b.status] ?? "text-foreground"}`}>
                {b.status === "closed" ? F.delivered : t.app.dash.status[b.status] ?? b.status}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
