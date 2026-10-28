import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";

const col = {
  primary: "hsl(var(--primary))",
  dark: "hsl(var(--primary-dark))",
  light: "hsl(var(--primary-light))",
  muted: "hsl(var(--primary-muted))",
  border: "hsl(var(--border))",
  bg: "hsl(var(--background))",
};

const ROUTE = "M150 520 C230 520 250 400 330 380 S420 340 440 330";

function Fridge({ x, y, scale = 1, active = false }: { x: number; y: number; scale?: number; active?: boolean }) {
  const line = active ? "#ffffff" : col.primary;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect
        x={-11}
        y={-15}
        width={22}
        height={30}
        rx={5}
        style={{ fill: active ? col.primary : col.light, stroke: active ? col.dark : col.primary, strokeWidth: 2 }}
      />
      <g style={{ stroke: line, strokeWidth: 2, strokeLinecap: "round" }}>
        <line x1={-11} y1={-3} x2={11} y2={-3} />
        <line x1={-6} y1={-9} x2={-6} y2={-6} />
        <line x1={-6} y1={3} x2={-6} y2={8} />
      </g>
    </g>
  );
}

function Ring() {
  const reduce = useReducedMotion();
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4" style={{ stroke: col.border }} />
      <g transform="rotate(-90 22 22)">
        <motion.circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          style={{ stroke: col.primary }}
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 0.64 }}
          transition={{ duration: 1.2, delay: 1.1, ease: "easeOut" }}
        />
      </g>
    </svg>
  );
}

export function HeroVisual() {
  const { t, dir } = useLang();
  const reduce = useReducedMotion();
  const s = dir === "rtl" ? -1 : 1;
  const shadow = "shadow-[0_12px_40px_rgba(12,23,12,0.13)]";

  return (
    <div className="relative min-h-[420px] overflow-hidden bg-surface md:min-h-0">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 600 800"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={t.hero.art}
      >
        <defs>
          <pattern id="hero-dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.1" style={{ fill: col.border }} />
          </pattern>
        </defs>
        <rect width="600" height="800" fill="url(#hero-dots)" />

        <g style={{ fill: "none", stroke: col.bg, strokeWidth: 16, strokeLinecap: "round" }}>
          <path d="M-20 600 C150 560 260 650 430 560 S600 470 640 430" />
          <path d="M110 -20 C170 160 80 300 190 430 S340 660 300 820" />
          <path d="M-20 250 C150 290 330 200 640 270" />
          <path d="M520 -20 C500 120 560 200 520 330 S560 520 600 600" />
        </g>

        <path
          d="M0 800 V716 H36 V690 H66 V724 H98 V676 H128 V740 H170 V700 H200 V664 H214 V620 H223 V540 H227 V486 H231 V540 H235 V620 H244 V664 H260 V712 H300 V684 H332 V730 H372 V692 H412 V724 H452 V668 H482 V714 H522 V676 H562 V724 H600 V800 Z"
          opacity="0.38"
          style={{ fill: col.muted }}
        />

        <Fridge x={262} y={232} />
        <Fridge x={92} y={318} />
        <Fridge x={504} y={580} />

        <path
          d={ROUTE}
          style={{ fill: "none", stroke: col.muted, strokeWidth: 3, strokeDasharray: "2 9", strokeLinecap: "round" }}
        />
        <motion.path
          d={ROUTE}
          style={{ fill: "none", stroke: col.primary, strokeWidth: 4, strokeLinecap: "round" }}
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, delay: 0.6, ease: "easeInOut" }}
        />

        <circle cx="440" cy="330" r="26" opacity="0.18" style={{ fill: col.primary }}>
          {!reduce && <animate attributeName="r" values="22;40;22" dur="3s" repeatCount="indefinite" />}
        </circle>
        <Fridge x={440} y={330} scale={1.25} active />

        <g transform="translate(150 520)">
          <circle r="15" style={{ fill: col.dark }} />
          <path d="M-7 3 L0 -7 L7 3 V8 H-7 Z" fill="#ffffff" />
        </g>

        {!reduce && (
          <circle r="7" opacity="0" style={{ fill: col.primary, stroke: col.bg, strokeWidth: 3 }}>
            <animateMotion dur="5s" repeatCount="indefinite" path={ROUTE} />
            <animate attributeName="opacity" from="0" to="1" begin="2.4s" dur="0.3s" fill="freeze" />
          </circle>
        )}
      </svg>

      {/* Floating card: safe-window clock */}
      <div className="float-a absolute bottom-20 start-6 hidden md:block">
        <motion.div
          className={`min-w-[210px] rounded-xl bg-white px-[18px] py-3.5 ${shadow}`}
          initial={reduce ? false : { opacity: 0, x: -24 * s, y: 16 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.7 }}
        >
          <p className="font-mono-label text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {t.hero.safeCard.label}
          </p>
          <div className="mt-2.5 flex items-center gap-3">
            <Ring />
            <div>
              <p className="text-[13px] font-bold text-foreground">{t.hero.safeCard.title}</p>
              <p className="text-[12px] text-muted-foreground">
                <span className="font-semibold text-primary">{t.hero.safeCard.left}</span> {t.hero.safeCard.leftLabel}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Floating card: agent activity feed */}
      <div className="float-b absolute end-6 top-20 hidden md:block">
        <motion.div
          className={`w-[230px] rounded-xl bg-white px-[18px] py-4 ${shadow}`}
          initial={reduce ? false : { opacity: 0, x: 24 * s, y: -16 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.9 }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] font-bold text-foreground">{t.hero.feed.title}</p>
            <span className="rounded bg-primary-light px-1.5 py-0.5 font-mono-label text-[9px] text-primary">
              {t.hero.feed.sample}
            </span>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {t.hero.feed.items.map((item, i) => (
              <motion.li
                key={item}
                className="flex items-start gap-2 text-[12px] leading-[1.45] text-muted-foreground"
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut", delay: 1.5 + i * 0.5 }}
              >
                <span className="mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-primary-light text-primary">
                  <Check size={9} strokeWidth={3} aria-hidden="true" />
                </span>
                <span>{item}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
