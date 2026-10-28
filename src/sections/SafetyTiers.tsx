import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { AccentLine } from "../components/AccentLine";
import { Headline } from "../components/Headline";
import { Reveal } from "../components/Reveal";
import { useLang } from "../i18n/LanguageContext";

const dots = ["bg-primary", "bg-amber", "bg-danger"];
const ticks = ["text-primary", "text-amber", "text-danger"];

export function SafetyTiers() {
  const { t } = useLang();
  return (
    <section id="safety" className="border-t border-border bg-surface px-5 py-24 md:px-10 lg:px-[60px]">
      <Reveal className="mb-14 grid items-end gap-6 md:grid-cols-2 md:gap-20">
        <div>
          <AccentLine />
          <p className="mb-4 mt-4 font-mono-label text-[10px] uppercase tracking-[0.18em] text-primary">
            {t.safety.tag}
          </p>
          <h2 className="text-[clamp(36px,4vw,52px)] font-extrabold leading-[1.08] tracking-[-0.04em]">
            <Headline text={t.safety.heading} />
          </h2>
        </div>
        <p className="text-[14px] font-light leading-[1.8] text-muted-foreground">{t.safety.sub}</p>
      </Reveal>

      <div className="grid gap-4 md:grid-cols-3 md:items-stretch">
        {t.safety.cards.map((card, i) => {
          const featured = i === 1;
          return (
            <Reveal key={card.name} delay={i * 0.1} className={featured ? "md:-my-2" : ""}>
              <article
                className={`card-lift flex h-full flex-col rounded-[14px] border-[1.5px] bg-background p-8 ${
                  featured ? "border-primary shadow-[0_8px_32px_rgba(45,154,78,0.12)]" : "border-border"
                }`}
              >
                {card.badge && (
                  <span className="mb-4 inline-block self-start rounded bg-primary-light px-2.5 py-1 font-mono-label text-[10px] uppercase text-primary">
                    {card.badge}
                  </span>
                )}
                <p className="font-mono-label text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {card.tag}
                </p>
                <h3 className="mt-2 flex items-center gap-2.5 text-[26px] font-bold tracking-[-0.02em]">
                  <span className={`h-3 w-3 rounded-full ${dots[i]}`} aria-hidden="true" />
                  {card.name}
                </h3>
                <p className="mt-1 text-[12px] font-medium text-muted-foreground">{card.sub}</p>
                <p className="mt-4 text-[14px] font-light leading-[1.75] text-muted-foreground">{card.desc}</p>
                <ul className="mt-5 flex flex-col gap-2.5">
                  {card.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[13px] font-medium text-foreground">
                      <Check size={14} strokeWidth={3} className={`mt-[3px] shrink-0 ${ticks[i]}`} aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
                  <span className="font-mono-label text-[11px] uppercase text-muted-foreground">
                    {t.safety.outcomeLabel}
                  </span>
                  <span className="text-[12px] font-semibold text-primary">{card.outcome}</span>
                </div>
                {card.button && (
                  <Link
                    to="/login"
                    className="mt-4 rounded-lg bg-primary px-5 py-3 text-center text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark"
                  >
                    {card.button}
                  </Link>
                )}
              </article>
            </Reveal>
          );
        })}
      </div>

      <p className="mx-auto mt-10 max-w-[640px] text-center text-[12px] font-light leading-[1.8] text-muted-foreground">
        {t.safety.note}
      </p>
    </section>
  );
}
