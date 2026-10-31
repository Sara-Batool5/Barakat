import { useEffect, useState } from "react";

type Shape = {
  t: "r" | "e" | "p" | "l";
  x?: number; y?: number; w?: number; h?: number; rx?: number; ry?: number;
  cx?: number; cy?: number; d?: string;
  x1?: number; y1?: number; x2?: number; y2?: number;
  f?: string; s?: string; sw?: number; o?: number; rot?: number;
};
type Scenes = Record<string, Shape[]>;

/** Sample item name -> illustration. Real uploaded photos always win over these. */
const BY_NAME: Record<string, string> = {
  "Chicken biryani trays": "rice_biryani", "Lamb ouzi rice trays": "rice_lamb", "Vegetable korma with rice": "curry_korma",
  "Grilled chicken and rice boxes": "rice_grilled", "Chickpea curry (chana masala)": "curry_chana", "Pasta primavera trays": "pasta",
  "Lentil dal and rice": "rice_dal", "Stuffed vine leaves": "stuffed_vine", "Baked fish with rice": "baked_fish",
  "Moussaka trays": "moussaka", "Falafel and hummus boxes": "falafel_box", "Chicken kabsa trays": "rice_kabsa",
  "Falafel wraps": "wrap_falafel", "Chicken club sandwiches": "club_sandwich", "Tuna salad boxes": "tuna_salad",
  "Greek salad boxes": "greek_salad", "Fruit cups": "fruit_cup", "Hummus and pita boxes": "hummus_pita",
  "Halloumi and veggie wraps": "wrap_halloumi", "Assorted bread rolls": "bread_rolls", Croissants: "croissants",
  "Date and nut loaves": "date_loaf", "Cheese manakish": "manakish", "Baked samosas": "samosas",
  "Baklava assortment": "baklava", "Pide bread": "pide", "Umm Ali pots": "umm_ali", "Rice pudding cups": "rice_pudding",
  "Yoghurt cups": "yoghurt_cups", "Cheesecake slices": "cheesecake", "Kunafa trays": "kunafa",
  "Sealed snack boxes": "snack_boxes", "Packaged granola bars": "granola_bars", "Crackers and cheese packs": "crackers_cheese",
  "Sealed date boxes": "date_boxes", "Whole bananas and apples": "bananas_apples", "Oranges and mandarins": "oranges",
  "Tomatoes and cucumbers (whole)": "tomato_cucumber", "Sealed juice bottles": "juice_bottles",
  "Sealed water bottles": "water_bottles", "Sealed iced tea cans": "iced_tea", "Raw chicken portions": "raw_chicken",
  "Raw salmon fillets": "raw_salmon", "Returned buffet plates": "plate_leftovers", "Unlabelled container": "unlabelled",
};

/** When the name is not one of the samples (for example a new item typed by a restaurant), pick by category. */
const BY_CATEGORY: Record<string, string> = {
  cooked_chilled: "rice_biryani", sandwiches_salads: "greek_salad", bakery_ambient: "bread_rolls", dairy_desserts: "rice_pudding",
  packaged_sealed: "snack_boxes", produce_whole: "oranges", beverages_sealed: "water_bottles", raw_meat_fish: "raw_chicken",
  plate_leftovers: "plate_leftovers", unlabelled_unknown: "unlabelled",
};

export function sceneKey(name?: string, category?: string): string {
  return (name && BY_NAME[name]) || (category && BY_CATEGORY[category]) || "bread_rolls";
}

const cache = new Map<string, Shape[]>();
let loading: Promise<Scenes> | null = null;
function loadScenes(): Promise<Scenes> {
  if (!loading) {
    loading = import("../data/foodScenes.json").then((m) => {
      const all = ((m as { default?: unknown }).default ?? m) as unknown as Scenes;
      for (const k of Object.keys(all)) cache.set(k, all[k]);
      return all;
    });
  }
  return loading;
}

function draw(s: Shape, i: number) {
  const common = {
    fill: s.f ?? "none",
    stroke: s.s,
    strokeWidth: s.sw,
    opacity: s.o,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  };
  if (s.t === "r") {
    const cx = (s.x ?? 0) + (s.w ?? 0) / 2;
    const cy = (s.y ?? 0) + (s.h ?? 0) / 2;
    return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} {...common} transform={s.rot ? `rotate(${s.rot} ${cx} ${cy})` : undefined} />;
  }
  if (s.t === "e") {
    return <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...common} transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined} />;
  }
  if (s.t === "l") {
    return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.s} strokeWidth={s.sw} opacity={s.o} strokeLinecap="round" />;
  }
  return <path key={i} d={s.d} {...common} />;
}

/** A flat food illustration, drawn as inline SVG. Fills its container and crops to fit. */
export function FoodArt({ name, category, className = "", label = "" }: { name?: string; category?: string; className?: string; label?: string }) {
  const key = sceneKey(name, category);
  const [shapes, setShapes] = useState<Shape[] | null>(cache.get(key) ?? null);

  useEffect(() => {
    let alive = true;
    const hit = cache.get(key);
    if (hit) {
      setShapes(hit);
      return;
    }
    loadScenes()
      .then((all) => alive && setShapes(all[key] ?? null))
      .catch(() => alive && setShapes(null));
    return () => {
      alive = false;
    };
  }, [key]);

  return (
    <svg viewBox="0 0 480 360" preserveAspectRatio="xMidYMid slice" className={className} role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}>
      <rect width="480" height="360" fill="#f3efe4" />
      {shapes?.map(draw)}
    </svg>
  );
}
