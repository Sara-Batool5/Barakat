import { useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { demoRefresh, demoReset } from "../data/demo";
import { useDemoMode } from "../data/useDemoMode";
import { useLang } from "../i18n/LanguageContext";

/** Coordinator only: get the sample data ready for a presentation without opening the database. */
export function DemoControls() {
  const { t } = useLang();
  const D = t.demoControls;
  const { user } = useAuth();
  const on = useDemoMode();
  const [busy, setBusy] = useState<"refresh" | "reset" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!user || user.mode !== "supabase" || !on) return null;

  const run = async (which: "refresh" | "reset") => {
    setBusy(which);
    setMessage(null);
    const r = await (which === "refresh" ? demoRefresh() : demoReset());
    setBusy(null);
    setConfirm(false);
    setMessage(r.ok ? { ok: true, text: D.done } : { ok: false, text: D.errors[r.code] ?? D.errors.upstream });
  };

  return (
    <section className="mt-6 rounded-[14px] border-[1.5px] border-dashed border-primary-muted bg-white p-5" aria-label={D.title}>
      <p className="text-[14px] font-bold">{D.title}</p>
      <p className="mt-1 text-[12px] font-light leading-[1.7] text-muted-foreground">{D.help}</p>
      <div className="mt-4 flex flex-wrap items-start gap-3">
        <button type="button" disabled={busy !== null} onClick={() => void run("refresh")} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60">
          <RefreshCw size={14} className={busy === "refresh" ? "animate-spin" : ""} aria-hidden="true" />
          {busy === "refresh" ? D.working : D.refresh}
        </button>
        {!confirm ? (
          <button type="button" disabled={busy !== null} onClick={() => setConfirm(true)} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-[12px] font-semibold text-foreground transition-colors hover:border-danger hover:text-danger disabled:opacity-60">
            <Trash2 size={14} aria-hidden="true" />
            {D.reset}
          </button>
        ) : (
          <div className="rounded-lg border border-danger bg-danger-light p-3">
            <p className="max-w-[360px] text-[12px] leading-[1.6] text-danger">{D.resetWarning}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={busy !== null} onClick={() => void run("reset")} className="rounded-lg bg-danger px-3.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60">
                {busy === "reset" ? D.working : D.confirmReset}
              </button>
              <button type="button" onClick={() => setConfirm(false)} className="rounded-lg border border-border bg-white px-3.5 py-1.5 text-[12px] font-semibold text-foreground">
                {D.cancel}
              </button>
            </div>
          </div>
        )}
      </div>
      {message && <p role={message.ok ? "status" : "alert"} className={`mt-3 text-[12px] font-medium ${message.ok ? "text-primary" : "text-danger"}`}>{message.text}</p>}
    </section>
  );
}
