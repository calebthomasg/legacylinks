"use client";

import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MemorialCreateForm from "@/components/trailhead/MemorialCreateForm";
import MemorialEditForm from "@/components/trailhead/MemorialEditForm";
import MemorialOwnerDetail from "@/components/trailhead/MemorialOwnerDetail";

declare global {
  interface Window {
    mapboxgl?: {
      Map: new (options: Record<string, unknown>) => MapboxMap;
      Marker: new (options?: Record<string, unknown>) => MapboxMarker;
      NavigationControl: new (options?: Record<string, unknown>) => unknown;
      GeolocateControl: new (options?: Record<string, unknown>) => MapboxGeolocateControl;
      workerUrl?: string;
    };
  }
}

type MapboxErrorEvent = { error?: { message?: string } };
type GeolocateEvent = { coords: { latitude: number; longitude: number; accuracy: number } };
type Bounds = { contains: (coordinates: [number, number]) => boolean };
type MapboxMap = {
  addControl: (control: unknown, position?: string) => void;
  addSource: (id: string, source: Record<string, unknown>) => void;
  addLayer: (layer: Record<string, unknown>) => void;
  getLayer: (id: string) => unknown;
  getSource: (id: string) => unknown;
  removeLayer: (id: string) => void;
  removeSource: (id: string) => void;
  flyTo: (options: Record<string, unknown>) => void;
  getBounds: () => Bounds;
  on: (event: "load" | "error" | "moveend", handler: (() => void) | ((event: MapboxErrorEvent) => void)) => void;
  resize: () => void;
  remove: () => void;
};
type MapboxMarker = { setLngLat: (coordinates: [number, number]) => MapboxMarker; addTo: (map: MapboxMap) => MapboxMarker; remove: () => void };
type MapboxGeolocateControl = { trigger: () => boolean; on: (event: "geolocate", handler: (event: GeolocateEvent) => void) => MapboxGeolocateControl };
type TrailComment = { first_name: string; comment: string | null; rating: number | null; found_at: string; photo_paths: string[] };

export type TrailheadCache = {
  cache_id: string;
  public_code: string;
  title: string;
  description: string | null;
  difficulty: number;
  terrain: number;
  chapter_number: number | null;
  adventure_id: string;
  adventure_title: string;
  adventure_slug: string;
  search_latitude: number;
  search_longitude: number;
  search_radius_meters: number;
  arrival_latitude: number | null;
  arrival_longitude: number | null;
  created_at: string;
  unique_find_count: number;
  average_rating: number | null;
  recent_comments: TrailComment[];
};

type MyTreasureBox = {
  cache_id: string;
  public_code: string;
  title: string;
  description: string | null;
  difficulty: number;
  terrain: number;
  chapter_number: number | null;
  adventure_id: string;
  adventure_title: string;
  lifecycle_status: string;
  created_at: string;
  search_latitude: number | null;
  search_longitude: number | null;
  search_radius_meters: number | null;
  unique_find_count: number;
  average_rating: number | null;
};

export type DiscoveryItem = {
  experience_id: string;
  experience_type: "treasure_box" | "memorial" | "token_hunt";
  cache_id: string | null;
  title: string;
  description: string | null;
  latitude: number;
  longitude: number;
  search_radius_meters: number | null;
  marker_variant: "treasure_box" | "memorial" | "token";
  teaser_text: string | null;
};

type MyTreasureItem = {
  experience_id: string;
  experience_type: "treasure_box" | "memorial" | "token_hunt";
  cache_id: string | null;
  title: string;
  description: string | null;
  status: string;
  visibility: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};

type Props = {
  center: [number, number];
  caches: TrailheadCache[];
  myBoxes: MyTreasureBox[];
  discoveryItems?: DiscoveryItem[];
  myItems?: MyTreasureItem[];
};

type Filter = "all" | "treasure_box" | "memorial" | "token_hunt";
type AddView = "chooser" | "memorial" | null;

