"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    mapboxgl?: {
      Map: new (options: Record<string, unknown>) => MapboxMap;
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
  on: (event: "load", handler: () => void) => void;
  on: (event: "error", handler: (event: MapboxErrorEvent) => void) => void;
  resize: () => void;
  remove: () => void;
};

type TrailheadMapProps = {
  center: [number, number];
};

const MAPBOX_GL_VERSION = "3.26.0";
const MAPBOX_CSP_SCRIPT = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl-csp.js`;
const MAPBOX_CSP_WORKER = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl-csp-worker.js`;

export default function TrailheadMap({ center }: TrailheadMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
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
        // Use the classic Streets style while we validate strict CSP rendering.
        // Mapbox Standard requires WebAssembly via script-src 'wasm-unsafe-eval'.
        style: "mapbox://styles/mapbox/streets-v12",
        center,
        zoom: 12,
      });

      map.on("load", () => {
        map.resize();
        window.requestAnimationFrame(() => map.resize());
        setMapLoaded(true);
        setMapError(null);
      });

      map.on("error", (event) => {
        const message = event.error?.message;
        setMapError(message ? `Mapbox error: ${message}` : "Trailhead could not load the map right now.");
      });

      map.addControl(new window.mapboxgl.NavigationControl({ showCompass: true }), "top-right");
      mapRef.current = map;
    } catch (error) {
      setMapError(error instanceof Error ? `Mapbox error: ${error.message}` : "Trailhead could not load the map right now.");
    }
  }, [center, scriptReady, token]);

  useEffect(() => {
    initializeMap();

    return () => {
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
