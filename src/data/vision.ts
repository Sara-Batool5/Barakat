import { supabase } from "../lib/supabase";
import { blobToDataUrl } from "../lib/image";

export type VisionItem = { name: string; category: string; portions: number; allergens: string[]; confidence: number };
export type VisionResult = {
  isFood: boolean;
  confidence: number;
  photoQuality: "good" | "fair" | "poor";
  summary: string;
  items: VisionItem[];
};

export type AnalyzeOutcome =
  | { ok: true; analysisId: string; model: string; result: VisionResult }
  | { ok: false; code: "local" | "unavailable" | "not_configured" | "unauthorized" | "forbidden" | "rate_limited" | "too_large" | "blocked" | "upstream" | "network" };

/** Sends the (already compressed) photo to the agent's vision step on the server. */
export async function analyzePhoto(photo: Blob): Promise<AnalyzeOutcome> {
  if (!supabase) return { ok: false, code: "local" };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, code: "unauthorized" };

  const dataUrl = await blobToDataUrl(photo);
  const imageBase64 = dataUrl.slice(dataUrl.indexOf(",") + 1);

  let res: Response;
  try {
    res = await fetch("/api/analyze-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ imageBase64, mimeType: "image/jpeg" }),
    });
  } catch {
    return { ok: false, code: "network" };
  }

  let body: { ok?: boolean; code?: string; analysisId?: string; model?: string; result?: VisionResult } | null = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (res.ok && body?.ok && body.analysisId && body.result) {
    return { ok: true, analysisId: body.analysisId, model: body.model ?? "", result: body.result };
  }
  if (res.status === 404 || (!body && res.status >= 400 && res.status < 500)) return { ok: false, code: "unavailable" };
  const known = ["not_configured", "unauthorized", "forbidden", "rate_limited", "too_large", "blocked", "upstream"] as const;
  const code = known.find((k) => k === body?.code);
  return { ok: false, code: code ?? "upstream" };
}
