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

type Bounds = { contains: (coordinates: [number, number]) => boolean };
export type MapboxMap = {
  addControl: (control: unknown, position?: string) => void;
  addSource: (id: string, source: Record<string, unknown>) => void;
  addLayer: (layer: Record<string, unknown>) => void;
  getLayer: (id: string) => unknown;
  getSource: (id: string) => { setData?: (data: unknown) => void } | undefined;
  removeLayer: (id: string) => void;
  removeSource: (id: string) => void;
  flyTo: (options: Record<string, unknown>, eventData?: Record<string, unknown>) => void;
  getZoom: () => number;
  getBearing: () => number;
  setBearing: (bearing: number, eventData?: Record<string, unknown>) => void;
  getBounds: () => Bounds;
  on(event: "load" | "error" | "move" | "moveend" | "dragstart" | "rotatestart" | "zoomstart" | "zoomend", handler: ((event?: { originalEvent?: Event; error?: { message?: string } }) => void)): void;
  on(event: "click", handler: (event: { lngLat: { lat: number; lng: number } }) => void): void;
  resize: () => void;
  remove: () => void;
};
export type MapboxMarker = { getLngLat(): {lat:number;lng:number}; on(event:"drag"|"dragend", listener:()=>void):void; setLngLat: (coordinates: [number, number]) => MapboxMarker; addTo: (map: MapboxMap) => MapboxMarker; getElement: () => HTMLElement; remove: () => void };
export const MAPBOX_GL_VERSION = "3.26.0";
export const MAPBOX_CSP_SCRIPT = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl-csp.js`;
export const MAPBOX_CSP_WORKER = "/mapbox-gl-csp-worker.js";
