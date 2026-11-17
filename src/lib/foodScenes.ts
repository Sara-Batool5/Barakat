/** Loader for the food illustrations (drawn by tools/food_art.py). Loaded on demand and cached. */
export type Shape = {
  t: "r" | "e" | "p" | "l";
  x?: number; y?: number; w?: number; h?: number; rx?: number; ry?: number;
  cx?: number; cy?: number; d?: string;
  x1?: number; y1?: number; x2?: number; y2?: number;
  f?: string; s?: string; sw?: number; o?: number; rot?: number;
};
export type Scenes = Record<string, Shape[]>;

export const sceneCache = new Map<string, Shape[]>();
let loading: Promise<Scenes> | null = null;

export function loadScenes(): Promise<Scenes> {
  if (!loading) {
    loading = import("../data/foodScenes.json").then((m) => {
      const all = ((m as { default?: unknown }).default ?? m) as unknown as Scenes;
      for (const k of Object.keys(all)) sceneCache.set(k, all[k]);
      return all;
    });
  }
  return loading;
}
