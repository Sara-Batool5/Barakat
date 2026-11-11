import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { IncomingDeliveries } from "../../components/IncomingDeliveries";
import { DemoFridgePicker } from "../../components/DemoPickers";
import { loadMyFridge, recordStock, setFridgeStatus, type MyFridgeData } from "../../data/fridgeData";
import { useLang } from "../../i18n/LanguageContext";
import { fmtDubaiTime, timeAgo } from "../../lib/format";

export default function MyFridge() {
  const { t, lang } = useLang();
  const F = t.myFridge;
  const { user } = useAuth();
  const [data, setData] = useState<MyFridgeData | null>(null);
  const [error, setError] = useState(false);
  const [portions, setPortions] = useState("10");
  const [reason, setReason] = useState<"taken" | "expired">("taken");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setData(await loadMyFridge(user));
      setError(false);
    } catch (err) {
      console.error(err);
      setError(true);
    }
  }, [user?.id, user?.fridgeId, user?.mode]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10000);
    return () => window.clearInterval(id);
  }, [load]);

  if (!user) return null;
  const f = data?.fridge;
  const room = f ? Math.max(0, f.capacity - f.stock - f.reserved) : 0;
  const pct = (n: number) => (f ? Math.min(100, (n / Math.max(1, f.capacity)) * 100) : 0);

  const record = async () => {
    if (!f) return;
    const n = Math.round(Number(portions));
    if (!(n >= 1 && n <= 500)) return setMessage({ ok: false, text: F.errors.portions });
    setBusy(true);
    setMessage(null);
    const r = await recordStock(f.id, n, reason);
    setBusy(false);
    if (r.ok) {
      setMessage({ ok: true, text: F.recorded });
      await load();
    } else setMessage({ ok: false, text: F.errors[r.code] ?? F.errors.upstream });
  };

  const toggleStatus = async () => {
    if (!f) return;
    setBusy(true);
    setMessage(null);
    const ok = await setFridgeStatus(f.id, f.status === "active" ? "paused" : "active");
    setBusy(false);
    if (!ok) setMessage({ ok: false, text: F.errors.upstream });
    await load();
  };

  const input = "w-full rounded-lg border-[1.5px] border-border bg-white px-3.5 py-2.5 text-[13px] focus:border-primary focus:outline-none";

  return (
    <>
      <h1 className="text-[28px] font-extrabold tracking-[-0.04em]">{F.title}</h1>
      <p className="mt-2 max-w-[640px] text-[14px] font-light leading-[1.8] text-muted-foreground">{F.sub}</p>
      <DemoFridgePicker onChanged={() => void load()} />
      {error && <p role="alert" className="mt-4 text-[13px] text-danger">{F.loadError}</p>}
      {user.mode === "local" && <p className="mt-4 rounded-lg bg-amber-light px-4 py-3 text-[13px] text-amber">{F.errors.local}</p>}
      {!f && !error && user.mode !== "local" && <p className="mt-6 text-[13px] text-muted-foreground">{F.noFridge}</p>}

      {f && (
        <>
          <section className="mt-6 rounded-[14px] border-[1.5px] border-border bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[18px] font-bold tracking-[-0.02em]">{f.code} · {f.name}</p>
                <p className="mt-0.5 text-[12px] font-light text-muted-foreground">
                  {f.area} · {F.hours}: {f.open24h || !f.openFrom || !f.openTo ? F.open24 : `${f.openFrom.slice(0, 5)}–${f.openTo.slice(0, 5)}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${f.status === "active" ? "bg-primary-light text-primary" : "bg-amber-light text-amber"}`}>{F.statuses[f.status] ?? f.status}</span>
                <button type="button" disabled={busy} onClick={() => void toggleStatus()} className="rounded-lg border border-border px-4 py-2 text-[12px] font-semibold text-foreground transition-colors hover:border-foreground disabled:opacity-60">
                  {f.status === "active" ? F.pause : F.resume}
                </button>
              </div>
            </div>
            {f.status !== "active" && <p className="mt-3 text-[12px] font-light text-amber">{F.pausedNote}</p>}

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-surface-raised" role="img" aria-label={`${f.stock}/${f.capacity}`}>
              <div className="flex h-full">
                <div className="h-full bg-primary" style={{ width: `${pct(f.stock)}%` }} />
                <div className="h-full bg-primary-muted" style={{ width: `${pct(f.reserved)}%` }} />
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[[F.stock, f.stock, "text-primary"], [F.reserved, f.reserved, "text-foreground"], [F.room, room, "text-foreground"], [F.capacity, f.capacity, "text-muted-foreground"]].map(([label, value, cls]) => (
                <div key={String(label)}>
                  <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>
                  <dd className={`mt-1 text-[26px] font-extrabold tracking-[-0.04em] ${cls}`}><bdi>{value}</bdi></dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-6 rounded-[14px] border-[1.5px] border-border bg-white p-6">
            <h2 className="text-[15px] font-bold">{F.takenTitle}</h2>
            <p className="mt-1 text-[12px] font-light text-muted-foreground">{F.takenHelp}</p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="w-28">
                <label htmlFor="portions" className="mb-1.5 block text-[12px] font-medium">{F.portionsLabel}</label>
                <input id="portions" type="number" min={1} max={500} inputMode="numeric" dir="ltr" className={input} value={portions} onChange={(e) => setPortions(e.target.value)} />
              </div>
              <div className="min-w-[220px]">
                <label htmlFor="reason" className="mb-1.5 block text-[12px] font-medium">{F.reasonLabel}</label>
                <select id="reason" className={input} value={reason} onChange={(e) => setReason(e.target.value as "taken" | "expired")}>
                  <option value="taken">{F.reasons.taken}</option>
                  <option value="expired">{F.reasons.expired}</option>
                </select>
              </div>
              <button type="button" disabled={busy || f.stock === 0} onClick={() => void record()} className="rounded-lg bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60">
                {busy ? F.saving : F.record}
              </button>
            </div>
            {message && <p role={message.ok ? "status" : "alert"} className={`mt-3 text-[12px] font-medium ${message.ok ? "text-primary" : "text-danger"}`}>{message.text}</p>}
          </section>

          <IncomingDeliveries />

          <section className="mt-6 rounded-[14px] border-[1.5px] border-border bg-white p-6">
            <h2 className="text-[15px] font-bold">{F.logTitle}</h2>
            {data && data.log.length === 0 && <p className="mt-3 text-[12px] text-muted-foreground">{F.logEmpty}</p>}
            <ul className="mt-3 flex flex-col">
              {(data?.log ?? []).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 border-b border-border/70 py-2.5 text-[12px] last:border-0">
                  <span className="text-foreground">{F.logReasons[l.reason] ?? l.reason}</span>
                  <span className={`font-semibold ${l.delta > 0 ? "text-primary" : "text-muted-foreground"}`}><bdi>{l.delta > 0 ? `+${l.delta}` : l.delta}</bdi></span>
                  <span className="text-muted-foreground"><bdi>{fmtDubaiTime(new Date(l.createdAt))}</bdi> · {timeAgo(l.createdAt, lang)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
