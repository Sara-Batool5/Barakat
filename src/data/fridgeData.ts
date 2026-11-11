import type { User } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";
import { post } from "./dispatch";

export type MyFridgeData = {
  fridge: { id: string; code: string; name: string; area: string; stock: number; capacity: number; reserved: number; status: string; open24h: boolean; openFrom: string | null; openTo: string | null };
  log: { id: string; delta: number; reason: string; createdAt: string }[];
};

export async function loadMyFridge(user: User): Promise<MyFridgeData | null> {
  const sb = supabase;
  if (!sb || user.mode === "local" || !user.fridgeId) return null;
  const [f, l] = await Promise.all([
    sb.from("fridges").select("id,code,name,area,capacity_portions,current_stock,reserved_portions,status,open_24h,open_from,open_to").eq("id", user.fridgeId).maybeSingle(),
    sb.from("fridge_stock_log").select("id,delta_portions,reason,created_at").eq("fridge_id", user.fridgeId).order("created_at", { ascending: false }).limit(15),
  ]);
  if (f.error) throw f.error;
  const r: any = f.data;
  if (!r) return null;
  return {
    fridge: { id: r.id, code: r.code, name: r.name, area: r.area, stock: r.current_stock, capacity: r.capacity_portions, reserved: r.reserved_portions ?? 0, status: r.status, open24h: !!r.open_24h, openFrom: r.open_from ?? null, openTo: r.open_to ?? null },
    log: ((l.data ?? []) as any[]).map((x) => ({ id: x.id, delta: x.delta_portions, reason: x.reason, createdAt: x.created_at })),
  };
}

/** The host records portions taken by people, or removed because they expired. */
export const recordStock = (fridgeId: string, portions: number, reason: "taken" | "expired") =>
  post<{ stock: number; removed: number }>({ action: "fridge_stock", fridgeId, portions, reason });

/** Pause or resume deliveries to a fridge. */
export async function setFridgeStatus(fridgeId: string, status: "active" | "paused"): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.from("fridges").update({ status }).eq("id", fridgeId).select("id");
  return !error && (data ?? []).length > 0;
}
