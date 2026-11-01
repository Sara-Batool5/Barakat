import { supabase } from "../lib/supabase";
import type { Tier } from "./types";

export type Outcome = {
  outcome: "listed" | "rejected" | "escalated";
  status: string;
  tier: Tier;
  safeUntil: string | null;
  safeMinutes: number | null;
  reasons: { code: string; params?: Record<string, string | number> }[];
  rejectReason: string | null;
  alreadyScreened?: boolean;
};

export type ScreenResult =
  | { ok: true; data: Outcome }
  | { ok: false; code: "local" | "unavailable" | "not_configured" | "unauthorized" | "forbidden" | "not_found" | "setup" | "upstream" | "network" };

/** Asks the server's safety gate to screen a batch that was just submitted. */
export async function runSafetyCheck(batchId: string): Promise<ScreenResult> {
  if (!supabase) return { ok: false, code: "local" };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, code: "unauthorized" };

  let res: Response;
  try {
    res = await fetch("/api/screen-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ batchId }),
    });
  } catch {
    return { ok: false, code: "network" };
  }
  let body: (Outcome & { ok?: boolean; code?: string }) | null = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (res.ok && body?.ok) return { ok: true, data: body };
  if (res.status === 404 && !body?.code) return { ok: false, code: "unavailable" };
  const known = ["not_configured", "unauthorized", "forbidden", "not_found", "setup", "upstream"] as const;
  const code = known.find((k) => k === body?.code);
  if (!body && res.status >= 400 && res.status < 500) return { ok: false, code: "unavailable" };
  return { ok: false, code: code ?? "upstream" };
}
