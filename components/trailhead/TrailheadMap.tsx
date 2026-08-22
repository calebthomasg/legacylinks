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

type MapboxErrorEvent = {
  error?: {
    message?: string;
  };
};

type MapboxMap = {
  addControl: (control: unknown, position?: string) => void;
  on: (
    event: "load" | "error",
    handler: (() => void) | ((event: MapboxErrorEvent) => void),
  ) => void;
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

type TrailheadMapProps = {
  center: [number, number];
  caches: TrailheadCache[];
};

const MAPBOX_GL_VERSION = "3.26.0";
const MAPBOX_CSP_SCRIPT = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl-csp.js`;
const MAPBOX_CSP_WORKER = "/mapbox-gl-csp-worker.js";

function createCacheMarkerElement(cache: TrailheadCache) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "group flex flex-col items-center focus:outline-none";
  button.setAttribute("aria-label", `${cache.title}, ${cache.adventure_title}`);
  button.title = cache.title;

  const pin = document.createElement("span");
  pin.className =
    "flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white bg-teal text-lg font-black text-white shadow-lg transition-transform group-hover:scale-110 group-focus:scale-110";
  pin.textContent = cache.chapter_number ? String(cache.chapter_number) : "★";

  const label = document.createElement("span");
  label.className =
    "mt-1 max-w-40 rounded-full bg-night-sky px-3 py-1 text-center text-xs font-bold text-white shadow-md";
  label.textContent = cache.title;

  button.append(pin, label);
  return button;
}

export default function TrailheadMap({ center, caches }: TrailheadMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRefs = useRef<MapboxMarker[]>([]);
  const [scriptReady, setScriptReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  const initializeMap = useCallback(() => {
    if (!scriptReady || !containerRef.current || mapRef.current || !window.mapboxgl || !token) {
      return;
    }

    try {
      window.mapboxgl.workerUrl = MAPBOX_CSP_WORKER;

      const map = new window.mapboxgl.Map({
        accessToken: token,
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center,
        zoom: 12,
      });

      map.on("load", () => {
        map.resize();
        window.requestAnimationFrame(() => map.resize());

        markerRefs.current = caches.map((cache) => {
          const marker = new window.mapboxgl!.Marker({
            element: createCacheMarkerElement(cache),
            anchor: "bottom",
          })
            .setLngLat([cache.search_longitude, cache.search_latitude])
            .addTo(map);

          return marker;
        });

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

  if (!token) {
    return (
      <div className="flex h-[520px] items-center justify-center bg-sand px-6 text-center">
        <div className="max-w-md">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Map setup needed</p>
          <h2 className="mt-3 text-2xl font-bold text-night-sky">Trailhead needs its Mapbox token.</h2>
          <p className="mt-3 leading-7 text-night-sky/65">
            Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to this environment and redeploy to turn on the live map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[520px] w-full bg-sand">
      <link
        href={`https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.css`}
        rel="stylesheet"
      />
      <Script
        src={MAPBOX_CSP_SCRIPT}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setMapError("Trailhead could not load the Mapbox CSP library right now.")}
      />
      <div
        ref={containerRef}
        className="absolute inset-0 h-full w-full"
        aria-label="Trailhead interactive map"
      />

      {(!scriptReady || !mapLoaded) && !mapError && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-sand text-sm font-semibold text-night-sky/60">
          Opening Trailhead…
        </div>
      )}

      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-sand px-6 text-center">
          <div className="max-w-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Map could not load</p>
            <p className="mt-3 break-words font-semibold leading-7 text-night-sky">{mapError}</p>
          </div>
        </div>
      )}
    </div>
  );
}
