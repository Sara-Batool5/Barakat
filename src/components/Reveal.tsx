import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

type Props = { children: ReactNode; delay?: number; className?: string };

/** Fades content up once when it scrolls into view. Skipped when the visitor prefers reduced motion. */
export function Reveal({ children, delay = 0, className }: Props) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
