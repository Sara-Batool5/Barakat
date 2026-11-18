import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { runHealthCheck, type HealthCheck } from "../../data/health";
import { useLang } from "../../i18n/LanguageContext";
import { fill } from "../../lib/format";

const GROUPS: { key: "keys" | "database" | "storage" | "scheduler"; match: (id: string) => boolean }[] = [
  { key: "keys", match: (id) => id.startsWith("env_") },
  { key: "database", match: (id) => id.startsWith("db_") },
  { key: "storage", match: (id) => id === "storage_bucket" },
  { key: "scheduler", match: (id) => id === "scheduler" },
];

export default function Health() {
  const { t } = useLang();
  const H = t.health;
  const { user } = useAuth();
  const [checks, setChecks] = useState<HealthCheck[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    const r = await runHealthCheck();
    setBusy(false);
    if (r.ok) setChecks(r.data.checks);
    else setError(H.errors[r.code] ?? H.errors.upstream);
  }, [H]);

  useEffect(() => {
    if (user?.mode === "supabase") void run();
  }, [user?.id, user?.mode]);

  if (!user) return null;
  const failing = (checks ?? []).filter((c) => !c.ok).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.04em]">{H.title}</h1>
          <p className="mt-2 max-w-[640px] text-[14px] font-light leading-[1.8] text-muted-foreground">{H.sub}</p>
        </div>
        <button type="button" disabled={busy || user.mode !== "supabase"} onClick={() => void run()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60">
          <RefreshCw size={14} className={busy ? "animate-spin" : ""} aria-hidden="true" />
          {busy ? H.checking : H.run}
        </button>
      </div>

      {user.mode !== "supabase" && <p className="mt-5 rounded-lg bg-amber-light px-4 py-3 text-[13px] text-amber">{H.errors.local}</p>}
      {error && <p role="alert" className="mt-5 rounded-lg bg-danger-light px-4 py-3 text-[13px] text-danger">{error}</p>}

      {checks && (
        <p role="status" className={`mt-6 rounded-[14px] border-[1.5px] px-5 py-4 text-[14px] font-semibold ${failing === 0 ? "border-primary bg-primary-light text-primary" : "border-amber bg-amber-light text-amber"}`}>
          {failing === 0 ? H.allGood : fill(H.someFail, { n: failing })}
        </p>
      )}

      {checks &&
        GROUPS.map((g) => {
          const rows = checks.filter((c) => g.match(c.id));
          if (rows.length === 0) return null;
          return (
            <section key={g.key} className="mt-6 rounded-[14px] border-[1.5px] border-border bg-white p-5">
              <h2 className="text-[14px] font-bold">{H.groups[g.key]}</h2>
              <ul className="mt-3 flex flex-col">
                {rows.map((c) => {
                  const info = H.items[c.id];
                  return (
                    <li key={c.id} className="flex items-start gap-3 border-b border-border/70 py-3 last:border-0">
                      {c.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" aria-label={H.ok} /> : <XCircle size={18} className="mt-0.5 shrink-0 text-danger" aria-label={H.notOk} />}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-foreground">{info?.label ?? c.id}</p>
                        {c.ok && c.detail && <p className="text-[12px] font-light text-muted-foreground">{c.detail}</p>}
                        {!c.ok && (
                          <>
                            {c.detail && <p className="text-[12px] font-light text-danger">{c.detail}</p>}
                            {info && <p className="mt-1 text-[12px] font-light leading-[1.7] text-foreground"><span className="font-semibold">{H.fix}:</span> {info.fix}</p>}
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
    </>
  );
}