const MAPBOX_GL_VERSION = "3.26.0";
const MAPBOX_CSP_SCRIPT = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl-csp.js`;
const MAPBOX_CSP_WORKER = "/mapbox-gl-csp-worker.js";
const EARTH_RADIUS_METERS = 6371008.8;
const SEARCH_SOURCE = "active-search-area";
const SEARCH_FILL = "active-search-area-fill";
const SEARCH_LINE = "active-search-area-line";

function photoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/trail-log-images/${path.split("/").map(encodeURIComponent).join("/")}`;
}
function markerIcon(variant: DiscoveryItem["marker_variant"]) {
  if (variant === "memorial") return "/images/memorial-marker.svg";
  if (variant === "token") return "/images/token-marker.svg";
  return "/images/treasure-box-marker.svg";
}
function typeIcon(type: MyTreasureItem["experience_type"]) {
  if (type === "memorial") return "/images/memorial-marker.svg";
  if (type === "token_hunt") return "/images/token-marker.svg";
  return "/images/treasure-box-marker.svg";
}
function markerLabel(type: DiscoveryItem["experience_type"]) {
  if (type === "memorial") return "Memorial";
  if (type === "token_hunt") return "Token Hunt";
  return "Treasure Box";
}
function searchAreaFeature(cache: TrailheadCache) {
  const lat1 = cache.search_latitude * Math.PI / 180;
  const lon1 = cache.search_longitude * Math.PI / 180;
  const distance = cache.search_radius_meters / EARTH_RADIUS_METERS;
  const ring: [number, number][] = [];
  for (let step = 0; step <= 64; step++) {
    const bearing = step / 64 * Math.PI * 2;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distance) + Math.cos(lat1) * Math.sin(distance) * Math.cos(bearing));
    const lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(distance) * Math.cos(lat1), Math.cos(distance) - Math.sin(lat1) * Math.sin(lat2));
    ring.push([lon2 * 180 / Math.PI, lat2 * 180 / Math.PI]);
  }
  return { type: "Feature", properties: { cache_id: cache.cache_id }, geometry: { type: "Polygon", coordinates: [ring] } };
}
function distanceMeters(a: number, b: number, c: number, d: number) {
  const p1 = a * Math.PI / 180;
  const p2 = c * Math.PI / 180;
  const dp = (c - a) * Math.PI / 180;
  const dl = (d - b) * Math.PI / 180;
  const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function zoomForDistance(distance: number, radius: number) {
  if (distance <= Math.max(radius * 1.5, 60)) return 18;
  if (distance <= 250) return 17;
  if (distance <= 750) return 16;
  if (distance <= 2000) return 15;
  if (distance <= 5000) return 14;
  return 13;
}
function createDiscoveryMarker(item: DiscoveryItem, onSelect: () => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "group flex flex-col items-center focus:outline-none";
  button.setAttribute("aria-label", `Open ${item.title}`);
  button.addEventListener("click", onSelect);
  const pin = document.createElement("span");
  pin.className = "flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white bg-teal shadow-lg transition-transform group-hover:scale-110";
  const icon = document.createElement("img");
  icon.src = markerIcon(item.marker_variant);
  icon.alt = "";
  icon.className = "h-7 w-7";
  pin.append(icon);
  button.append(pin);
  return button;
}

function Rating({ label, value }: { label: string; value: number }) {
  return <div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-[.14em] text-night-sky/45">{label}</span><span className="text-sm font-bold text-night-sky">{value}/5</span></div><div className="mt-2 flex gap-1.5">{[1,2,3,4,5].map(step => <span key={step} className={`h-2 flex-1 rounded-full ${step <= value ? "bg-teal" : "bg-night-sky/10"}`} />)}</div></div>;
}
function ExploreRow({ item, onSelect }: { item: DiscoveryItem; onSelect: () => void }) {
  return <button onClick={onSelect} className="w-full border-b border-night-sky/10 px-5 py-4 text-left transition hover:bg-sand/60"><div className="flex gap-3"><span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal"><img src={markerIcon(item.marker_variant)} alt="" className="h-6 w-6" /></span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-teal">{markerLabel(item.experience_type)}</p><h3 className="truncate font-bold text-night-sky">{item.title}</h3>{item.description && <p className="mt-1 line-clamp-2 text-sm leading-5 text-night-sky/55">{item.description}</p>}{item.teaser_text && <p className="mt-2 text-xs font-bold text-coral">✦ {item.teaser_text}</p>}</div></div></button>;
}
function MyTreasureRow({ item, onSelect }: { item: MyTreasureItem; onSelect: () => void }) {
  return <button onClick={onSelect} className="w-full border-b border-night-sky/10 px-5 py-4 text-left transition hover:bg-sand/60"><div className="flex gap-3"><span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal"><img src={typeIcon(item.experience_type)} alt="" className="h-6 w-6" /></span><div className="min-w-0"><h3 className="truncate font-bold text-night-sky">{item.title}</h3><p className="mt-1 text-xs font-bold uppercase tracking-[.12em] text-teal">{markerLabel(item.experience_type)} · {item.status.replaceAll("_", " ")}</p><p className="mt-2 text-xs text-night-sky/45">{item.visibility === "public" ? "Visible on Trailhead" : "Hidden from Trailhead"}</p></div></div></button>;
}
function TreasureDetail({ cache, onBack, onBegin }: { cache: TrailheadCache; onBack: () => void; onBegin: () => void }) {
  return <><div className="flex items-center gap-3 border-b border-night-sky/10 px-5 py-4"><button onClick={onBack} className="h-9 w-9 rounded-full border border-night-sky/10">←</button><div><p className="text-xs font-bold uppercase tracking-[.18em] text-teal">Treasure Box</p><p className="text-sm font-semibold text-night-sky/60">{cache.adventure_title}</p></div></div><div className="flex-1 overflow-y-auto px-5 py-5"><h2 className="text-2xl font-bold text-night-sky">{cache.title}</h2>{cache.description && <p className="mt-3 text-sm leading-6 text-night-sky/65">{cache.description}</p>}<div className="mt-5 rounded-2xl bg-teal/10 p-4"><p className="font-bold text-night-sky">{cache.unique_find_count} {cache.unique_find_count === 1 ? "find" : "finds"}</p>{cache.average_rating && <p className="text-sm text-night-sky/60">★ {cache.average_rating}/5 average rating</p>}</div><div className="mt-5 flex gap-5 border-y border-night-sky/10 py-5"><Rating label="Difficulty" value={cache.difficulty} /><Rating label="Terrain" value={cache.terrain} /></div><button onClick={onBegin} className="mt-5 w-full rounded-2xl bg-night-sky px-5 py-4 text-sm font-bold text-white">Begin adventure</button><section className="mt-6 border-t border-night-sky/10 pt-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-teal">Trail log</p>{(cache.recent_comments || []).map((entry, index) => <article key={index} className="mt-3 rounded-2xl bg-sand p-4"><p className="text-sm font-bold text-night-sky">{entry.first_name}{entry.rating ? ` · ★ ${entry.rating}/5` : ""}</p>{entry.comment && <p className="mt-2 text-sm text-night-sky/70">{entry.comment}</p>}{entry.photo_paths?.map(path => <img key={path} src={photoUrl(path)} alt="Trail find" className="mt-3 h-24 w-full rounded-xl object-cover" />)}</article>)}</section></div></>;
}
function DiscoveryDetail({ item, onBack }: { item: DiscoveryItem; onBack: () => void }) {
  return <><div className="flex items-center gap-3 border-b border-night-sky/10 px-5 py-4"><button onClick={onBack} className="h-9 w-9 rounded-full border border-night-sky/10">←</button><p className="text-xs font-bold uppercase tracking-[.18em] text-teal">{markerLabel(item.experience_type)}</p></div><div className="flex-1 overflow-y-auto px-5 py-5"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal"><img src={markerIcon(item.marker_variant)} alt="" className="h-8 w-8" /></div><h2 className="mt-4 text-2xl font-bold text-night-sky">{item.title}</h2>{item.description && <p className="mt-3 text-sm leading-6 text-night-sky/65">{item.description}</p>}</div></>;
}
function GenericMineDetail({ item, onBack }: { item: MyTreasureItem; onBack: () => void }) {
  return <><div className="flex items-center gap-3 border-b border-night-sky/10 px-5 py-4"><button onClick={onBack} className="h-9 w-9 rounded-full border border-night-sky/10">←</button><div><p className="text-xs font-bold uppercase tracking-[.18em] text-teal">My Treasure</p><p className="text-sm font-semibold text-night-sky/60">{markerLabel(item.experience_type)}</p></div></div><div className="flex-1 overflow-y-auto px-5 py-5"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal"><img src={typeIcon(item.experience_type)} alt="" className="h-8 w-8" /></div><h2 className="mt-4 text-2xl font-bold text-night-sky">{item.title}</h2>{item.description && <p className="mt-3 text-sm leading-6 text-night-sky/65">{item.description}</p>}<div className="mt-5 rounded-2xl bg-sand p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-night-sky/45">Status</p><p className="mt-1 font-bold capitalize text-night-sky">{item.status.replaceAll("_", " ")} · {item.visibility}</p></div></div></>;
}

function Panel({ mode, setMode, items, selectedItem, selectedCache, selectedMine, onSelect, onSelectMine, onBack, onBegin, myItems, onAdd, onEditMine, onDeletedMine, filter, setFilter }: { mode: "explore" | "mine"; setMode: (mode: "explore" | "mine") => void; items: DiscoveryItem[]; selectedItem: DiscoveryItem | null; selectedCache: TrailheadCache | null; selectedMine: MyTreasureItem | null; onSelect: (item: DiscoveryItem) => void; onSelectMine: (item: MyTreasureItem) => void; onBack: () => void; onBegin: (cache: TrailheadCache) => void; myItems: MyTreasureItem[]; onAdd: () => void; onEditMine: (item: MyTreasureItem) => void; onDeletedMine: () => void; filter: Filter; setFilter: (filter: Filter) => void }) {
  if (selectedCache) return <aside className="flex h-full min-h-0 flex-col bg-white"><TreasureDetail cache={selectedCache} onBack={onBack} onBegin={() => onBegin(selectedCache)} /></aside>;
  if (selectedItem) return <aside className="flex h-full min-h-0 flex-col bg-white"><DiscoveryDetail item={selectedItem} onBack={onBack} /></aside>;
  if (selectedMine) return <aside className="flex h-full min-h-0 flex-col bg-white">{selectedMine.experience_type === "memorial" ? <MemorialOwnerDetail item={selectedMine} onBack={onBack} onEdit={() => onEditMine(selectedMine)} onDeleted={onDeletedMine} /> : <GenericMineDetail item={selectedMine} onBack={onBack} />}</aside>;
  return <aside className="flex h-full min-h-0 flex-col bg-white"><div className="border-b border-night-sky/10 p-4"><div className="grid grid-cols-2 rounded-xl bg-sand p-1"><button onClick={() => setMode("explore")} className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === "explore" ? "bg-white shadow-sm" : "text-night-sky/50"}`}>Explore</button><button onClick={() => setMode("mine")} className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === "mine" ? "bg-white shadow-sm" : "text-night-sky/50"}`}>My Treasure</button></div>{mode === "mine" && <button onClick={onAdd} className="mt-3 w-full rounded-xl bg-teal px-4 py-3 text-sm font-bold text-white">＋ Add Treasure</button>}{mode === "explore" && <div className="mt-3 flex gap-1 overflow-x-auto">{([['all','All'],['treasure_box','Treasure Boxes'],['memorial','Memorials'],['token_hunt','Token Hunts']] as [Filter,string][]).map(([value,label]) => <button key={value} onClick={() => setFilter(value)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${filter === value ? "bg-night-sky text-white" : "bg-sand text-night-sky/60"}`}>{label}</button>)}</div>}</div><div className="min-h-0 flex-1 overflow-y-auto">{mode === "explore" ? (items.length ? items.map(item => <ExploreRow key={item.experience_id} item={item} onSelect={() => onSelect(item)} />) : <p className="px-5 py-8 text-sm text-night-sky/50">Nothing of this type is visible here.</p>) : (myItems.length ? myItems.map(item => <MyTreasureRow key={item.experience_id} item={item} onSelect={() => onSelectMine(item)} />) : <div className="px-5 py-8"><h3 className="font-bold text-night-sky">Your treasure starts here.</h3><p className="mt-2 text-sm leading-6 text-night-sky/55">You haven’t added any treasure yet.</p></div>)}</div></aside>;
}

export default function TrailheadMap({ center, caches, myBoxes: _myBoxes, discoveryItems = [], myItems = [] }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const geoRef = useRef<MapboxGeolocateControl | null>(null);
  const markersRef = useRef<MapboxMarker[]>([]);
  const activeRef = useRef<TrailheadCache | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<DiscoveryItem | null>(null);
  const [selectedCache, setSelectedCache] = useState<TrailheadCache | null>(null);
  const [selectedMine, setSelectedMine] = useState<MyTreasureItem | null>(null);
  const [active, setActive] = useState<TrailheadCache | null>(null);
  const [mode, setMode] = useState<"explore" | "mine">("explore");
  const [filter, setFilter] = useState<Filter>("all");
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [visibleIds, setVisibleIds] = useState<string[]>(discoveryItems.map(item => item.experience_id));
  const [addView, setAddView] = useState<AddView>(null);
  const [editMemorialId, setEditMemorialId] = useState<string | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const cacheById = useMemo(() => new Map(caches.map(cache => [cache.cache_id, cache])), [caches]);
  const filtered = useMemo(() => discoveryItems.filter(item => (filter === "all" || item.experience_type === filter) && visibleIds.includes(item.experience_id)), [discoveryItems, filter, visibleIds]);

  const selectItem = useCallback((item: DiscoveryItem) => {
    setSelectedMine(null);
    const cache = item.cache_id ? cacheById.get(item.cache_id) : undefined;
    if (cache) { setSelectedCache(cache); setSelectedItem(null); }
    else { setSelectedItem(item); setSelectedCache(null); }
    mapRef.current?.flyTo({ center: [item.longitude, item.latitude], zoom: 15, duration: 700, essential: true });
  }, [cacheById]);
  const updateVisible = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    setVisibleIds(discoveryItems.filter(item => bounds.contains([item.longitude, item.latitude])).map(item => item.experience_id));
  }, [discoveryItems]);
  const clearArea = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer(SEARCH_LINE)) map.removeLayer(SEARCH_LINE);
    if (map.getLayer(SEARCH_FILL)) map.removeLayer(SEARCH_FILL);
    if (map.getSource(SEARCH_SOURCE)) map.removeSource(SEARCH_SOURCE);
  }, []);
  const begin = useCallback((cache: TrailheadCache) => {
    const map = mapRef.current;
    if (!map) return;
    clearArea();
    map.addSource(SEARCH_SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [searchAreaFeature(cache)] } });
    map.addLayer({ id: SEARCH_FILL, type: "fill", source: SEARCH_SOURCE, paint: { "fill-color": "#14b8a6", "fill-opacity": .18 } });
    map.addLayer({ id: SEARCH_LINE, type: "line", source: SEARCH_SOURCE, paint: { "line-color": "#0f1d3a", "line-width": 2.5, "line-opacity": .7, "line-dasharray": [2,2] } });
    activeRef.current = cache;
    setSelectedCache(null); setSelectedItem(null); setSelectedMine(null); setActive(cache); setMobileView("map");
    if (!geoRef.current?.trigger()) map.flyTo({ center: [cache.search_longitude, cache.search_latitude], zoom: 17, duration: 900, essential: true });
  }, [clearArea]);
  const initialize = useCallback(() => {
    if (!scriptReady || !containerRef.current || mapRef.current || !window.mapboxgl || !token) return;
    try {
      setError(null);
      window.mapboxgl.workerUrl = MAPBOX_CSP_WORKER;
      const map = new window.mapboxgl.Map({ accessToken: token, container: containerRef.current, style: "mapbox://styles/mapbox/streets-v12", center, zoom: 12 });
      mapRef.current = map;
      map.on("load", () => {
        map.resize();
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = discoveryItems.map(item => new window.mapboxgl!.Marker({ element: createDiscoveryMarker(item, () => selectItem(item)), anchor: "bottom" }).setLngLat([item.longitude, item.latitude]).addTo(map));
        setLoaded(true); setError(null); updateVisible();
      });
      map.on("moveend", updateVisible);
      map.on("error", (event?: MapboxErrorEvent) => setError(event?.error?.message ? `Mapbox error: ${event.error.message}` : "Trailhead could not load the map right now."));
      map.addControl(new window.mapboxgl.NavigationControl({ showCompass: true }), "top-right");
      const geo = new window.mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showUserLocation: true, showAccuracyCircle: true, showUserHeading: true, fitBoundsOptions: { maxZoom: 15 } });
      geo.on("geolocate", event => {
        const cache = activeRef.current;
        if (!cache) return;
        const distance = distanceMeters(event.coords.latitude, event.coords.longitude, cache.search_latitude, cache.search_longitude);
        map.flyTo({ center: [event.coords.longitude, event.coords.latitude], zoom: zoomForDistance(distance, cache.search_radius_meters), duration: 900, essential: true });
      });
      map.addControl(geo, "top-right"); geoRef.current = geo;
    } catch (caught) { setError(caught instanceof Error ? `Mapbox error: ${caught.message}` : "Trailhead could not load the map right now."); }
  }, [center, discoveryItems, scriptReady, selectItem, token, updateVisible]);

  useEffect(() => { if (window.mapboxgl) setScriptReady(true); }, []);
  useEffect(() => { initialize(); return () => { markersRef.current.forEach(marker => marker.remove()); markersRef.current = []; geoRef.current = null; mapRef.current?.remove(); mapRef.current = null; setLoaded(false); }; }, [initialize]);
  useEffect(() => { if (mobileView === "map") setTimeout(() => mapRef.current?.resize(), 0); }, [mobileView]);

  if (!token) return <div className="flex h-full items-center justify-center bg-sand"><p className="font-bold text-night-sky">Trailhead needs its Mapbox token.</p></div>;

  const clearSelections = () => { setSelectedItem(null); setSelectedCache(null); setSelectedMine(null); };
  const refreshMine = () => { clearSelections(); setMode("mine"); router.refresh(); };
  const panel = <Panel mode={mode} setMode={value => { setMode(value); clearSelections(); }} items={filtered} selectedItem={selectedItem} selectedCache={selectedCache} selectedMine={selectedMine} onSelect={selectItem} onSelectMine={item => { setSelectedMine(item); setSelectedItem(null); setSelectedCache(null); }} onBack={clearSelections} onBegin={begin} myItems={myItems} onAdd={() => setAddView("chooser")} onEditMine={item => { if (item.experience_type === "memorial") setEditMemorialId(item.experience_id); }} onDeletedMine={refreshMine} filter={filter} setFilter={setFilter} />;

  return <div className="relative flex h-full min-h-[520px] w-full bg-sand"><link href={`https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.css`} rel="stylesheet" /><Script src={MAPBOX_CSP_SCRIPT} strategy="afterInteractive" onLoad={() => setScriptReady(true)} onReady={() => setScriptReady(true)} onError={() => setError("Trailhead could not load Mapbox right now.")} /><div className="hidden h-full w-[380px] shrink-0 border-r border-night-sky/10 lg:block">{panel}</div><div className={`relative min-w-0 flex-1 ${mobileView === "list" ? "hidden lg:block" : "block"}`}><div ref={containerRef} className="absolute inset-0 h-full w-full" />{(!scriptReady || !loaded) && !error && <div className="absolute inset-0 flex items-center justify-center bg-sand text-sm font-semibold text-night-sky/60">Opening Trailhead…</div>}{error && <div className="absolute inset-0 flex items-center justify-center bg-sand px-6 text-center"><p className="font-semibold text-night-sky">{error}</p></div>}{active && <div className="absolute bottom-4 left-4 z-30 rounded-3xl bg-white/95 p-4 shadow-2xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-coral">Adventure in progress</p><h2 className="mt-1 text-xl font-bold text-night-sky">{active.title}</h2><button onClick={() => { clearArea(); activeRef.current = null; setActive(null); }} className="mt-3 text-xs font-bold text-night-sky/60">Exit adventure</button></div>}<div className="absolute right-3 top-3 z-40 lg:hidden"><button onClick={() => setMobileView("list")} className="rounded-xl bg-white px-4 py-3 shadow-lg">☷</button></div></div><div className={`h-full flex-1 bg-white lg:hidden ${mobileView === "list" ? "block" : "hidden"}`}><div className="flex h-14 items-center justify-between border-b px-4"><p className="font-bold">Trailhead</p><button onClick={() => setMobileView("map")}>⌖ Map</button></div><div className="h-[calc(100%-3.5rem)]">{panel}</div></div>{addView && <div className="absolute inset-0 z-50 flex items-center justify-center bg-night-sky/45 p-5"><div className="h-[min(760px,92vh)] w-full max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-2xl">{addView === "memorial" ? <MemorialCreateForm onCancel={() => setAddView("chooser")} onCreated={() => { setAddView(null); refreshMine(); }} /> : <div className="p-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-teal">My Treasure</p><h2 className="mt-2 text-2xl font-bold text-night-sky">What are you adding?</h2><p className="mt-2 text-sm leading-6 text-night-sky/55">Choose the kind of treasure you’re placing into the LegacyLink world.</p><div className="mt-5 grid gap-2"><button className="rounded-2xl border border-night-sky/15 p-4 text-left font-bold text-night-sky">Treasure Box <span className="block text-xs font-normal text-night-sky/45">Creator flow coming next</span></button><button onClick={() => setAddView("memorial")} className="rounded-2xl border border-teal bg-teal/10 p-4 text-left font-bold text-night-sky">Memorial / Headstone <span className="block text-xs font-normal text-night-sky/45">Create and publish a memorial now</span></button><button className="rounded-2xl border border-night-sky/15 p-4 text-left font-bold text-night-sky">Specialty Token <span className="block text-xs font-normal text-night-sky/45">Token placement flow coming next</span></button></div><button onClick={() => setAddView(null)} className="mt-5 w-full rounded-2xl bg-night-sky px-5 py-4 text-sm font-bold text-white">Close</button></div>}</div></div>}{editMemorialId && <div className="absolute inset-0 z-50 flex items-center justify-center bg-night-sky/45 p-5"><div className="h-[min(820px,94vh)] w-full max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-2xl"><MemorialEditForm experienceId={editMemorialId} onCancel={() => setEditMemorialId(null)} onSaved={() => { setEditMemorialId(null); refreshMine(); }} /></div></div>}</div>;
}
