import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import {
  chooseDemoFridge, chooseDemoVolunteer, DEMO_HOST_EMAIL, DEMO_VOLUNTEER_EMAIL, listDemoFridges, listDemoVolunteers,
  type DemoFridge, type DemoVolunteer,
} from "../data/demo";
import { useLang } from "../i18n/LanguageContext";
import { fill } from "../lib/format";

const box = "mt-6 rounded-[14px] border-[1.5px] border-primary-muted bg-primary-light/50 p-5";
const selectClass = "w-full max-w-[520px] rounded-lg border-[1.5px] border-border bg-white px-3.5 py-2.5 text-[13px] text-foreground focus:border-primary focus:outline-none";

/** Demo volunteer account only: choose which sample volunteer you are playing, so you can answer the offer that was sent. */
export function DemoVolunteerPicker({ onChanged }: { onChanged?: () => void }) {
  const { t } = useLang();
  const D = t.demo;
  const { user, refreshProfile } = useAuth();
  const enabled = user?.mode === "supabase" && user.email === DEMO_VOLUNTEER_EMAIL;
  const [list, setList] = useState<DemoVolunteer[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await listDemoVolunteers();
    if (r.ok) {
      setList(r.data.volunteers);
      setError(false);
    } else setError(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10000);
    return () => window.clearInterval(id);
  }, [enabled, load]);

  if (!enabled) return null;
  const current = list?.find((v) => v.current);
  const withOffer = list?.find((v) => v.hasOffer && !v.current);

  const choose = async (id: string) => {
    const v = list?.find((x) => x.id === id);
    if (!v || v.current) return;
    setBusy(true);
    setMessage(null);
    const r = await chooseDemoVolunteer(id);
    if (r.ok) {
      await refreshProfile();
      await load();
      setMessage(fill(D.playing, { name: v.name }));
      onChanged?.();
    } else setMessage(D.error);
    setBusy(false);
  };

  const label = (v: DemoVolunteer) =>
    `${v.name} · ${v.area} · ${t.onboarding.transports[v.transport] ?? v.transport}${v.hasOffer ? ` · ${D.hasOffer}` : v.onTrip ? ` · ${D.onTrip}` : ""}`;

  return (
    <section className={box} aria-label={D.volunteerTitle}>
      <p className="flex items-center gap-2 text-[14px] font-bold">
        <Users size={16} className="text-primary" aria-hidden="true" />
        {D.volunteerTitle}
      </p>
      <p className="mt-1 text-[12px] font-light leading-[1.7] text-muted-foreground">{D.volunteerHelp}</p>
      {error && <p className="mt-2 text-[12px] text-danger">{D.loadError}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select aria-label={D.volunteerTitle} className={selectClass} disabled={busy || !list} value={current?.id ?? ""} onChange={(e) => void choose(e.target.value)}>
          {!current && <option value="">{D.choose}</option>}
          {(list ?? []).map((v) => (
            <option key={v.id} value={v.id}>{label(v)}</option>
          ))}
        </select>
        {withOffer && (
          <button type="button" disabled={busy} onClick={() => void choose(withOffer.id)} className="rounded-lg bg-primary px-4 py-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60">
            {fill(D.switchToOffer, { name: withOffer.name })}
          </button>
        )}
      </div>
      {message && <p role="status" className="mt-2 text-[12px] font-medium text-primary">{message}</p>}
    </section>
  );
}

/** Demo fridge host account only: choose which fridge you look after. */
export function DemoFridgePicker({ onChanged }: { onChanged?: () => void }) {
  const { t } = useLang();
  const D = t.demo;
  const { user, refreshProfile } = useAuth();
  const enabled = user?.mode === "supabase" && user.email === DEMO_HOST_EMAIL;
  const [list, setList] = useState<DemoFridge[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await listDemoFridges();
    if (r.ok) {
      setList(r.data.fridges);
      setError(false);
    } else setError(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10000);
    return () => window.clearInterval(id);
  }, [enabled, load]);

  if (!enabled) return null;
  const current = list?.find((f) => f.current);
  const busiest = list?.find((f) => f.incoming > 0 && !f.current);

  const choose = async (id: string) => {
    const f = list?.find((x) => x.id === id);
    if (!f || f.current) return;
    setBusy(true);
    setMessage(null);
    const r = await chooseDemoFridge(id);
    if (r.ok) {
      await refreshProfile();
      await load();
      setMessage(fill(D.hosting, { name: `${f.code} ${f.name}` }));
      onChanged?.();
    } else setMessage(D.error);
    setBusy(false);
  };

  const label = (f: DemoFridge) => `${f.code} ${f.name} · ${f.stock}/${f.capacity}${f.incoming > 0 ? ` · ${fill(D.incoming, { n: f.incoming })}` : ""}`;

  return (
    <section className={box} aria-label={D.fridgeTitle}>
      <p className="flex items-center gap-2 text-[14px] font-bold">
        <Users size={16} className="text-primary" aria-hidden="true" />
        {D.fridgeTitle}
      </p>
      <p className="mt-1 text-[12px] font-light leading-[1.7] text-muted-foreground">{D.fridgeHelp}</p>
      {error && <p className="mt-2 text-[12px] text-danger">{D.loadError}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select aria-label={D.fridgeTitle} className={selectClass} disabled={busy || !list} value={current?.id ?? ""} onChange={(e) => void choose(e.target.value)}>
          {!current && <option value="">{D.choose}</option>}
          {(list ?? []).map((f) => (
            <option key={f.id} value={f.id}>{label(f)}</option>
          ))}
        </select>
        {busiest && (
          <button type="button" disabled={busy} onClick={() => void choose(busiest.id)} className="rounded-lg bg-primary px-4 py-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60">
            {fill(D.switchToIncoming, { code: busiest.code })}
          </button>
        )}
      </div>
      {message && <p role="status" className="mt-2 text-[12px] font-medium text-primary">{message}</p>}
    </section>
  );
}
