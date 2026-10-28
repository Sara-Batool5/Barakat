import { Link } from "react-router-dom";
import { Headline } from "../components/Headline";
import { Reveal } from "../components/Reveal";
import { useLang } from "../i18n/LanguageContext";

export function CtaBanner() {
  const { t } = useLang();
  return (
    <section
      className="bg-primary px-5 py-20 text-center md:px-10 lg:px-[60px]"
      style={{
        backgroundImage: "repeating-linear-gradient(-45deg, rgba(255,255,255,0.04) 0px 6px, transparent 6px 18px)",
      }}
    >
      <Reveal className="mx-auto max-w-[620px]">
        <h2 className="text-[clamp(38px,4.5vw,58px)] font-extrabold italic leading-[1.02] tracking-[-0.04em] text-white rtl:not-italic">
          <Headline text={t.cta.heading} />
        </h2>
        <p className="mb-9 mt-5 text-[15px] font-light leading-[1.7] text-white/70">{t.cta.sub}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/login"
            className="rounded-[9px] bg-white px-8 py-3.5 text-[14px] font-bold text-primary transition-colors hover:bg-primary-light"
          >
            {t.cta.primary}
          </Link>
          <a
            href="#safety"
            className="rounded-[9px] border-[1.5px] border-white/35 px-8 py-3.5 text-[14px] font-semibold text-white transition-colors hover:border-white"
          >
            {t.cta.ghost}
          </a>
        </div>
        <ul className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-1.5 font-mono-label text-[10px] text-white/55">
          {t.cta.trust.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
