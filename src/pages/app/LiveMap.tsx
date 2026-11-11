import { useCallback, useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "../../auth/AuthContext";
import { subscribeFeed } from "../../data/activity";
import { loadMapData, type MapBatch, type MapData, type MapFridge, type MapJob } from "../../data/mapData";
import { useLang } from "../../i18n/LanguageContext";
import { fill } from "../../lib/format";
import { fridgeTone, volunteerPosition, type LatLng } from "../../lib/geo";
import { nowMs } from "../../lib/serverTime";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const COLORS = { low: "#2d9a4e", mid: "#e3a008", high: "#c9302f", off: "#9aa8ad", venue: "#1e7a3c", volunteer: "#2f6fdb", free: "#7aa7e8" };
const svg = (inner: string) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICON = {
  fridge: svg('<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 10h12M9 6v2M9 13v3"/>'),
  store: svg('<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/>'),
  van: svg('<path d="M2 7h11v9H2z"/><path d="M13 10h4l3 3v3h-7z"/><circle cx="6.5" cy="18" r="1.6"/><circle cx="16.5" cy="18" r="1.6"/>'),
};

function pin(color: string, icon: string, square = false, size = 30) {
  return L.divIcon({
    className: "bk-pin-wrap",
    html: `<div class="bk-pin${square ? " sq" : ""}" style="background:${color};width:${size}px;height:${size}px">${icon}</div>`,
    iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2],
  });
}
const dot = (color: string) => L.divIcon({ className: "bk-pin-wrap", html: `<div class="bk-dot" style="background:${color}"></div>`, iconSize: [14, 14], iconAnchor: [7, 7], popupAnchor: [0, -8] });

type Mover = { marker: L.Marker; job: MapJob; home: LatLng; venue: LatLng; fridge: LatLng | null };

