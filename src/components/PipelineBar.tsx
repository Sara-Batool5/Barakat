import { ArrowRight } from "lucide-react";
import type { ActivityStats } from "../data/activity";
import { useLang } from "../i18n/LanguageContext";

const order = ["draft", "listed", "matched", "transit", "escalated"] as const;

/** Where the batches are right now, from "waiting for the agent" to "needs a coordinator". */
export function PipelineBar({ pipeline }: { pipeline: ActivityStats["pipeline"] }) {
  const { t } = useLang();
  return (
    <ol className="flex flex-wrap items-stretch gap-2" aria-label={t.activity.pipelineTitle}>
      {order.map((key, i) => {
        const n = pipeline[key];
        const alert = key === "escalated" && n > 0;
        return (
          <li key={key} className="flex items-center gap-2">
            <div className={`min-w-[132px] rounded-xl border-[1.5px] px-4 py-3 ${alert ? "border-amber bg-amber-light" : "border-border bg-white"}`}>
              <p className={`text-[26px] font-extrabold leading-none tracking-[-0.04em] ${alert ? "text-amber" : n > 0 ? "text-primary" : "text-subtle"}`}><bdi>{n}</bdi></p>
              <p className="mt-1.5 text-[11px] font-medium leading-[1.4] text-muted-foreground">{t.activity.stages[key]}</p>
            </div>
            {i < order.length - 2 && <ArrowRight size={14} className="rtl-flip text-subtle" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
