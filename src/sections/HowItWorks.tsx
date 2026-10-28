import { Link } from "react-router-dom";
import { AccentLine } from "../components/AccentLine";
import { CountUp } from "../components/CountUp";
import { Headline } from "../components/Headline";
import { Reveal } from "../components/Reveal";
import { useLang } from "../i18n/LanguageContext";

export function HowItWorks() {
  const { t } = useLang();
  return (
    <section id="how" className="bg-dark-green px-5 py-24 md:px-10 lg:px-[60px]">
      <Reveal className="mb-16 max-w-[560px]">
        <AccentLine />
        <p className="mb-4 mt-4 font-mono-label text-[10px] uppercase tracking-[0.18em] text-primary">{t.how.tag}</p>
        <h2 className="text-[clamp(36px,4vw,52px)] font-extrabold leading-[1.08] tracking-[-0.04em] text-white">
          <Headline text={t.how.heading} />
        </h2>
      </Reveal>

      <ol className="grid border border-dark-border md:grid-cols-2 lg:grid-cols-4">
        {t.how.steps.map((step, i) => (
          <li
            key={step.name}
            className="border-b border-dark-border p-8 last:border-b-0 md:border-e md:[&:nth-child(2n)]:border-e-0 lg:border-b-0 lg:[&:nth-child(2n)]:border-e lg:last:border-e-0"
          >
            <Reveal delay={i * 0.1}>
              <p
                className="mb-5 text-[clamp(36px,4vw,48px)] font-extrabold leading-none text-white/[0.07]"
                aria-hidden="true"
              >
                <CountUp to={i + 1} />
              </p>
              <h3 className="mb-2.5 text-[15px] font-semibold text-white">{step.name}</h3>
              <p className="text-[13px] font-light leading-[1.75] text-white/45">{step.desc}</p>
            </Reveal>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex justify-center">
        <Link
          to="/login"
          className="rounded-lg bg-primary px-7 py-[13px] text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          {t.how.cta}
        </Link>
      </div>
    </section>
  );
}
