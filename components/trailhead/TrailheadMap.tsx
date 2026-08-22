"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    mapboxgl?: {
      Map: new (options: Record<string, unknown>) => MapboxMap;
      Marker: new (options?: Record<string, unknown>) => MapboxMarker;
      NavigationControl: new (options?: Record<string, unknown>) => unknown;
      workerUrl?: string;
    };
  }
}

type MapboxErrorEvent = { error?: { message?: string } };
type MapboxMap = {
  addControl: (control: unknown, position?: string) => void;
  on: (event: "load" | "error", handler: (() => void) | ((event: MapboxErrorEvent) => void)) => void;
  resize: () => void;
  remove: () => void;
};
type MapboxMarker = {
  setLngLat: (coordinates: [number, number]) => MapboxMarker;
  addTo: (map: MapboxMap) => MapboxMarker;
  remove: () => void;
};

type TrailheadCache = {
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
};

type TrailheadMapProps = { center: [number, number]; caches: TrailheadCache[] };

const MAPBOX_GL_VERSION = "3.26.0";
const MAPBOX_CSP_SCRIPT = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl-csp.js`;
const MAPBOX_CSP_WORKER = "/mapbox-gl-csp-worker.js";

function createCacheMarkerElement(cache: TrailheadCache, onSelect: () => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "group flex flex-col items-center focus:outline-none";
  button.setAttribute("aria-label", `Open ${cache.title}`);
  button.title = cache.title;
  button.addEventListener("click", onSelect);

  const pin = document.createElement("span");
  pin.className = "flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white bg-teal text-lg font-black text-white shadow-lg transition-transform group-hover:scale-110 group-focus:scale-110";
  pin.textContent = cache.chapter_number ? String(cache.chapter_number) : "★";

  const label = document.createElement("span");
  label.className = "mt-1 max-w-40 rounded-full bg-night-sky px-3 py-1 text-center text-xs font-bold text-white shadow-md";
  label.textContent = cache.title;
  button.append(pin, label);
  return button;
}

function Rating({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-night-sky/45">{label}</span>
        <span className="text-sm font-bold text-night-sky">{value}/5</span>
      </div>
      <div className="mt-2 flex gap-1.5" aria-label={`${label}: ${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((step) => (
          <span key={step} className={`h-2 flex-1 rounded-full ${step <= value ? "bg-teal" : "bg-night-sky/10"}`} />
        ))}
      </div>
    </div>
  );
}

function CacheDetailPanel({ cache, onClose }: { cache: TrailheadCache; onClose: () => void }) {
  return (
    <aside className="absolute inset-x-0 bottom-0 z-30 flex h-[82%] flex-col overflow-hidden rounded-t-[2rem] border-t border-night-sky/10 bg-white shadow-2xl sm:inset-x-4 sm:bottom-4 sm:h-[78%] sm:rounded-[2rem] sm:border lg:inset-y-0 lg:left-0 lg:right-auto lg:h-auto lg:w-[390px] lg:rounded-none lg:border-y-0 lg:border-l-0">
      <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-night-sky/15 sm:mt-3 lg:hidden" aria-hidden="true" />
      <div className="flex shrink-0 items-center justify-between border-b border-night-sky/10 bg-white/95 px-5 py-4 backdrop-blur lg:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">Adventure</p>
          <p className="mt-1 text-sm font-semibold text-night-sky/65">{cache.adventure_title}</p>
        </div>
        <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-night-sky/10 text-2xl leading-none text-night-sky transition hover:bg-sand" aria-label="Close cache details">×</button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 pb-8 lg:px-6 lg:py-7">
        {cache.chapter_number && <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">Chapter {cache.chapter_number}</p>}
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-night-sky">{cache.title}</h2>
        {cache.description && <p className="mt-3 text-[15px] leading-7 text-night-sky/65">{cache.description}</p>}

        <div className="mt-6 flex gap-6 border-y border-night-sky/10 py-5">
          <Rating label="Difficulty" value={cache.difficulty} />
          <Rating label="Terrain" value={cache.terrain} />
        </div>

        <div className="mt-6 rounded-2xl bg-sand p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-night-sky/45">What to expect</p>
          <p className="mt-2 text-sm leading-6 text-night-sky/70">Choose this adventure when you’re ready to head toward the search area. The exact hiding place stays part of the hunt.</p>
        </div>

        <button type="button" className="mt-6 w-full rounded-2xl bg-night-sky px-5 py-4 text-sm font-bold text-white shadow-sm transition hover:opacity-90">
          Begin adventure
        </button>
        <p className="mt-3 text-center text-xs leading-5 text-night-sky/45">Search mode and navigation are coming in the next Trailhead steps.</p>
      </div>
    </aside>
  );
}

export default function TrailheadMap({ center, caches }: TrailheadMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRefs = useRef<MapboxMarker[]>([]);
  const [scriptReady, setScriptReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedCache, setSelectedCache] = useState<TrailheadCache | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  const initializeMap = useCallback(() => {
    if (!scriptReady || !containerRef.current || mapRef.current || !window.mapboxgl || !token) return;

    try {
      window.mapboxgl.workerUrl = MAPBOX_CSP_WORKER;
      const map = new window.mapboxgl.Map({ accessToken: token, container: containerRef.current, style: "mapbox://styles/mapbox/streets-v12", center, zoom: 12 });

      map.on("load", () => {
        map.resize();
        window.requestAnimationFrame(() => map.resize());
        markerRefs.current = caches.map((cache) => new window.mapboxgl!.Marker({ element: createCacheMarkerElement(cache, () => setSelectedCache(cache)), anchor: "bottom" }).setLngLat([cache.search_longitude, cache.search_latitude]).addTo(map));
        setMapLoaded(true);
        setMapError(null);
      });

      map.on("error", (event?: MapboxErrorEvent) => {
        const message = event?.error?.message;
        setMapError(message ? `Mapbox error: ${message}` : "Trailhead could not load the map right now.");
      });
      map.addControl(new window.mapboxgl.NavigationControl({ showCompass: true }), "top-right");
      mapRef.current = map;
    } catch (error) {
      setMapError(error instanceof Error ? `Mapbox error: ${error.message}` : "Trailhead could not load the map right now.");
    }
  }, [caches, center, scriptReady, token]);

  useEffect(() => {
    initializeMap();
    return () => {
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [initializeMap]);

  if (!token) return <div className="flex h-full min-h-[520px] items-center justify-center bg-sand px-6 text-center"><div className="max-w-md"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Map setup needed</p><h2 className="mt-3 text-2xl font-bold text-night-sky">Trailhead needs its Mapbox token.</h2></div></div>;

  return (
    <div className="relative h-full min-h-[520px] w-full bg-sand">
      <link href={`https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.css`} rel="stylesheet" />
      <Script src={MAPBOX_CSP_SCRIPT} strategy="afterInteractive" onLoad={() => setScriptReady(true)} onError={() => setMapError("Trailhead could not load the Mapbox CSP library right now.")} />
      <div ref={containerRef} className="absolute inset-0 h-full w-full" aria-label="Trailhead interactive map" />

      {(!scriptReady || !mapLoaded) && !mapError && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-sand text-sm font-semibold text-night-sky/60">Opening Trailhead…</div>}
      {mapError && <div className="absolute inset-0 flex items-center justify-center bg-sand px-6 text-center"><div className="max-w-lg"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Map could not load</p><p className="mt-3 break-words font-semibold leading-7 text-night-sky">{mapError}</p></div></div>}
      {selectedCache && <CacheDetailPanel cache={selectedCache} onClose={() => setSelectedCache(null)} />}
    </div>
  );
}
