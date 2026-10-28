import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { AccentLine } from "../components/AccentLine";
import { HeroVisual } from "../components/HeroVisual";
import { useLang } from "../i18n/LanguageContext";

export function Hero() {
  const { t } = useLang();
  const reduce = useReducedMotion();

  const rise = (delay: number) =>
    reduce
      ? {}
      : ({
          initial: { opacity: 0, y: 28 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, ease: "easeOut", delay },
        } as const);

  return (
    <section className="grid min-h-screen pt-[72px] md:grid-cols-2">
      <div className="flex flex-col justify-center bg-background px-5 py-14 md:px-10 md:py-20 lg:px-[60px]">
        <motion.div className="mb-7 flex items-center gap-2.5" {...rise(0.1)}>
          <AccentLine />
          <span className="font-mono-label text-[10px] uppercase tracking-[0.18em] text-primary">{t.hero.tag}</span>
        </motion.div>

        <h1 className="mb-[22px] text-[clamp(40px,5vw,64px)] font-extrabold leading-[1.08] tracking-[-0.04em]">
          <motion.span className="block" {...rise(0.2)}>
            {t.hero.line1}
          </motion.span>
          <motion.span className="block text-primary" {...rise(0.32)}>
            {t.hero.line2}
          </motion.span>
          <motion.span className="block" {...rise(0.44)}>
            {t.hero.line3}
          </motion.span>
        </h1>

        <motion.p
          className="mb-10 max-w-[440px] text-[15px] font-light leading-[1.85] text-muted-foreground"
          {...rise(0.55)}
        >
          {t.hero.sub}
        </motion.p>

        <motion.div className="mb-12 flex flex-wrap gap-2.5" {...rise(0.65)}>
          <Link
            to="/login"
            className="rounded-lg bg-primary px-[26px] py-[13px] text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            {t.hero.ctaPrimary}
          </Link>
          <a
            href="#how"
            className="rounded-lg border-[1.5px] border-border px-[26px] py-[13px] text-[13px] font-semibold text-foreground transition-colors hover:border-foreground"
          >
            {t.hero.ctaGhost}
          </a>
        </motion.div>

        <motion.dl className="flex flex-wrap gap-x-8 gap-y-5" {...rise(0.8)}>
          {t.hero.stats.map((s) => (
            <div key={s.l} className="flex flex-col gap-[3px]">
              <dt className="text-2xl font-extrabold tracking-[-0.04em] text-foreground">{s.v}</dt>
              <dd className="m-0 max-w-[130px] text-[11px] font-light leading-[1.5] text-muted-foreground">{s.l}</dd>
            </div>
          ))}
        </motion.dl>
      </div>

      <HeroVisual />
    </section>
  );
}
