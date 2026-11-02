import { useEffect, useState } from "react";
import { loadDashboard } from "./api";
import type { DashboardData } from "./types";

type State = { loading: boolean; data: DashboardData | null; error: boolean };

export function useDashboard(): State {
  const [state, setState] = useState<State>({ loading: true, data: null, error: false });

  useEffect(() => {
    let alive = true;
    const load = () =>
      loadDashboard()
        .then((data) => alive && setState({ loading: false, data, error: false }))
        .catch((err) => {
          console.error(err);
          if (alive) setState((cur) => (cur.data ? cur : { loading: false, data: null, error: true }));
        });
    void load();
    // Keep the numbers fresh while the page is open (the agent works in the background).
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 20000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  return state;
}

/** Ticks every second and returns the milliseconds left until the target time, or null when there is no target. */
export function useCountdown(target: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [target]);
  if (!target) return null;
  return new Date(target).getTime() - now;
}
