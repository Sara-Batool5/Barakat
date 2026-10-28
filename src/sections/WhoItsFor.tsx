import { Link } from "react-router-dom";
import { FileText, MapPin, ShieldCheck, Snowflake, Store, Truck, type LucideIcon } from "lucide-react";
import { AccentLine } from "../components/AccentLine";
import { Headline } from "../components/Headline";
import { Reveal } from "../components/Reveal";
import { useLang } from "../i18n/LanguageContext";

const icons: LucideIcon[] = [Store, Truck, Snowflake, ShieldCheck, FileText, MapPin];

export function WhoItsFor() {
  const { t } = useLang();
  return (
    <section id="who" className="border-t border-border bg-background px-5 py-24 md:px-10 lg:px-[60px]">
      <Reveal className="mx-auto mb-14 max-w-[560px] text-center">
        <AccentLine center />
        <p className="mb-4 mt-4 font-mono-label text-[10px] uppercase tracking-[0.18em] text-primary">{t.who.tag}</p>
        <h2 className="text-[clamp(36px,4vw,52px)] font-extrabold leading-[1.08] tracking-[-0.04em]">
          <Headline text={t.who.heading} />
        </h2>
        <p className="mt-3.5 text-[15px] font-light leading-[1.7] text-muted-foreground">{t.who.sub}</p>
      </Reveal>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {t.who.items.map((item, i) => {
          const Icon = icons[i];
          return (
            <Reveal key={item.name} delay={(i % 3) * 0.1}>
              <article className="card-lift flex h-full flex-col rounded-[14px] border-[1.5px] border-border bg-surface p-7">
                <p className="text-[28px] font-extrabold leading-none tracking-[-0.04em] text-primary">{item.pull}</p>
                <p className="mb-3.5 mt-1.5 text-[13px] font-light text-muted-foreground">{item.pullLabel}</p>
                <p className="mb-5 text-[14px] font-light leading-[1.8] text-foreground">{item.text}</p>
                <div className="mt-auto flex items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-raised text-primary">
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[13px] font-medium text-foreground">{item.name}</p>
                    <p className="font-mono-label text-[10px] uppercase text-muted-foreground">{item.tag}</p>
                  </div>
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>

      <div className="mt-10 flex justify-center">
        <Link
          to="/login"
          className="rounded-lg border border-border px-6 py-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          {t.who.cta}
        </Link>
      </div>
    </section>
  );
}
