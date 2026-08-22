"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    mapboxgl?: {
      Map: new (options: Record<string, unknown>) => MapboxMap;
      NavigationControl: new (options?: Record<string, unknown>) => unknown;
    };
  }
}

type MapboxMap = {
  addControl: (control: unknown, position?: string) => void;
  remove: () => void;
};

type TrailheadMapProps = {
  center: [number, number];
};

const MAPBOX_GL_VERSION = "3.26.0";

export default function TrailheadMap({ center }: TrailheadMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  const initializeMap = useCallback(() => {
    if (!scriptReady || !containerRef.current || mapRef.current || !window.mapboxgl || !token) {
      return;
    }

    try {
      const map = new window.mapboxgl.Map({
        accessToken: token,
        container: containerRef.current,
        style: "mapbox://styles/mapbox/standard",
        center,
        zoom: 12,
      });

      map.addControl(new window.mapboxgl.NavigationControl({ showCompass: true }), "top-right");
      mapRef.current = map;
    } catch {
      setMapError("Trailhead could not load the map right now.");
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
      <div className="flex min-h-[520px] items-center justify-center bg-sand px-6 text-center">
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
    <div className="relative min-h-[520px] bg-sand">
      <link
        href={`https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.css`}
        rel="stylesheet"
      />
      <Script
        src={`https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.js`}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setMapError("Trailhead could not load the map library right now.")}
      />
      <div ref={containerRef} className="absolute inset-0" aria-label="Trailhead interactive map" />

      {!scriptReady && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-sand text-sm font-semibold text-night-sky/60">
          Opening Trailhead…
        </div>
      )}

      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-sand px-6 text-center">
          <p className="max-w-md font-semibold text-night-sky">{mapError}</p>
        </div>
      )}
    </div>
  );
}
