import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { AccentLine } from "../components/AccentLine";
import { Headline } from "../components/Headline";
import { Reveal } from "../components/Reveal";
import { useLang } from "../i18n/LanguageContext";

const toneDot: Record<string, string> = {
  neutral: "bg-subtle",
  amber: "bg-amber",
  green: "bg-primary",
};

function Timeline() {
  const { t } = useLang();
  const reduce = useReducedMotion();
  const tl = t.agent.timeline;
  return (
    <div className="relative">
      <div className="rounded-[14px] border-[1.5px] border-border bg-background p-6 shadow-[0_12px_40px_rgba(12,23,12,0.06)]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="text-[14px] font-bold">{tl.title}</p>
          <span className="rounded bg-primary-light px-2 py-0.5 font-mono-label text-[10px] text-primary">
            {tl.sample}
          </span>
        </div>
        <ol className="relative flex flex-col gap-5 before:absolute before:inset-y-2 before:start-[57px] before:w-px before:bg-border">
          {tl.rows.map((row, i) => (
            <motion.li
              key={row.title}
              className="relative flex items-start gap-3"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-70px" }}
              transition={{ duration: 0.45, ease: "easeOut", delay: i * 0.18 }}
            >
              <span className="w-10 shrink-0 pt-0.5 font-mono-label text-[11px] text-muted-foreground">{row.t}</span>
              <span
                className={`relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-background ${toneDot[row.tone]}`}
                aria-hidden="true"
              />
              <div>
                <p className="text-[13px] font-semibold text-foreground">{row.title}</p>
                <p className="text-[12px] font-light leading-[1.6] text-muted-foreground">{row.detail}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
      <div className="absolute -bottom-4 start-4 flex items-center gap-2 rounded-lg border border-border bg-white px-3.5 py-2.5 shadow-[0_8px_24px_rgba(12,23,12,0.08)]">
        <ShieldCheck size={14} className="text-primary" aria-hidden="true" />
        <span className="font-mono-label text-[10px] text-muted-foreground">{tl.badge}</span>
      </div>
    </div>
  );
}

export function AgentSection() {
  const { t } = useLang();
  return (
    <section
      id="agent"
      className="grid items-center gap-16 border-t border-border bg-surface px-5 py-24 md:px-10 lg:grid-cols-2 lg:gap-20 lg:px-[60px]"
    >
      <Reveal>
        <Timeline />
      </Reveal>

      <Reveal delay={0.1} className="flex flex-col gap-6">
        <div>
          <AccentLine />
          <p className="mb-4 mt-4 font-mono-label text-[10px] uppercase tracking-[0.16em] text-primary">
            {t.agent.tag}
          </p>
          <h2 className="text-[clamp(32px,3.5vw,44px)] font-extrabold leading-[1.1] tracking-[-0.04em]">
            <Headline text={t.agent.heading} />
          </h2>
        </div>
        <p className="text-[15px] font-light leading-[1.9] text-muted-foreground">{t.agent.p1}</p>
        <p className="text-[15px] font-light leading-[1.9] text-muted-foreground">{t.agent.p2}</p>
        <ul className="mt-1 flex flex-wrap gap-3">
          {t.agent.chips.map((chip) => (
            <li
              key={chip}
              className="rounded-full border border-primary-muted bg-primary-light px-3 py-[5px] font-mono-label text-[11px] font-semibold text-primary"
            >
              {chip}
            </li>
          ))}
        </ul>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 self-start border-b border-primary pb-0.5 text-[13px] font-semibold text-primary"
        >
          {t.agent.link}
          <ArrowRight size={14} className="rtl-flip" aria-hidden="true" />
        </Link>
      </Reveal>
    </section>
  );
}
