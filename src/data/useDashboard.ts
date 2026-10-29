import { useEffect, useState } from "react";
import { loadDashboard } from "./api";
import type { DashboardData } from "./types";

type State = { loading: boolean; data: DashboardData | null; error: boolean };

export function useDashboard(): State {
  const [state, setState] = useState<State>({ loading: true, data: null, error: false });

  useEffect(() => {
    let alive = true;
    loadDashboard()
      .then((data) => alive && setState({ loading: false, data, error: false }))
      .catch((err) => {
        console.error(err);
        if (alive) setState({ loading: false, data: null, error: true });
      });
    return () => {
      alive = false;
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
