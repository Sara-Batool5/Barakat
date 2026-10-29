import { useLang } from "../i18n/LanguageContext";
import { useCountdown, useDashboard } from "../data/useDashboard";
import { fmtClock, fmtNumber, timeAgo } from "../lib/format";
import type { Tier } from "../data/types";

const tierIndex: Record<Tier, number> = { green: 0, amber: 1, red: 2 };
const tierStyle: Record<Tier, string> = {
  green: "bg-primary-light text-primary",
  amber: "bg-amber-light text-amber",
  red: "bg-danger-light text-danger",
};

function statusStyle(status: string): string {
  if (status === "closed" || status === "delivered") return "text-primary";
  if (status === "rejected" || status === "expired") return "text-danger";
  if (status === "escalated") return "text-amber";
  return "text-foreground";
}

export function Dashboard() {
  const { t, lang } = useLang();
  const { loading, data, error } = useDashboard();
  const remaining = useCountdown(data?.nextSafeUntil ?? null);
  const d = t.app.dash;

  if (loading) {
    return (
      <p className="mt-8 text-[13px] text-muted-foreground" role="status">
        {d.loading}
      </p>
    );
  }
  if (error || !data) {
    return (
      <p className="mt-8 text-[13px] text-danger" role="alert">
        {d.loadError}
      </p>
    );
  }

  const sourceLabel = data.fellBack ? d.sourceFallback : data.source === "supabase" ? d.sourceSupabase : d.sourceSample;
  const clock = remaining !== null ? fmtClock(remaining) : null;
  const cards = [
    {
      label: d.cards[0].label,
      value: fmtNumber(data.activeRescues),
      note: data.reviewQueue > 0 ? `${data.reviewQueue} ${d.inReview}` : d.cards[0].note,
    },
    { label: d.cards[1].label, value: clock ?? "--:--:--", note: clock ? d.cards[1].note : d.noActive },
    { label: d.cards[2].label, value: fmtNumber(data.totals.meals), note: d.cards[2].note },
    { label: d.cards[3].label, value: `${fmtNumber(data.totals.co2eKg)} kg`, note: d.cards[3].note },
  ];
  const fullest = data.fridges
    .filter((f) => f.status === "active")
    .sort((a, b) => b.stock / b.capacity - a.stock / a.capacity)
    .slice(0, 8);
  const statusLabels = d.status;

  return (
    <div className="mt-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold ${
            data.fellBack ? "bg-amber-light text-amber" : "bg-primary-light text-primary"
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          {sourceLabel}
        </span>
        <span className="text-[11px] font-light text-muted-foreground">{d.sampleNote}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-[14px] border-[1.5px] border-border bg-white p-5">
            <p className="text-[12px] font-medium text-muted-foreground">{c.label}</p>
            <p className="mt-3 text-[30px] font-extrabold tracking-[-0.04em] text-foreground">
              <bdi>{c.value}</bdi>
            </p>
            <p className="mt-1 text-[12px] font-light text-muted-foreground">{c.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <section className="rounded-[14px] border-[1.5px] border-border bg-white p-5 xl:col-span-3">
          <h2 className="text-[14px] font-bold">{d.recentTitle}</h2>
          {data.recent.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted-foreground">{d.empty}</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-start text-[12px]">
                <caption className="sr-only">{d.recentTitle}</caption>
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    {[d.cols.venue, d.cols.food, d.cols.portions, d.cols.tier, d.cols.status, d.cols.when].map((h) => (
                      <th key={h} scope="col" className="py-2 pe-3 text-start font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((b) => (
                    <tr key={b.id} className="border-b border-border/70 last:border-0">
                      <td className="py-2.5 pe-3">
                        <p className="font-semibold text-foreground">{b.restaurantName}</p>
                        <p className="text-[11px] font-light text-muted-foreground">{b.area}</p>
                      </td>
                      <td className="py-2.5 pe-3 font-light text-foreground">
                        {b.items[0]}
                        {b.items.length > 1 && (
                          <span className="text-muted-foreground">
                            {" "}
                            +{b.items.length - 1} {d.more}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pe-3 font-medium text-foreground">{b.portions}</td>
                      <td className="py-2.5 pe-3">
                        {b.tier && (
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tierStyle[b.tier]}`}>
                            {t.safety.cards[tierIndex[b.tier]].name}
                          </span>
                        )}
                      </td>
                      <td className={`py-2.5 pe-3 font-medium ${statusStyle(b.status)}`}>
                        {statusLabels[b.status] ?? b.status}
                      </td>
                      <td className="py-2.5 text-muted-foreground">{timeAgo(b.submittedAt, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-[14px] border-[1.5px] border-border bg-white p-5 xl:col-span-2">
          <h2 className="text-[14px] font-bold">{d.fridgesTitle}</h2>
          <p className="text-[11px] font-light text-muted-foreground">{d.fridgesSub}</p>
          <ul className="mt-4 flex flex-col gap-3.5">
            {fullest.map((f) => {
              const pct = Math.min(100, Math.round((f.stock / f.capacity) * 100));
              return (
                <li key={f.id}>
                  <div className="flex items-baseline justify-between gap-3 text-[12px]">
                    <span className="min-w-0 truncate">
                      <span className="font-semibold text-foreground">{f.code}</span>{" "}
                      <span className="font-light text-muted-foreground">{f.name}</span>
                    </span>
                    <span className="shrink-0 font-medium text-foreground">
                      <bdi>
                        {f.stock}/{f.capacity}
                      </bdi>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-raised" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <p className="mt-5 text-[12px] font-light text-muted-foreground">
        {fmtNumber(data.counts.fridges)} {d.counts.fridges} · {fmtNumber(data.counts.restaurants)} {d.counts.venues} ·{" "}
        {fmtNumber(data.counts.volunteers)} {d.counts.volunteers} · {fmtNumber(data.counts.batches)} {d.counts.batches}
      </p>
    </div>
  );
}
