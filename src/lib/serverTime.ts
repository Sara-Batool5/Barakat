/**
 * The server's clock, as last reported by the agent. Offers and countdowns use it, so a wrong clock on
 * the visitor's phone or laptop cannot make an offer look expired (or a safe window look longer than it is).
 */
let offsetMs = 0;

export function setServerNow(iso: unknown): void {
  if (typeof iso !== "string") return;
  const t = Date.parse(iso);
  if (!Number.isNaN(t)) offsetMs = t - Date.now();
}

export const nowMs = (): number => Date.now() + offsetMs;
