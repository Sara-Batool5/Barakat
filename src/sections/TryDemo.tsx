import { Link } from "react-router-dom";
import { Store, Truck, ShieldCheck, Snowflake, type LucideIcon } from "lucide-react";
import { AccentLine } from "../components/AccentLine";
import { Headline } from "../components/Headline";
import { Reveal } from "../components/Reveal";
import { useLang } from "../i18n/LanguageContext";

const icons: LucideIcon[] = [Store, Truck, ShieldCheck, Snowflake];

/** For judges and visitors: what to try in each demo account. */
export function TryDemo() {
  const { t } = useLang();
  return (
    <section id="demo" className="border-t border-border bg-background px-5 py-24 md:px-10 lg:px-[60px]">
      <Reveal className="mx-auto mb-14 max-w-[600px] text-center">
        <AccentLine center />
        <p className="mb-4 mt-4 font-mono-label text-[10px] uppercase tracking-[0.18em] text-primary">{t.tryDemo.tag}</p>
        <h2 className="text-[clamp(32px,3.8vw,48px)] font-extrabold leading-[1.1] tracking-[-0.04em]">
          <Headline text={t.tryDemo.heading} />
        </h2>
        <p className="mt-3.5 text-[15px] font-light leading-[1.7] text-muted-foreground">{t.tryDemo.sub}</p>
      </Reveal>
      <div className="mx-auto grid max-w-[1100px] gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {t.tryDemo.roles.map((r, i) => {
          const Icon = icons[i];
          return (
            <Reveal key={r.name} delay={i * 0.08}>
              <article className="flex h-full flex-col rounded-[14px] border-[1.5px] border-border bg-surface p-6">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-primary-light text-primary">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-[15px] font-bold">{r.name}</h3>
                <p className="mt-2 text-[13px] font-light leading-[1.8] text-muted-foreground">{r.text}</p>
              </article>
            </Reveal>
          );
        })}
      </div>
      <div className="mt-10 flex flex-col items-center gap-3">
        <Link to="/login" className="rounded-lg bg-primary px-7 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark">{t.tryDemo.cta}</Link>
        <p className="text-[12px] font-light text-muted-foreground">{t.tryDemo.note}</p>
      </div>
    </section>
  );
}
