import { useEffect, useState } from "react";
import { nowMs } from "./serverTime";

/** The current time in milliseconds (server-corrected), refreshed every `everyMs` (default one second). */
export function useNow(everyMs = 1000): number {
  const [now, setNow] = useState(() => nowMs());
  useEffect(() => {
    const id = window.setInterval(() => setNow(nowMs()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}
