import { Brain, Scale, ShieldCheck, Sprout, type LucideIcon } from "lucide-react";
import { AccentLine } from "../components/AccentLine";
import { Headline } from "../components/Headline";
import { Reveal } from "../components/Reveal";
import { useLang } from "../i18n/LanguageContext";

const icons: LucideIcon[] = [Brain, Scale, ShieldCheck, Sprout];

/** Why BARAKAT is a real agent, not a form with a database. */
export function Proof() {
  const { t } = useLang();
  return (
    <section id="proof" className="border-t border-border bg-surface px-5 py-24 md:px-10 lg:px-[60px]">
      <Reveal className="mx-auto mb-14 max-w-[600px] text-center">
        <AccentLine center />
        <p className="mb-4 mt-4 font-mono-label text-[10px] uppercase tracking-[0.18em] text-primary">{t.proof.tag}</p>
        <h2 className="text-[clamp(32px,3.8vw,48px)] font-extrabold leading-[1.1] tracking-[-0.04em]">
          <Headline text={t.proof.heading} />
        </h2>
        <p className="mt-3.5 text-[15px] font-light leading-[1.7] text-muted-foreground">{t.proof.sub}</p>
      </Reveal>
      <div className="mx-auto grid max-w-[1100px] gap-5 md:grid-cols-2">
        {t.proof.items.map((item, i) => {
          const Icon = icons[i];
          return (
            <Reveal key={item.title} delay={(i % 2) * 0.1}>
              <article className="card-lift flex h-full gap-5 rounded-[14px] border-[1.5px] border-border bg-white p-7">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-light text-primary">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-[16px] font-bold tracking-[-0.01em]">{item.title}</h3>
                  <p className="mt-2 text-[14px] font-light leading-[1.8] text-muted-foreground">{item.text}</p>
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
