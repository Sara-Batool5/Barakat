import type { User } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";

export type Incoming = {
  id: string;
  status: string;
  portions: number;
  submittedAt: string;
  startedAt: string;
  safeUntil: string | null;
  photo: string | null;
  restaurantName: string;
  area: string;
  items: { name: string; category: string; portions: number }[];
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

/** Batches headed to (or delivered to) the fridge this host looks after. */
export async function listIncoming(user: User): Promise<Incoming[]> {
  const sb = supabase;
  if (!sb || user.mode === "local" || !user.fridgeId) return [];
  const { data, error } = await sb
    .from("batches")
    .select("id,status,est_portions,submitted_at,prepared_at,safe_until,photo_path,restaurants(name,area),batch_items(name,category,portions)")
    .eq("fridge_id", user.fridgeId)
    .in("status", ["matched", "dispatched", "picked_up", "closed"])
    .order("submitted_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  const rows = (data ?? []) as any[];

  const paths = rows.map((r) => r.photo_path as string | null).filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    try {
      const { data: signed } = await sb.storage.from("surplus-photos").createSignedUrls(paths, 3600);
      for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    } catch {
      /* illustrations instead */
    }
  }
  return rows.map((r) => {
    const rest = one<any>(r.restaurants);
    return {
      id: r.id, status: r.status, portions: r.est_portions ?? 0, submittedAt: r.submitted_at, startedAt: r.prepared_at ?? r.submitted_at,
      safeUntil: r.safe_until ?? null, photo: r.photo_path ? urls.get(r.photo_path) ?? null : null,
      restaurantName: rest?.name ?? "", area: rest?.area ?? "",
      items: (r.batch_items ?? []).map((i: any) => ({ name: i.name, category: i.category, portions: i.portions })),
    } satisfies Incoming;
  });
}
