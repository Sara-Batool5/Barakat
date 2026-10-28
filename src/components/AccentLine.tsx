import { motion, useReducedMotion } from "framer-motion";

/** Small green rule that draws itself in before a section heading. */
export function AccentLine({ center = false }: { center?: boolean }) {
  const reduce = useReducedMotion();
  const origin = center ? "origin-center" : "origin-left rtl:origin-right";
  return (
    <motion.span
      aria-hidden="true"
      className={`inline-block h-0.5 w-6 bg-primary ${origin}`}
      initial={reduce ? false : { scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    />
  );
}
