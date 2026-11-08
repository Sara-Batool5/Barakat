import { setServerNow } from "../lib/serverTime";
import { supabase } from "../lib/supabase";

export type DispatchFail =
  | "local" | "unavailable" | "not_configured" | "unauthorized" | "forbidden" | "not_found"
  | "wrong_state" | "expired" | "setup" | "upstream" | "network";

export type MatchData = {
  stage: "matched" | "no_fridge" | "already" | "not_listed";
  status: string;
  fridge?: { code: string; name: string; area: string; distanceKm: number };
  offer?: { sent: boolean; reason?: "no_volunteer" | "escalated" };
};

export type Reply<T> = { ok: true; data: T } | { ok: false; code: DispatchFail };

export async function post<T>(body: Record<string, unknown>): Promise<Reply<T>> {
  if (!supabase) return { ok: false, code: "local" };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, code: "unauthorized" };

  let res: Response;
  try {
    res = await fetch("/api/dispatch", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  } catch {
    return { ok: false, code: "network" };
  }
  let json: ({ ok?: boolean; code?: string } & Record<string, unknown>) | null = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  setServerNow((json as { serverNow?: unknown } | null)?.serverNow);
  if (res.ok && json?.ok) return { ok: true, data: json as unknown as T };
  if (!json && res.status >= 400 && res.status < 500) return { ok: false, code: "unavailable" };
  const known: DispatchFail[] = ["not_configured", "unauthorized", "forbidden", "not_found", "wrong_state", "expired", "setup", "upstream"];
  const code = known.find((k) => k === json?.code);
  return { ok: false, code: code ?? "upstream" };
}

/** Asks the agent to find a fridge for a listed batch and offer the job to a volunteer. */
export const matchBatch = (batchId: string) => post<MatchData>({ action: "match", batchId });

/** A volunteer's answer to an offer. */
export const answerOffer = (jobId: string, accept: boolean) => post<{ status: string; batchStatus?: string }>({ action: "respond", jobId, accept });

/** A volunteer reports pickup or delivery. */
export const advanceTrip = (jobId: string, step: "picked_up" | "delivered") => post<{ status: string; batchStatus?: string }>({ action: "progress", jobId, step });

/** Lets the agent do its housekeeping: lapsed offers, retries, demo volunteers, expired batches. Errors are ignored. */
export async function sendTick(): Promise<void> {
  try {
    await post({ action: "tick" });
  } catch {
    /* housekeeping only */
  }
}

/** A coordinator settles an escalated batch: approve it for dispatch, or decline it with a reason. */
export const reviewBatch = (batchId: string, decision: "approve" | "decline", note?: string) =>
  post<{ status: string; match?: MatchData }>({ action: "review", batchId, decision, note: note ?? "" });
