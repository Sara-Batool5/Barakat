import { Link } from "react-router-dom";
import { Accordion } from "../components/Accordion";
import { AccentLine } from "../components/AccentLine";
import { Headline } from "../components/Headline";
import { Reveal } from "../components/Reveal";
import { useLang } from "../i18n/LanguageContext";

export function Faq() {
  const { t } = useLang();
  return (
    <section
      id="faq"
      className="grid gap-12 border-t border-border bg-background px-5 py-20 md:px-10 lg:grid-cols-2 lg:gap-20 lg:px-[60px]"
    >
      <Reveal>
        <AccentLine />
        <h2 className="mt-4 text-[clamp(32px,3.5vw,44px)] font-extrabold leading-[1.1] tracking-[-0.04em]">
          <Headline text={t.faq.heading} />
        </h2>
        <p className="mt-4 max-w-[380px] text-[14px] font-light leading-[1.85] text-muted-foreground">{t.faq.sub}</p>
        <Link
          to="/login"
          className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          {t.faq.button}
        </Link>
      </Reveal>
      <Reveal delay={0.1}>
        <Accordion items={t.faq.items} />
      </Reveal>
    </section>
  );
}