export default function LiveMap() {
  const { t, lang } = useLang();
  const M = t.map;
  const { user } = useAuth();
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const groups = useRef<{ fridges: L.LayerGroup; venues: L.LayerGroup; routes: L.LayerGroup; volunteers: L.LayerGroup } | null>(null);
  const movers = useRef<Mover[]>([]);
  const lastKey = useRef("");
  const fitted = useRef(false);
  const [data, setData] = useState<MapData | null>(null);
  const [error, setError] = useState(false);
  const [layers, setLayers] = useState({ fridges: true, batches: true, volunteers: true, routes: true });

  // 1. create the map once
  useEffect(() => {
    if (!mapEl.current || map.current) return;
    const m = L.map(mapEl.current, { zoomControl: true, scrollWheelZoom: true }).setView([25.17, 55.27], 10);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(m);
    groups.current = { routes: L.layerGroup().addTo(m), fridges: L.layerGroup().addTo(m), venues: L.layerGroup().addTo(m), volunteers: L.layerGroup().addTo(m) };
    map.current = m;
    const id = window.setTimeout(() => m.invalidateSize(), 150);
    return () => {
      window.clearTimeout(id);
      m.remove();
      map.current = null;
      groups.current = null;
      fitted.current = false;
      lastKey.current = "";
    };
  }, []);

  // 2. load data, refresh every 10 seconds and whenever the agent writes something
  const load = useCallback(async () => {
    if (!user) return;
    try {
      const d = await loadMapData(user);
      const key = JSON.stringify(d);
      if (key !== lastKey.current) {
        lastKey.current = key;
        setData(d);
      }
      setError(false);
    } catch (err) {
      console.error(err);
      setError(true);
    }
  }, [user?.id, user?.mode]);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10000);
    let timer: number | undefined;
    const stop = subscribeFeed(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void load(), 800);
    });
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(timer);
      stop();
    };
  }, [load]);

  // 3. draw
  useEffect(() => {
    const g = groups.current;
    const m = map.current;
    if (!g || !m || !data) return;
    g.fridges.clearLayers();
    g.venues.clearLayers();
    g.routes.clearLayers();
    g.volunteers.clearLayers();
    movers.current = [];
    const P = M.popup;
    const statusLabel = (s: string) => t.app.dash.status[s] ?? s;
    const fridgeById = new Map(data.fridges.map((f) => [f.id, f]));
    const batchById = new Map(data.batches.map((b) => [b.id, b]));
    const now = nowMs();

    for (const f of data.fridges) {
      const tone = fridgeTone({ status: f.status, stock: f.stock, reserved: f.reserved, capacity: f.capacity });
      const hours = f.open24h || !f.openFrom || !f.openTo ? P.open24 : `${f.openFrom.slice(0, 5)}–${f.openTo.slice(0, 5)}`;
      const html = `<strong>${esc(f.code)} ${esc(f.name)}</strong><br/>${esc(f.area)}<br/>${P.stock}: ${f.stock}/${f.capacity} ${P.portions}${f.reserved ? ` (+${f.reserved})` : ""}<br/>${P.incoming}: ${f.incoming}<br/>${P.status}: ${esc(M.fridgeStatus[f.status] ?? f.status)} · ${P.hours}: ${esc(hours)}`;
      L.marker([f.lat, f.lng], { icon: pin(COLORS[tone], ICON.fridge, true, 28), title: f.code }).bindPopup(html).addTo(g.fridges);
    }

    const venues = new Map<string, { venue: NonNullable<MapBatch["venue"]>; batches: MapBatch[] }>();
    for (const b of data.batches) {
      if (!b.venue) continue;
      const key = `${b.venue.lat},${b.venue.lng},${b.venue.name}`;
      const cur = venues.get(key) ?? { venue: b.venue, batches: [] };
      cur.batches.push(b);
      venues.set(key, cur);
    }
    for (const { venue, batches } of venues.values()) {
      const lines = batches.map((b) => {
        const left = b.safeUntil ? Math.max(0, Math.round((new Date(b.safeUntil).getTime() - now) / 60000)) : null;
        return `${esc(b.items[0] ?? "")}${b.items.length > 1 ? ` +${b.items.length - 1}` : ""} · ${b.portions} ${P.portions} · ${esc(statusLabel(b.status))}${left !== null ? ` · ${P.safeLeft}: ${left} min` : ""}`;
      });
      L.marker([venue.lat, venue.lng], { icon: pin(COLORS.venue, ICON.store, false, 30) })
        .bindPopup(`<strong>${esc(venue.name)}</strong><br/>${esc(venue.area)}<br/>${lines.join("<br/>")}`)
        .addTo(g.venues);
    }

    for (const b of data.batches) {
      const f = b.fridgeId ? fridgeById.get(b.fridgeId) : undefined;
      if (b.venue && f) L.polyline([[b.venue.lat, b.venue.lng], [f.lat, f.lng]], { color: COLORS.low, weight: 3, opacity: 0.7, dashArray: "6 8" }).addTo(g.routes);
    }

    const busy = new Set<string>();
    for (const j of data.jobs) {
      const v = j.volunteer;
      const b = batchById.get(j.batchId);
      if (!v || !b?.venue) continue;
      busy.add(v.id);
      const home: LatLng = [v.lat, v.lng];
      const venue: LatLng = [b.venue.lat, b.venue.lng];
      const fr: MapFridge | undefined = j.fridgeId ? fridgeById.get(j.fridgeId) : undefined;
      const fridge: LatLng | null = fr ? [fr.lat, fr.lng] : null;
      if (j.status !== "picked_up") L.polyline([home, venue], { color: COLORS.mid, weight: 2, opacity: 0.85, dashArray: "2 6" }).addTo(g.routes);
      const pos = volunteerPosition({ status: j.status, respondedAt: j.respondedAt, pickedUpAt: j.pickedUpAt, transport: v.transport, simulated: v.simulated }, home, venue, fridge, now);
      const what = j.status === "offered" ? fill(P.offered, { venue: b.venue.name }) : j.status === "accepted" ? fill(P.toPickup, { venue: b.venue.name }) : fill(P.toFridge, { fridge: fr?.code ?? "" });
      const marker = L.marker(pos.pos, { icon: pin(COLORS.volunteer, ICON.van, false, 30), zIndexOffset: 500 })
        .bindPopup(`<strong>${esc(v.name)}</strong><br/>${esc(t.onboarding.transports[v.transport] ?? v.transport)}<br/>${esc(what)}${j.pickupEtaMin && j.status !== "picked_up" ? `<br/>${fill(P.eta, { n: j.pickupEtaMin })}` : ""}`)
        .addTo(g.volunteers);
      movers.current.push({ marker, job: j, home, venue, fridge });
    }
    for (const v of data.available) {
      if (busy.has(v.id)) continue;
      L.marker([v.lat, v.lng], { icon: dot(COLORS.free) }).bindPopup(`<strong>${esc(v.name)}</strong><br/>${esc(t.onboarding.transports[v.transport] ?? v.transport)}<br/>${esc(P.available)}`).addTo(g.volunteers);
    }

    if (!fitted.current) {
      const pts: LatLng[] = [...data.fridges.map((f) => [f.lat, f.lng] as LatLng), ...data.batches.flatMap((b) => (b.venue ? [[b.venue.lat, b.venue.lng] as LatLng] : []))];
      if (pts.length > 0) {
        m.fitBounds(L.latLngBounds(pts), { padding: [30, 30] });
        fitted.current = true;
      }
    }
  }, [data, t, lang]);

  // 4. show or hide layers
  useEffect(() => {
    const g = groups.current;
    const m = map.current;
    if (!g || !m) return;
    const set = (layer: L.LayerGroup, on: boolean) => (on ? m.addLayer(layer) : m.removeLayer(layer));
    set(g.fridges, layers.fridges);
    set(g.venues, layers.batches);
    set(g.routes, layers.routes);
    set(g.volunteers, layers.volunteers);
  }, [layers, data]);

  // 5. move the volunteers along their routes, once a second
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = nowMs();
      for (const mv of movers.current) {
        const v = mv.job.volunteer;
        if (!v) continue;
        const p = volunteerPosition({ status: mv.job.status, respondedAt: mv.job.respondedAt, pickedUpAt: mv.job.pickedUpAt, transport: v.transport, simulated: v.simulated }, mv.home, mv.venue, mv.fridge, now);
        mv.marker.setLatLng(p.pos);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!user) return null;
  const toggle = (k: keyof typeof layers) => setLayers((cur) => ({ ...cur, [k]: !cur[k] }));
  const live = data?.batches ?? [];
  const legend: [string, string][] = [
    [COLORS.low, M.legend.fridgeLow], [COLORS.mid, M.legend.fridgeMid], [COLORS.high, M.legend.fridgeHigh], [COLORS.off, M.legend.fridgeOff],
    [COLORS.venue, M.legend.venue], [COLORS.volunteer, M.legend.volunteer], [COLORS.free, M.legend.volunteerFree],
  ];

  return (
    <>
      <h1 className="text-[28px] font-extrabold tracking-[-0.04em]">{M.title}</h1>
      <p className="mt-2 max-w-[680px] text-[14px] font-light leading-[1.8] text-muted-foreground">{M.sub}</p>
      {error && <p role="alert" className="mt-4 text-[13px] text-danger">{M.loadError}</p>}

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label={M.layersTitle}>
        {(["fridges", "batches", "volunteers", "routes"] as const).map((k) => (
          <label key={k} className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-primary ${layers[k] ? "border-primary bg-primary-light text-primary" : "border-border bg-white text-muted-foreground"}`}>
            <input type="checkbox" className="sr-only" checked={layers[k]} onChange={() => toggle(k)} />
            {M.layers[k]}
          </label>
        ))}
      </div>

      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-[14px] border-[1.5px] border-border bg-white">
          <div ref={mapEl} className="h-[520px] w-full lg:h-[600px]" role="region" aria-label={M.title} dir="ltr" />
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-border px-4 py-3">
            {legend.map(([c, l]) => (
              <li key={l} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} aria-hidden="true" />
                {l}
              </li>
            ))}
          </ul>
        </div>

        <aside className="rounded-[14px] border-[1.5px] border-border bg-white p-4">
          <h2 className="text-[14px] font-bold">{M.listTitle}</h2>
          {live.length === 0 && <p className="mt-3 text-[12px] text-muted-foreground">{M.listEmpty}</p>}
          <ul className="mt-3 flex max-h-[470px] flex-col gap-2 overflow-y-auto">
            {live.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  disabled={!b.venue}
                  onClick={() => b.venue && map.current?.flyTo([b.venue.lat, b.venue.lng], 13, { duration: 0.8 })}
                  className="w-full rounded-lg border border-border p-3 text-start transition-colors hover:border-primary disabled:opacity-60"
                >
                  <span className="block text-[12px] font-semibold text-foreground">{b.venue?.name ?? "—"}</span>
                  <span className="block text-[11px] font-light text-muted-foreground">
                    {b.items[0] ?? ""}{b.items.length > 1 ? ` +${b.items.length - 1}` : ""} · <bdi>{b.portions}</bdi> {M.popup.portions}
                  </span>
                  <span className="mt-1 block text-[11px] font-medium text-primary">
                    {t.app.dash.status[b.status] ?? b.status}
                    {b.fridgeId && data ? ` → ${data.fridges.find((f) => f.id === b.fridgeId)?.code ?? ""}` : ""}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-light text-muted-foreground">{M.focus}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
      <p className="mt-4 text-[11px] font-light text-muted-foreground">{M.estimated}</p>
    </>
  );
}
