import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { BarChart } from "../../components/BarChart";
import { loadImpact, type ImpactData } from "../../data/impactData";
import { useLang } from "../../i18n/LanguageContext";
import { fmtNumber } from "../../lib/format";
import { inRange, totals, weeklyBuckets, type Metric, type Range } from "../../lib/impact";
import { nowMs } from "../../lib/serverTime";

const input = "rounded-lg border-[1.5px] border-border bg-white px-3 py-2 text-[12px] focus:border-primary focus:outline-none";

export default function Impact() {
  const { t, lang } = useLang();
  const I = t.impact;
  const { user } = useAuth();
  const [range, setRange] = useState<Range>("90");
  const [metric, setMetric] = useState<Metric>("meals");
  const [includeSample, setIncludeSample] = useState(true);
  const [data, setData] = useState<ImpactData | null>(null);
  const [error, setError] = useState(false);
  const coordinator = user?.role === "coordinator";
  const locale = lang === "ar" ? "ar-u-nu-latn" : "en-GB";

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () =>
      loadImpact(user, includeSample)
        .then((d) => alive && (setData(d), setError(false)))
        .catch((err) => {
          console.error(err);
          if (alive) setError(true);
        });
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [user?.id, user?.restaurantId, user?.mode, includeSample]);

  const rows = useMemo(() => (data ? inRange(data.rows, range, nowMs()) : []), [data, range]);
  const sum = useMemo(() => totals(rows), [rows]);
  const buckets = useMemo(() => weeklyBuckets(data?.rows ?? [], nowMs(), 8, metric), [data, metric]);
  if (!user) return null;

  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "Asia/Dubai" });
  const dateTimeFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dubai" });
  const longFmt = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "Asia/Dubai" });
  const chart = buckets.map((b) => ({ label: dateFmt.format(new Date(b.start + 7 * 86400_000 - 1)), value: b.value }));
  const unit = metric === "meals" ? I.units.meals : metric === "kg" ? I.units.kg : I.units.co2e;
  const f = data?.factors;
  const placeholder = !!f && (/placeholder/i.test(f.version) || /placeholder/i.test(f.status));
  const scopeName = coordinator ? I.report.scopeNetwork : data?.venue?.name ?? "";
  const period = range === "all" ? I.range.all : `${longFmt.format(new Date(nowMs() - Number(range) * 86400_000))} – ${longFmt.format(new Date(nowMs()))}`;

  const kpis = [
    { ...I.kpis[0], value: fmtNumber(sum.meals) },
    { ...I.kpis[1], value: `${fmtNumber(sum.kg)} kg` },
    { ...I.kpis[2], value: `${fmtNumber(sum.co2e)} kg` },
    { ...I.kpis[3], value: fmtNumber(sum.points) },
  ];

  const table = (limit: number, withVenue: boolean) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-start text-[12px]">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {[I.cols.date, ...(withVenue ? [I.cols.venue] : []), I.cols.items, I.cols.fridge, I.cols.meals, I.cols.kg, I.cols.co2e, I.cols.points].map((h) => (
              <th key={h} scope="col" className="py-2 pe-3 text-start font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((r) => (
            <tr key={r.id} className="border-b border-border/70 last:border-0">
              <td className="py-2 pe-3 text-muted-foreground"><bdi>{dateTimeFmt.format(new Date(r.createdAt))}</bdi></td>
              {withVenue && <td className="py-2 pe-3 font-medium text-foreground">{r.restaurantName}</td>}
              <td className="py-2 pe-3 font-light text-foreground">{r.items[0] ?? ""}{r.items.length > 1 ? ` +${r.items.length - 1}` : ""}</td>
              <td className="py-2 pe-3 text-muted-foreground">{r.fridgeCode}</td>
              <td className="py-2 pe-3 font-medium text-foreground"><bdi>{r.meals}</bdi></td>
              <td className="py-2 pe-3 text-foreground"><bdi>{r.kg}</bdi></td>
              <td className="py-2 pe-3 text-foreground"><bdi>{r.co2eKg}</bdi></td>
              <td className="py-2 font-semibold text-primary"><bdi>{r.points}</bdi></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.04em]">{I.title}</h1>
          <p className="mt-2 max-w-[620px] text-[14px] font-light leading-[1.8] text-muted-foreground">{coordinator ? I.subCoordinator : I.subRestaurant}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
            {I.rangeLabel}
            <select className={input} value={range} onChange={(e) => setRange(e.target.value as Range)}>
              <option value="30">{I.range["30"]}</option>
              <option value="90">{I.range["90"]}</option>
              <option value="all">{I.range.all}</option>
            </select>
          </label>
          {coordinator && (
            <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-muted-foreground">
              <input type="checkbox" checked={includeSample} onChange={(e) => setIncludeSample(e.target.checked)} className="h-4 w-4 accent-[hsl(140_55%_38%)]" />
              {I.includeSample}
            </label>
          )}
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark">
            <Download size={15} aria-hidden="true" />
            {I.download}
          </button>
        </div>
      </div>
      <p className="no-print mt-2 text-[11px] font-light text-muted-foreground">{I.downloadHelp}</p>
      {error && <p role="alert" className="no-print mt-4 text-[13px] text-danger">{I.loadError}</p>}

      <div className="no-print">
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-[14px] border-[1.5px] border-border bg-white p-5">
              <p className="text-[12px] font-medium text-muted-foreground">{k.label}</p>
              <p className="mt-3 text-[28px] font-extrabold tracking-[-0.04em] text-foreground"><bdi>{k.value}</bdi></p>
              <p className="mt-1 text-[11px] font-light text-muted-foreground">{k.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] font-light text-muted-foreground"><bdi>{sum.count}</bdi> {I.rescues}</p>

        <section className="mt-6 rounded-[14px] border-[1.5px] border-border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[14px] font-bold">{I.chartTitle}</h2>
            <div className="flex gap-1 rounded-lg bg-surface-raised p-1" role="tablist" aria-label={I.chartTitle}>
              {(["meals", "kg", "co2e"] as Metric[]).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={metric === m} onClick={() => setMetric(m)} className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors ${metric === m ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}>
                  {I.metrics[m]}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3" dir="ltr"><BarChart data={chart} label={`${I.chartTitle}: ${I.metrics[metric]}`} unit={unit} /></div>
        </section>

        <div className={`mt-6 grid gap-6 ${coordinator ? "xl:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
          <section className="rounded-[14px] border-[1.5px] border-border bg-white p-5">
            <h2 className="text-[14px] font-bold">{I.ledgerTitle}</h2>
            {data && rows.length === 0 ? <p className="mt-3 text-[13px] text-muted-foreground">{I.empty}</p> : <div className="mt-3">{table(12, coordinator)}</div>}
          </section>
          {coordinator && (
            <section className="rounded-[14px] border-[1.5px] border-border bg-white p-5">
              <h2 className="text-[14px] font-bold">{I.leaderboardTitle}</h2>
              <ol className="mt-3 flex flex-col gap-2.5">
                {(data?.leaderboard ?? []).map((v, i) => (
                  <li key={v.name} className="flex items-center gap-3 text-[12px]">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-light text-[11px] font-bold text-primary">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{v.name}</span>
                    <span className="font-semibold text-primary"><bdi>{fmtNumber(v.points)}</bdi></span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <section className="mt-6 rounded-[14px] border-[1.5px] border-border bg-white p-5">
          <h2 className="text-[14px] font-bold">{I.methodTitle}</h2>
          <p className="mt-2 text-[12px] font-light leading-[1.8] text-muted-foreground">{I.methodText}</p>
          {f && (
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              {[[I.factors.kgPerMeal, `${f.kgPerMeal} kg`], [I.factors.co2PerKg, `${f.co2ePerKg} kg`], [I.factors.pointsPerMeal, String(f.pointsPerMeal)], [I.factors.version, f.version]].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] font-medium text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5 text-[13px] font-semibold text-foreground"><bdi>{v}</bdi></dd>
                </div>
              ))}
            </dl>
          )}
          {placeholder && <p className="mt-3 rounded-lg bg-amber-light px-3.5 py-2.5 text-[12px] font-medium leading-[1.6] text-amber">{I.placeholderNote}</p>}
        </section>
      </div>

      {/* The report: shown here as a preview, and the only thing that prints. */}
      <section id="report-sheet" className="mt-10 rounded-[14px] border-[1.5px] border-border bg-white p-8 print:mt-0 print:rounded-none print:border-0 print:p-0" aria-label={I.report.title}>
        <header className="flex items-center justify-between gap-4 border-b-2 border-primary pb-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="" width={48} height={48} />
            <div>
              <p className="text-[20px] font-extrabold tracking-[-0.03em]">{I.report.title}</p>
              <p className="text-[12px] font-light text-muted-foreground">{scopeName}{!coordinator && data?.venue?.area ? ` · ${data.venue.area}` : ""}</p>
            </div>
          </div>
          <div className="text-end text-[11px] font-light text-muted-foreground">
            <p>{I.report.periodLabel}: <bdi>{period}</bdi></p>
            <p>{I.report.generated}: <bdi>{longFmt.format(new Date(nowMs()))}</bdi></p>
          </div>
        </header>

        <h3 className="mt-6 text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{I.report.summary}</h3>
        <div className="mt-3 grid grid-cols-4 gap-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-lg border border-border p-3">
              <p className="text-[10px] font-medium text-muted-foreground">{k.label}</p>
              <p className="mt-1.5 text-[20px] font-extrabold tracking-[-0.03em]"><bdi>{k.value}</bdi></p>
            </div>
          ))}
        </div>

        <h3 className="mt-6 text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{I.chartTitle} ({I.metrics[metric]})</h3>
        <div className="mt-2" dir="ltr"><BarChart data={chart} label={`${I.chartTitle}: ${I.metrics[metric]}`} unit={unit} /></div>

        <h3 className="mt-6 text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{I.report.deliveries}</h3>
        <div className="mt-2">{rows.length === 0 ? <p className="text-[12px] text-muted-foreground">{I.empty}</p> : table(40, coordinator)}</div>

        <h3 className="mt-6 text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{I.methodTitle}</h3>
        <p className="mt-2 text-[11px] font-light leading-[1.8] text-muted-foreground">{I.methodText}</p>
        {f && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {I.factors.kgPerMeal}: <bdi>{f.kgPerMeal} kg</bdi> · {I.factors.co2PerKg}: <bdi>{f.co2ePerKg} kg</bdi> · {I.factors.pointsPerMeal}: <bdi>{f.pointsPerMeal}</bdi> · {I.factors.version}: <bdi>{f.version}</bdi>
          </p>
        )}
        {placeholder && <p className="mt-2 text-[11px] font-medium text-amber">{I.placeholderNote}</p>}
        <p className="mt-6 border-t border-border pt-3 text-[10px] font-light leading-[1.7] text-muted-foreground">{I.report.footer}</p>
      </section>
    </>
  );
}
