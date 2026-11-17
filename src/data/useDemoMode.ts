import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";

/**
 * Whether the demo helpers (sample dishes, refresh and clear buttons) are switched on.
 * Local mode (no database) always has them. With a database they follow app_config.demo_mode.
 */
export function useDemoMode(): boolean {
  const { user } = useAuth();
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!supabase || user.mode === "local") {
      setOn(true);
      return;
    }
    let alive = true;
    supabase
      .from("app_config")
      .select("value")
      .eq("key", "demo_mode")
      .maybeSingle()
      .then(({ data }) => alive && setOn((data?.value as { enabled?: boolean } | undefined)?.enabled === true));
    return () => {
      alive = false;
    };
  }, [user?.id, user?.mode]);

  return on;
}
