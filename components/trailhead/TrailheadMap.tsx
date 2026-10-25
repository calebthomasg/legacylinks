"use client";

import Script from "next/script";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MemorialCreateForm from "@/components/trailhead/MemorialCreateForm";
import MemorialEditForm from "@/components/trailhead/MemorialEditForm";
import MemorialOwnerDetail from "@/components/trailhead/MemorialOwnerDetail";
import MemorialDiscoveryDetail from "@/components/trailhead/MemorialDiscoveryDetail";
import TravelingTokenOwnerDetail from "@/components/trailhead/TravelingTokenOwnerDetail";
import TreasureBoxEditForm from "@/components/treasure-box/TreasureBoxEditForm";
import TreasureFindFeedback from "@/components/trailhead/TreasureFindFeedback";
import { TREASURE_BOX_ADVANCED_EXPERIENCES_ENABLED } from "@/utils/featureFlags";

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
type MapboxMap = {
  addControl: (control: unknown, position?: string) => void;
  addSource: (id: string, source: Record<string, unknown>) => void;
  addLayer: (layer: Record<string, unknown>) => void;
  getLayer: (id: string) => unknown;
  getSource: (id: string) => unknown;
  removeLayer: (id: string) => void;
  removeSource: (id: string) => void;
  flyTo: (options: Record<string, unknown>, eventData?: Record<string, unknown>) => void;
  getZoom: () => number;
  getBearing: () => number;
  setBearing: (bearing: number, eventData?: Record<string, unknown>) => void;
  getBounds: () => Bounds;
  on: (event: "load" | "error" | "move" | "moveend" | "dragstart" | "rotatestart" | "zoomstart" | "zoomend", handler: ((event?: { originalEvent?: Event; error?: { message?: string } }) => void)) => void;
  resize: () => void;
  remove: () => void;
};
type MapboxMarker = { setLngLat: (coordinates: [number, number]) => MapboxMarker; addTo: (map: MapboxMap) => MapboxMarker; getElement: () => HTMLElement; remove: () => void };
type TrailComment = { first_name: string; comment: string | null; rating: number | null; found_at: string; photo_paths: string[] };

export type TrailheadCache = {
  cache_id: string; public_code: string; title: string; description: string | null; difficulty: number; terrain: number; chapter_number: number | null; adventure_id: string; adventure_title: string; adventure_slug: string; search_latitude: number; search_longitude: number; search_radius_meters: number; arrival_latitude: number | null; arrival_longitude: number | null; created_at: string; unique_find_count: number; average_rating: number | null; recent_comments: TrailComment[];
};
type MyTreasureBox = { cache_id: string; public_code: string; title: string; description: string | null; difficulty: number; terrain: number | null; chapter_number: number | null; adventure_id: string; adventure_title: string; lifecycle_status: string; created_at: string; search_latitude: number | null; search_longitude: number | null; search_radius_meters: number | null; unique_find_count: number; average_rating: number | null; };
export type DiscoveryItem = { experience_id: string; experience_type: "treasure_box" | "memorial" | "token_hunt"; cache_id: string | null; title: string; description: string | null; latitude: number; longitude: number; search_radius_meters: number | null; marker_variant: "treasure_box" | "memorial" | "token"; teaser_text: string | null; };
type MyTreasureItem = { experience_id: string; experience_type: "treasure_box" | "memorial" | "token_hunt" | "traveling_token"; cache_id: string | null; title: string; description: string | null; status: string; visibility: string; latitude: number | null; longitude: number | null; created_at: string; nfc_public_token?: string | null; token_code?: string | null; mission?: string | null; from_box_code?: string | null; current_box_code?: string | null; total_miles?: number | null; stop_count?: number | null; };
type MyTreasureFind = { find_id: string; cache_id: string; nfc_public_token: string; public_code: string; title: string; description: string | null; found_at: string; feedback_updated_at: string; rating: number | null; comment: string | null; photo_paths: string[]; };
type Props = { center: [number, number]; caches: TrailheadCache[]; myBoxes: MyTreasureBox[]; discoveryItems?: DiscoveryItem[]; myItems?: MyTreasureItem[]; myFinds?: MyTreasureFind[]; };
type PanelMode = "explore" | "finds" | "mine";
type Filter = "all" | "treasure_box" | "memorial" | "token_hunt";
type AddView = "chooser" | "memorial" | null;

const MAPBOX_GL_VERSION = "3.26.0";
const MAPBOX_CSP_SCRIPT = `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl-csp.js`;
const MAPBOX_CSP_WORKER = "/mapbox-gl-csp-worker.js";
const EARTH_RADIUS_METERS = 6371008.8;
const SEARCH_SOURCE = "active-search-area";
const SEARCH_FILL = "active-search-area-fill";
const SEARCH_LINE = "active-search-area-line";

type CompassEvent = DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
function headingDelta(target: number, current: number) { return ((target - current + 540) % 360) - 180; }
function compassHeading(event: CompassEvent) {
  if (Number.isFinite(event.webkitCompassHeading) && (event.webkitCompassAccuracy === undefined || event.webkitCompassAccuracy >= 0)) return event.webkitCompassHeading!;
  if (!event.absolute && event.type !== "deviceorientationabsolute") return null;
  if (event.alpha === null || !Number.isFinite(event.alpha)) return null;
  const screenAngle = window.screen.orientation?.angle ?? 0;
  return (360 - event.alpha - screenAngle + 720) % 360;
}

function photoUrl(path: string) { return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/trail-log-images/${path.split("/").map(encodeURIComponent).join("/")}`; }
function markerIcon(variant: DiscoveryItem["marker_variant"]) { if (variant === "memorial") return "/images/memorial-marker.svg"; if (variant === "token") return "/images/token-marker.svg"; return "/images/treasure-box-marker.svg"; }
function typeIcon(type: MyTreasureItem["experience_type"]) { if (type === "memorial") return "/images/memorial-marker.svg"; if (type === "token_hunt" || type === "traveling_token") return "/images/token-marker.svg"; return "/images/treasure-box-marker.svg"; }
function markerLabel(type: DiscoveryItem["experience_type"] | MyTreasureItem["experience_type"]) { if (type === "memorial") return "Memorial"; if (type === "traveling_token") return "Traveling Token"; if (type === "token_hunt") return "Token Hunt"; return "Treasure Box"; }
function searchAreaFeature(cache: TrailheadCache) { const lat1=cache.search_latitude*Math.PI/180,lon1=cache.search_longitude*Math.PI/180,distance=cache.search_radius_meters/EARTH_RADIUS_METERS,ring:[number,number][]=[]; for(let step=0;step<=64;step++){const bearing=step/64*Math.PI*2;const lat2=Math.asin(Math.sin(lat1)*Math.cos(distance)+Math.cos(lat1)*Math.sin(distance)*Math.cos(bearing));const lon2=lon1+Math.atan2(Math.sin(bearing)*Math.sin(distance)*Math.cos(lat1),Math.cos(distance)-Math.sin(lat1)*Math.sin(lat2));ring.push([lon2*180/Math.PI,lat2*180/Math.PI]);} return {type:"Feature",properties:{cache_id:cache.cache_id},geometry:{type:"Polygon",coordinates:[ring]}}; }
function distanceMeters(a:number,b:number,c:number,d:number){const p1=a*Math.PI/180,p2=c*Math.PI/180,dp=(c-a)*Math.PI/180,dl=(d-b)*Math.PI/180,x=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return EARTH_RADIUS_METERS*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
function distanceLabel(distance:number){return distance<305?`${Math.round(distance*3.28084)} ft`:`${(distance/1609.344).toFixed(1)} mi`;}
function locationFailure(error:GeolocationPositionError){if(error.code===error.PERMISSION_DENIED)return "Location is blocked. Allow location for this browser and Trailhead, then retry.";if(error.code===error.TIMEOUT)return "Location timed out. Tap Retry location to try again.";return "Your phone could not determine its location. Check Location Services and retry.";}
function stalledLocationMessage(){return /CriOS/.test(navigator.userAgent)?"Chrome stopped responding to location. Close Chrome from the app switcher, reopen Trailhead, and allow location.":"Location request is taking too long. Check browser location access, then retry.";}
function zoomForDistance(distance:number,radius:number){if(distance<=Math.max(radius*1.5,60))return 18;if(distance<=250)return 17;if(distance<=750)return 16;if(distance<=2000)return 15;if(distance<=5000)return 14;return 13;}
function createDiscoveryMarker(item:DiscoveryItem,onSelect:()=>void){const button=document.createElement("button");button.type="button";button.className="group flex flex-col items-center focus:outline-none";button.setAttribute("aria-label",`Open ${item.title}`);button.addEventListener("click",onSelect);const pin=document.createElement("span");pin.className="flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white bg-teal shadow-lg transition-transform group-hover:scale-110";const icon=document.createElement("img");icon.src=markerIcon(item.marker_variant);icon.alt="";icon.className="h-7 w-7";pin.append(icon);button.append(pin);return button;}
function createUserMarker(){const element=document.createElement("div");element.className="trailhead-user-marker";element.setAttribute("aria-label","Your location");const halo=document.createElement("span");halo.className="trailhead-user-marker__halo";const heading=document.createElement("span");heading.className="trailhead-user-marker__heading";const dot=document.createElement("span");dot.className="trailhead-user-marker__dot";element.append(halo,heading,dot);return {element,heading};}
function Rating({label,value}:{label:string;value:number}){return <div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-[.14em] text-night-sky/45">{label}</span><span className="text-sm font-bold text-night-sky">{value}/5</span></div><div className="mt-2 flex gap-1.5">{[1,2,3,4,5].map(step=><span key={step} className={`h-2 flex-1 rounded-full ${step<=value?"bg-teal":"bg-night-sky/10"}`}/>)}</div></div>;}
function ExploreRow({item,onSelect}:{item:DiscoveryItem;onSelect:()=>void}){return <button onClick={onSelect} className="block min-h-[112px] w-full shrink-0 border-b border-night-sky/10 px-5 py-4 text-left transition hover:bg-sand/60"><div className="flex items-start gap-3"><span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal"><img src={markerIcon(item.marker_variant)} alt="" className="h-6 w-6"/></span><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-teal">{markerLabel(item.experience_type)}</p><h3 className="truncate font-bold text-night-sky">{item.title}</h3>{item.description&&<p className="mt-1 line-clamp-2 text-sm leading-5 text-night-sky/55">{item.description}</p>}{item.teaser_text&&<p className="mt-2 text-xs font-bold text-coral">✦ {item.teaser_text}</p>}</div></div></button>;}
function MyTreasureRow({item,onSelect}:{item:MyTreasureItem;onSelect:()=>void}){return <button onClick={onSelect} className="block min-h-[112px] w-full shrink-0 border-b border-night-sky/10 px-5 py-4 text-left transition hover:bg-sand/60"><div className="flex items-start gap-3"><span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal"><img src={typeIcon(item.experience_type)} alt="" className="h-6 w-6"/></span><div className="min-w-0 flex-1"><h3 className="truncate font-bold text-night-sky">{item.title}</h3><p className="mt-1 text-xs font-bold uppercase tracking-[.12em] text-teal">{markerLabel(item.experience_type)} · {item.status.replaceAll("_"," ")}</p><p className="mt-2 text-xs text-night-sky/45">{item.experience_type==="treasure_box"&&item.status==="published"?"Published and visible on Trailhead":item.visibility==="public"?"Visible on Trailhead":"Hidden from Trailhead"}</p></div></div></button>;}
function foundDate(value:string){return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(value));}
function FindRow({item,onSelect}:{item:MyTreasureFind;onSelect:()=>void}){const hasEntry=Boolean(item.rating||item.comment||item.photo_paths.length);return <button onClick={onSelect} className="block min-h-[112px] w-full shrink-0 border-b border-night-sky/10 px-5 py-4 text-left transition hover:bg-sand/60"><div className="flex items-start gap-3"><span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal"><Image src="/images/treasure-box-marker.svg" alt="" width={24} height={24} className="h-6 w-6"/></span><div className="min-w-0 flex-1"><h3 className="truncate font-bold text-night-sky">{item.title}</h3><p className="mt-1 text-xs text-night-sky/50">Found {foundDate(item.found_at)}</p><p className={`mt-2 text-xs font-bold ${hasEntry?"text-teal":"text-coral"}`}>{hasEntry?"Trail Log entry added":"Add your Trail Log entry"}</p></div></div></button>;}
function FindDetail({item,onBack,onSaved}:{item:MyTreasureFind;onBack:()=>void;onSaved:()=>void}){return <><div className="flex items-center gap-3 border-b border-night-sky/10 px-5 py-4"><button onClick={onBack} className="h-9 w-9 rounded-full border border-night-sky/10">←</button><div><p className="text-xs font-bold uppercase tracking-[.18em] text-teal">My Trail Log</p><p className="text-sm font-semibold text-night-sky/60">Found {foundDate(item.found_at)}</p></div></div><div className="flex-1 overflow-y-auto px-5 py-5"><h2 className="text-2xl font-bold text-night-sky">{item.title}</h2>{item.description&&<p className="mt-3 text-sm leading-6 text-night-sky/65">{item.description}</p>}<div className="mt-5 rounded-2xl bg-teal/10 p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-night-sky/45">Original find</p><p className="mt-1 font-bold text-night-sky">{foundDate(item.found_at)}</p><p className="mt-1 text-xs text-night-sky/50">This timestamp stays attached to your first confirmed find.</p></div><TreasureFindFeedback token={item.nfc_public_token} initialRating={item.rating} initialComment={item.comment} initialPhotoPaths={item.photo_paths} onSaved={onSaved}/></div></>;}
function TreasureDetail({cache,onBack,onBegin}:{cache:TrailheadCache;onBack:()=>void;onBegin:()=>void}){return <><div className="flex items-center gap-3 border-b border-night-sky/10 px-5 py-4"><button onClick={onBack} className="h-9 w-9 rounded-full border border-night-sky/10">←</button><div><p className="text-xs font-bold uppercase tracking-[.18em] text-teal">Treasure Box</p><p className="text-sm font-semibold text-night-sky/60">{cache.adventure_title}</p></div></div><div className="flex-1 overflow-y-auto px-5 py-5"><h2 className="text-2xl font-bold text-night-sky">{cache.title}</h2>{cache.description&&<p className="mt-3 text-sm leading-6 text-night-sky/65">{cache.description}</p>}<div className="mt-5 rounded-2xl bg-teal/10 p-4"><p className="font-bold text-night-sky">{cache.unique_find_count} {cache.unique_find_count===1?"find":"finds"}</p>{cache.average_rating&&<p className="text-sm text-night-sky/60">★ {cache.average_rating}/5 average rating</p>}</div><div className="mt-5 flex gap-5 border-y border-night-sky/10 py-5"><Rating label="Difficulty" value={cache.difficulty}/><Rating label="Terrain" value={cache.terrain}/></div><button onClick={onBegin} className="mt-5 w-full rounded-2xl bg-night-sky px-5 py-4 text-sm font-bold text-white">Begin adventure</button><section className="mt-6 border-t border-night-sky/10 pt-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-teal">Trail log</p>{(cache.recent_comments||[]).map((entry,index)=><article key={index} className="mt-3 rounded-2xl bg-sand p-4"><p className="text-sm font-bold text-night-sky">{entry.first_name}{entry.rating?` · ★ ${entry.rating}/5`:""}</p><p className="mt-1 text-xs text-night-sky/45">Found {foundDate(entry.found_at)}</p>{entry.comment&&<p className="mt-2 text-sm text-night-sky/70">{entry.comment}</p>}{entry.photo_paths?.map(path=><img key={path} src={photoUrl(path)} alt="Trail find" className="mt-3 h-24 w-full rounded-xl object-cover"/>)}</article>)}</section></div></>;}
function DiscoveryDetail({item,onBack}:{item:DiscoveryItem;onBack:()=>void}){if(item.experience_type==="memorial")return <MemorialDiscoveryDetail experienceId={item.experience_id} fallbackTitle={item.title} fallbackDescription={item.description} onBack={onBack}/>;return <><div className="flex items-center gap-3 border-b border-night-sky/10 px-5 py-4"><button onClick={onBack} className="h-9 w-9 rounded-full border border-night-sky/10">←</button><p className="text-xs font-bold uppercase tracking-[.18em] text-teal">{markerLabel(item.experience_type)}</p></div><div className="flex-1 overflow-y-auto px-5 py-5"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal"><img src={markerIcon(item.marker_variant)} alt="" className="h-8 w-8"/></div><h2 className="mt-4 text-2xl font-bold text-night-sky">{item.title}</h2>{item.description&&<p className="mt-3 text-sm leading-6 text-night-sky/65">{item.description}</p>}</div></>;}
function GenericMineDetail({item,onBack,onEdit}:{item:MyTreasureItem;onBack:()=>void;onEdit?:()=>void}){return <><div className="flex items-center gap-3 border-b border-night-sky/10 px-5 py-4"><button onClick={onBack} className="h-9 w-9 rounded-full border border-night-sky/10">←</button><div><p className="text-xs font-bold uppercase tracking-[.18em] text-teal">My Treasure</p><p className="text-sm font-semibold text-night-sky/60">{markerLabel(item.experience_type)}</p></div></div><div className="flex-1 overflow-y-auto px-5 py-5"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal"><img src={typeIcon(item.experience_type)} alt="" className="h-8 w-8"/></div><h2 className="mt-4 text-2xl font-bold text-night-sky">{item.title}</h2>{item.description&&<p className="mt-3 text-sm leading-6 text-night-sky/65">{item.description}</p>}<div className="mt-5 rounded-2xl bg-sand p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-night-sky/45">Status</p><p className="mt-1 font-bold capitalize text-night-sky">{item.status.replaceAll("_"," ")} · {item.visibility}</p></div>{onEdit&&<button type="button" onClick={onEdit} className="mt-5 w-full rounded-2xl bg-night-sky px-5 py-4 text-sm font-bold text-white">Edit Treasure Box</button>}</div></>;}

function Panel({mode,setMode,items,selectedItem,selectedCache,selectedMine,selectedFind,onSelect,onSelectMine,onSelectFind,onBack,onBegin,myItems,myFinds,onAdd,onEditMine,onDeletedMine,onSavedFind,filter,setFilter}:{mode:PanelMode;setMode:(mode:PanelMode)=>void;items:DiscoveryItem[];selectedItem:DiscoveryItem|null;selectedCache:TrailheadCache|null;selectedMine:MyTreasureItem|null;selectedFind:MyTreasureFind|null;onSelect:(item:DiscoveryItem)=>void;onSelectMine:(item:MyTreasureItem)=>void;onSelectFind:(item:MyTreasureFind)=>void;onBack:()=>void;onBegin:(cache:TrailheadCache)=>void;myItems:MyTreasureItem[];myFinds:MyTreasureFind[];onAdd:()=>void;onEditMine:(item:MyTreasureItem)=>void;onDeletedMine:()=>void;onSavedFind:()=>void;filter:Filter;setFilter:(filter:Filter)=>void}){
 if(selectedCache)return <aside className="flex h-full min-h-0 flex-col bg-white"><TreasureDetail cache={selectedCache} onBack={onBack} onBegin={()=>onBegin(selectedCache)}/></aside>;
 if(selectedItem)return <aside className="flex h-full min-h-0 flex-col bg-white"><DiscoveryDetail item={selectedItem} onBack={onBack}/></aside>;
 if(selectedMine)return <aside className="flex h-full min-h-0 flex-col bg-white">{selectedMine.experience_type==="memorial"?<MemorialOwnerDetail item={selectedMine} onBack={onBack} onEdit={()=>onEditMine(selectedMine)} onDeleted={onDeletedMine}/>:selectedMine.experience_type==="traveling_token"?<TravelingTokenOwnerDetail item={selectedMine} onBack={onBack}/>:<GenericMineDetail item={selectedMine} onBack={onBack} onEdit={selectedMine.experience_type==="treasure_box"?()=>onEditMine(selectedMine):undefined}/>}</aside>;
 if(selectedFind)return <aside className="flex h-full min-h-0 flex-col bg-white"><FindDetail item={selectedFind} onBack={onBack} onSaved={onSavedFind}/></aside>;
 return <aside className="flex h-full min-h-0 flex-col bg-white"><div className="shrink-0 border-b border-night-sky/10 p-4"><div className="grid grid-cols-3 rounded-xl bg-sand p-1"><button onClick={()=>setMode("explore")} className={`rounded-lg px-2 py-2 text-xs font-bold sm:text-sm ${mode==="explore"?"bg-white shadow-sm":"text-night-sky/50"}`}>Explore</button><button onClick={()=>setMode("finds")} className={`rounded-lg px-2 py-2 text-xs font-bold sm:text-sm ${mode==="finds"?"bg-white shadow-sm":"text-night-sky/50"}`}>My Trail Log</button><button onClick={()=>setMode("mine")} className={`rounded-lg px-2 py-2 text-xs font-bold sm:text-sm ${mode==="mine"?"bg-white shadow-sm":"text-night-sky/50"}`}>My Treasure</button></div>{mode==="mine"&&<button onClick={onAdd} className="mt-3 w-full rounded-xl bg-teal px-4 py-3 text-sm font-bold text-white">＋ Add Treasure</button>}{mode==="explore"&&<div className="mt-3 flex gap-1 overflow-x-auto">{([['all','All'],['treasure_box','Treasure Boxes'],['memorial','Memorials'],['token_hunt','Token Hunts']] as [Filter,string][]).map(([value,label])=><button key={value} onClick={()=>setFilter(value)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${filter===value?"bg-night-sky text-white":"bg-sand text-night-sky/60"}`}>{label}</button>)}</div>}</div><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y"><div className="block">{mode==="explore"?(items.length?items.map(item=><ExploreRow key={item.experience_id} item={item} onSelect={()=>onSelect(item)}/>):<p className="px-5 py-8 text-sm text-night-sky/50">Nothing of this type is visible here.</p>):mode==="finds"?(myFinds.length?myFinds.map(item=><FindRow key={item.find_id} item={item} onSelect={()=>onSelectFind(item)}/>):<div className="px-5 py-8"><h3 className="font-bold text-night-sky">Your Trail Log is waiting.</h3><p className="mt-2 text-sm leading-6 text-night-sky/55">Treasure Boxes you find will appear here with the date and time of your first confirmed find.</p></div>):(myItems.length?myItems.map(item=><MyTreasureRow key={item.experience_id} item={item} onSelect={()=>onSelectMine(item)}/>):<div className="px-5 py-8"><h3 className="font-bold text-night-sky">Your treasure starts here.</h3><p className="mt-2 text-sm leading-6 text-night-sky/55">You haven’t added any treasure yet.</p></div>)}</div></div></aside>;
}

export default function TrailheadMap({center,caches,discoveryItems=[],myItems=[],myFinds=[]}:Props){
 const router=useRouter();const containerRef=useRef<HTMLDivElement>(null);const mapRef=useRef<MapboxMap|null>(null);const watchIdRef=useRef<number|null>(null);const retryTimerRef=useRef<number|null>(null);const retryRequestRef=useRef(0);const userMarkerRef=useRef<MapboxMarker|null>(null);const headingElementRef=useRef<HTMLElement|null>(null);const headingDegreesRef=useRef<number|null>(null);const lastLocationRef=useRef<{latitude:number;longitude:number}|null>(null);const initialFocusRef=useRef(false);const exploreRef=useRef(false);const sensorRotationRef=useRef(false);const gestureRef=useRef(false);const zoomingRef=useRef(false);const headingFrameRef=useRef<number|null>(null);const headingTargetRef=useRef<number|null>(null);const resumeRotationRef=useRef<(()=>void)|null>(null);const lastHeadingRef=useRef(0);const markersRef=useRef<MapboxMarker[]>([]);const activeRef=useRef<TrailheadCache|null>(null);const mobileViewRef=useRef<"map"|"list">("map");
 const[scriptReady,setScriptReady]=useState(()=>typeof window!=="undefined"&&Boolean(window.mapboxgl));const[loaded,setLoaded]=useState(false);const[error,setError]=useState<string|null>(null);const[selectedItem,setSelectedItem]=useState<DiscoveryItem|null>(null);const[selectedCache,setSelectedCache]=useState<TrailheadCache|null>(null);const[previewCache,setPreviewCache]=useState<TrailheadCache|null>(null);const[selectedMine,setSelectedMine]=useState<MyTreasureItem|null>(null);const[selectedFind,setSelectedFind]=useState<MyTreasureFind|null>(null);const[active,setActive]=useState<TrailheadCache|null>(null);const[activeDetailsOpen,setActiveDetailsOpen]=useState(false);const[location,setLocation]=useState<{latitude:number;longitude:number}|null>(null);const[locationError,setLocationError]=useState<string|null>(null);const[headingAllowed,setHeadingAllowed]=useState<boolean|null>(null);const[headingAvailable,setHeadingAvailable]=useState(false);const[exploring,setExploring]=useState(false);const[mode,setMode]=useState<PanelMode>("explore");const[filter,setFilter]=useState<Filter>("all");const[mobileView,setMobileView]=useState<"map"|"list">("map");const[visibleIds,setVisibleIds]=useState<string[]>(discoveryItems.map(item=>item.experience_id));const[addView,setAddView]=useState<AddView>(null);const[editMemorialId,setEditMemorialId]=useState<string|null>(null);const[editTreasureBox,setEditTreasureBox]=useState<MyTreasureItem|null>(null);
 const token=process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;const cacheById=useMemo(()=>new Map(caches.map(cache=>[cache.cache_id,cache])),[caches]);const filtered=useMemo(()=>discoveryItems.filter(item=>(filter==="all"||item.experience_type===filter)&&visibleIds.includes(item.experience_id)),[discoveryItems,filter,visibleIds]);
 const isCompact=()=>typeof window!=="undefined"&&window.matchMedia("(max-width: 1023px)").matches;
 const updateVisible=useCallback(()=>{const map=mapRef.current;if(!map)return;if(mobileViewRef.current==="list"&&typeof window!=="undefined"&&window.matchMedia("(max-width: 1023px)").matches)return;const bounds=map.getBounds();setVisibleIds(discoveryItems.filter(item=>bounds.contains([item.longitude,item.latitude])).map(item=>item.experience_id));},[discoveryItems]);
 const showMap=useCallback(()=>{mobileViewRef.current="map";setMobileView("map");setTimeout(()=>{mapRef.current?.resize();updateVisible();},50);},[updateVisible]);
 const showList=useCallback(()=>{updateVisible();mobileViewRef.current="list";setMobileView("list");},[updateVisible]);
 const selectItem=useCallback((item:DiscoveryItem)=>{setSelectedMine(null);const cache=item.cache_id?cacheById.get(item.cache_id):undefined;if(cache){setPreviewCache(cache);setSelectedCache(null);setSelectedItem(null);if(isCompact()){mobileViewRef.current="map";setMobileView("map");window.setTimeout(()=>mapRef.current?.resize(),50);}return;}setPreviewCache(null);setSelectedItem(item);setSelectedCache(null);if(isCompact()){mobileViewRef.current="list";setMobileView("list");}else{mapRef.current?.flyTo({center:[item.longitude,item.latitude],zoom:15,duration:700,essential:true});}},[cacheById]);
 const clearArea=useCallback(()=>{const map=mapRef.current;if(!map)return;if(map.getLayer(SEARCH_LINE))map.removeLayer(SEARCH_LINE);if(map.getLayer(SEARCH_FILL))map.removeLayer(SEARCH_FILL);if(map.getSource(SEARCH_SOURCE))map.removeSource(SEARCH_SOURCE);},[]);
 const updateHeadingMarker=useCallback(()=>{
  const headingElement=headingElementRef.current;
  if(!headingElement)return;
  const heading=headingDegreesRef.current;
  headingElement.style.display=heading===null?"none":"block";
  if(heading!==null)headingElement.style.transform=`rotate(${heading-(mapRef.current?.getBearing()??0)}deg)`;
 },[]);
 const receiveLocation=useCallback((next:{latitude:number;longitude:number},autoFocus=true)=>{
  const map=mapRef.current;
  if(!map||!window.mapboxgl)return;
  lastLocationRef.current=next;
  if(retryTimerRef.current!==null){window.clearTimeout(retryTimerRef.current);retryTimerRef.current=null;}
  setLocation(next);
  setLocationError(null);
  if(!userMarkerRef.current){
   const {element,heading}=createUserMarker();
   headingElementRef.current=heading;
   userMarkerRef.current=new window.mapboxgl.Marker({element,anchor:"center",rotationAlignment:"viewport"}).setLngLat([next.longitude,next.latitude]).addTo(map);
   updateHeadingMarker();
  }else userMarkerRef.current.setLngLat([next.longitude,next.latitude]);
  if(!autoFocus)return;
  if(activeRef.current){
   if(!exploreRef.current)map.flyTo({center:[next.longitude,next.latitude],duration:350,essential:true},{geolocateSource:true});
  }else if(!initialFocusRef.current){
   initialFocusRef.current=true;
   map.flyTo({center:[next.longitude,next.latitude],zoom:13,duration:750,essential:true},{geolocateSource:true});
  }
 },[updateHeadingMarker]);
 const startLocationWatch=useCallback(()=>{
  if(watchIdRef.current!==null)return;
  if(!navigator.geolocation){setLocationError("This browser does not support location.");return;}
  if(!lastLocationRef.current)retryTimerRef.current=window.setTimeout(()=>{retryTimerRef.current=null;setLocationError(stalledLocationMessage());},20000);
  try{
   watchIdRef.current=navigator.geolocation.watchPosition(
    position=>receiveLocation(position.coords),
    error=>{if(retryTimerRef.current!==null){window.clearTimeout(retryTimerRef.current);retryTimerRef.current=null;}setLocationError(locationFailure(error));if(error.code===error.PERMISSION_DENIED&&watchIdRef.current!==null){navigator.geolocation.clearWatch(watchIdRef.current);watchIdRef.current=null;}},
    {enableHighAccuracy:true,timeout:15000,maximumAge:0}
   );
  }catch{if(retryTimerRef.current!==null){window.clearTimeout(retryTimerRef.current);retryTimerRef.current=null;}setLocationError("Location could not start. Tap Retry location.");}
 },[receiveLocation]);
 const stopHeading=useCallback((resetBearing:boolean)=>{if(headingFrameRef.current!==null)window.cancelAnimationFrame(headingFrameRef.current);headingFrameRef.current=null;headingTargetRef.current=null;headingDegreesRef.current=null;lastHeadingRef.current=0;if(headingElementRef.current)headingElementRef.current.style.display="none";if(resetBearing&&mapRef.current&&Math.abs(mapRef.current.getBearing())>.01){sensorRotationRef.current=true;try{mapRef.current.setBearing(0,{geolocateSource:true});}finally{sensorRotationRef.current=false;}}},[]);
 const begin=useCallback((cache:TrailheadCache)=>{const orientationEvent=window.DeviceOrientationEvent as (typeof DeviceOrientationEvent & {requestPermission?:()=>Promise<"granted"|"denied">})|undefined;setHeadingAllowed(null);if(typeof orientationEvent?.requestPermission==="function"){void orientationEvent.requestPermission().then(result=>{if(activeRef.current)setHeadingAllowed(result==="granted");}).catch(()=>{if(activeRef.current)setHeadingAllowed(false);});}else setHeadingAllowed(Boolean(orientationEvent));const map=mapRef.current;if(!map)return;stopHeading(true);setHeadingAvailable(false);setExploring(false);setActiveDetailsOpen(false);clearArea();map.addSource(SEARCH_SOURCE,{type:"geojson",data:{type:"FeatureCollection",features:[searchAreaFeature(cache)]}});map.addLayer({id:SEARCH_FILL,type:"fill",source:SEARCH_SOURCE,paint:{"fill-color":"#14b8a6","fill-opacity":.18}});map.addLayer({id:SEARCH_LINE,type:"line",source:SEARCH_SOURCE,paint:{"line-color":"#0f1d3a","line-width":2.5,"line-opacity":.7,"line-dasharray":[2,2]}});activeRef.current=cache;exploreRef.current=false;markersRef.current.forEach((marker,index)=>{marker.getElement().style.display=discoveryItems[index].cache_id===cache.cache_id?"":"none";});setPreviewCache(null);setSelectedCache(null);setSelectedItem(null);setSelectedMine(null);setActive(cache);mobileViewRef.current="map";setMobileView("map");window.setTimeout(()=>map.resize(),50);const current=lastLocationRef.current;map.flyTo({center:current?[current.longitude,current.latitude]:[cache.search_longitude,cache.search_latitude],zoom:current?Math.max(map.getZoom(),15):14,duration:900,essential:true},{geolocateSource:true});},[clearArea,discoveryItems,stopHeading]);
 const exit=useCallback(()=>{clearArea();exploreRef.current=false;activeRef.current=null;markersRef.current.forEach(marker=>{marker.getElement().style.display="";});setActive(null);setActiveDetailsOpen(false);setHeadingAllowed(null);setHeadingAvailable(false);setExploring(false);stopHeading(true);window.setTimeout(()=>mapRef.current?.resize(),50);},[clearArea,stopHeading]);
 const pauseForExplore=useCallback(()=>{if(activeRef.current&&!sensorRotationRef.current){exploreRef.current=true;setExploring(true);if(headingFrameRef.current!==null)window.cancelAnimationFrame(headingFrameRef.current);headingFrameRef.current=null;}},[]);
 const recenter=useCallback(()=>{
  const map=mapRef.current;
  if(!map)return;
  const focus=(next:{latitude:number;longitude:number})=>{
   initialFocusRef.current=true;
   receiveLocation(next,false);
   exploreRef.current=false;
   setExploring(false);
   map.flyTo({center:[next.longitude,next.latitude],duration:600,essential:true},{geolocateSource:true});
   resumeRotationRef.current?.();
   startLocationWatch();
  };
  if(lastLocationRef.current&&!locationError){focus(lastLocationRef.current);return;}
  if(!navigator.geolocation){setLocationError("This browser does not support location.");return;}
  if(watchIdRef.current!==null){navigator.geolocation.clearWatch(watchIdRef.current);watchIdRef.current=null;}
  if(retryTimerRef.current!==null)window.clearTimeout(retryTimerRef.current);
  const request=++retryRequestRef.current;
  setLocationError(null);
  retryTimerRef.current=window.setTimeout(()=>{if(request!==retryRequestRef.current)return;retryTimerRef.current=null;setLocationError(stalledLocationMessage());},16000);
  navigator.geolocation.getCurrentPosition(position=>{if(request===retryRequestRef.current)focus(position.coords);},error=>{if(request!==retryRequestRef.current)return;if(retryTimerRef.current!==null){window.clearTimeout(retryTimerRef.current);retryTimerRef.current=null;}setLocationError(locationFailure(error));},{enableHighAccuracy:false,timeout:12000,maximumAge:0});
 },[locationError,receiveLocation,startLocationWatch]);
 const initialize=useCallback(()=>{if(!scriptReady||!containerRef.current||mapRef.current||!window.mapboxgl||!token)return;try{setError(null);window.mapboxgl.workerUrl=MAPBOX_CSP_WORKER;const fallback=discoveryItems[0];const map=new window.mapboxgl.Map({accessToken:token,container:containerRef.current,style:"mapbox://styles/mapbox/streets-v12",center:fallback?[fallback.longitude,fallback.latitude]:center,zoom:fallback?12:4});mapRef.current=map;map.on("load",()=>{map.resize();markersRef.current.forEach(marker=>marker.remove());markersRef.current=discoveryItems.map(item=>new window.mapboxgl!.Marker({element:createDiscoveryMarker(item,()=>selectItem(item)),anchor:"bottom"}).setLngLat([item.longitude,item.latitude]).addTo(map));setLoaded(true);setError(null);updateVisible();startLocationWatch();});map.on("move",()=>updateHeadingMarker());map.on("moveend",()=>{updateVisible();});map.on("zoomstart",event=>{zoomingRef.current=true;if(event?.originalEvent){if(activeRef.current)pauseForExplore();else initialFocusRef.current=true;}if(headingFrameRef.current!==null)window.cancelAnimationFrame(headingFrameRef.current);headingFrameRef.current=null;});map.on("zoomend",()=>{zoomingRef.current=false;resumeRotationRef.current?.();});map.on("dragstart",event=>{if(event?.originalEvent){if(activeRef.current)pauseForExplore();else initialFocusRef.current=true;}});map.on("rotatestart",event=>{if(event?.originalEvent&&activeRef.current)pauseForExplore();});map.on("error",event=>setError(event?.error?.message?`Mapbox error: ${event.error.message}`:"Trailhead could not load the map right now."));map.addControl(new window.mapboxgl.NavigationControl({showCompass:true}),"top-right");}catch(caught){setError(caught instanceof Error?`Mapbox error: ${caught.message}`:"Trailhead could not load the map right now.");}},[center,discoveryItems,pauseForExplore,startLocationWatch,updateHeadingMarker,scriptReady,selectItem,token,updateVisible]);
 useEffect(()=>{
  if(!loaded)return;
  const container=containerRef.current;
  if(!container)return;
  const onTouchStart=(event:TouchEvent)=>{
   if(event.touches.length<2||!activeRef.current||gestureRef.current)return;
   const map=mapRef.current;
   if(!map)return;
   gestureRef.current=true;
   pauseForExplore();
   if(headingFrameRef.current!==null)window.cancelAnimationFrame(headingFrameRef.current);
   headingFrameRef.current=null;
  };
  const onTouchEnd=(event:TouchEvent)=>{
   if(!gestureRef.current||event.touches.length>=2)return;
   gestureRef.current=false;
   resumeRotationRef.current?.();
  };
  container.addEventListener("touchstart",onTouchStart,true);
  container.addEventListener("touchend",onTouchEnd,true);
  container.addEventListener("touchcancel",onTouchEnd,true);
  return()=>{
   container.removeEventListener("touchstart",onTouchStart,true);
   container.removeEventListener("touchend",onTouchEnd,true);
   container.removeEventListener("touchcancel",onTouchEnd,true);
   gestureRef.current=false;
  };
 },[loaded,pauseForExplore]);
 useEffect(()=>{
  if(!active||headingAllowed!==true)return;
  const rotate=()=>{
   headingFrameRef.current=null;
   const map=mapRef.current;
   const target=headingTargetRef.current;
   if(!map||target===null||exploreRef.current||gestureRef.current||zoomingRef.current||document.hidden)return;
   const current=map.getBearing();
   const difference=headingDelta(target,current);
   const next=Math.abs(difference)<.5?target:current+difference*.18;
   sensorRotationRef.current=true;
   try{map.setBearing(next,{geolocateSource:true});}finally{sensorRotationRef.current=false;}
   if(Math.abs(difference)>=.5)headingFrameRef.current=window.requestAnimationFrame(rotate);
  };
  const resumeRotation=()=>{
   if(headingFrameRef.current===null&&headingTargetRef.current!==null&&!exploreRef.current&&!gestureRef.current&&!zoomingRef.current&&!document.hidden)headingFrameRef.current=window.requestAnimationFrame(rotate);
  };
  resumeRotationRef.current=resumeRotation;
  const onOrientation=(rawEvent:Event)=>{
   if(document.hidden)return;
   const heading=compassHeading(rawEvent as CompassEvent);
   if(heading===null)return;
   lastHeadingRef.current=Date.now();
   headingTargetRef.current=heading;
   headingDegreesRef.current=heading;
   updateHeadingMarker();
   setHeadingAvailable(true);
   resumeRotation();
  };
  const onVisibility=()=>{if(document.hidden){stopHeading(!exploreRef.current);setHeadingAvailable(false);}};
  window.addEventListener("deviceorientation",onOrientation);
  window.addEventListener("deviceorientationabsolute",onOrientation);
  document.addEventListener("visibilitychange",onVisibility);
  const staleCheck=window.setInterval(()=>{if(lastHeadingRef.current&&Date.now()-lastHeadingRef.current>5000){stopHeading(!exploreRef.current);setHeadingAvailable(false);}},1000);
  return()=>{
   resumeRotationRef.current=null;
   window.removeEventListener("deviceorientation",onOrientation);
   window.removeEventListener("deviceorientationabsolute",onOrientation);
   document.removeEventListener("visibilitychange",onVisibility);
   window.clearInterval(staleCheck);
   stopHeading(false);
  };
 },[active,headingAllowed,stopHeading,updateHeadingMarker]);
 useEffect(()=>{const frame=window.requestAnimationFrame(initialize);const retryRequest=retryRequestRef;return()=>{window.cancelAnimationFrame(frame);stopHeading(false);retryRequest.current++;if(watchIdRef.current!==null){navigator.geolocation.clearWatch(watchIdRef.current);watchIdRef.current=null;}if(retryTimerRef.current!==null){window.clearTimeout(retryTimerRef.current);retryTimerRef.current=null;}markersRef.current.forEach(marker=>marker.remove());markersRef.current=[];userMarkerRef.current?.remove();userMarkerRef.current=null;headingElementRef.current=null;mapRef.current?.remove();mapRef.current=null;};},[initialize,stopHeading]);
 if(!token)return <div className="flex h-full items-center justify-center bg-sand"><p className="font-bold text-night-sky">Trailhead needs its Mapbox token.</p></div>;
 const clearSelections=()=>{setSelectedItem(null);setSelectedCache(null);setPreviewCache(null);setSelectedMine(null);setSelectedFind(null);};const refreshMine=()=>{clearSelections();setMode("mine");router.refresh();};const refreshFinds=()=>{clearSelections();setMode("finds");router.refresh();};const panel=<Panel mode={mode} setMode={value=>{setMode(value);clearSelections();}} items={filtered} selectedItem={selectedItem} selectedCache={selectedCache} selectedMine={selectedMine} selectedFind={selectedFind} onSelect={selectItem} onSelectMine={item=>{clearSelections();setSelectedMine(item);}} onSelectFind={item=>{clearSelections();setSelectedFind(item);}} onBack={clearSelections} onBegin={begin} myItems={myItems} myFinds={myFinds} onAdd={()=>setAddView("chooser")} onEditMine={item=>{if(item.experience_type==="memorial")setEditMemorialId(item.experience_id);if(item.experience_type==="treasure_box")setEditTreasureBox(item);}} onDeletedMine={refreshMine} onSavedFind={refreshFinds} filter={filter} setFilter={setFilter}/>;
  return <div className="relative flex h-full min-h-[520px] w-full flex-col bg-sand lg:flex-row"><link href={`https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.css`} rel="stylesheet"/><Script src={MAPBOX_CSP_SCRIPT} strategy="afterInteractive" onLoad={()=>setScriptReady(true)} onReady={()=>setScriptReady(true)} onError={()=>setError("Trailhead could not load Mapbox right now.")}/>{!active&&<div className="hidden h-full w-[380px] shrink-0 border-r border-night-sky/10 lg:block">{panel}</div>}{!active&&<div className="shrink-0 border-b border-night-sky/10 bg-white p-2 lg:hidden"><div className="grid grid-cols-2 rounded-xl bg-sand p-1"><button type="button" onClick={showMap} className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${mobileView==="map"?"bg-white text-night-sky shadow-sm":"text-night-sky/50"}`}>Map</button><button type="button" onClick={showList} className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${mobileView==="list"?"bg-white text-night-sky shadow-sm":"text-night-sky/50"}`}>List{mode==="explore"?` (${filtered.length})`:""}</button></div></div>}<div className={`relative min-h-0 min-w-0 flex-1 ${mobileView==="list"?"hidden lg:block":"block"}`}><div ref={containerRef} className="trailhead-map absolute inset-0 h-full w-full"/>{(!scriptReady||!loaded)&&!error&&<div className="absolute inset-0 flex items-center justify-center bg-sand text-sm font-semibold text-night-sky/60">Opening Trailhead…</div>}{error&&<div className="absolute inset-0 flex items-center justify-center bg-sand px-6 text-center"><p className="font-semibold text-night-sky">{error}</p></div>}{!active&&<button type="button" onClick={recenter} className="absolute right-4 top-28 z-30 rounded-full bg-white px-4 py-2 text-sm font-bold text-night-sky shadow-lg">◎ Find me</button>}{locationError&&!active&&<p role="status" className="absolute left-4 top-4 z-30 max-w-[65%] rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-night-sky shadow-lg">{locationError}</p>}{previewCache&&!active&&<div className="absolute bottom-4 left-4 right-4 z-30 max-w-sm rounded-3xl bg-white/95 p-4 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-teal">{previewCache.public_code}</p><h2 className="mt-1 text-lg font-bold text-night-sky">{previewCache.title}</h2></div><button type="button" onClick={()=>setPreviewCache(null)} aria-label="Close box preview" className="text-xl text-night-sky/60">×</button></div><p className="mt-2 text-sm text-night-sky/65">{location?distanceLabel(distanceMeters(location.latitude,location.longitude,previewCache.search_latitude,previewCache.search_longitude)):"Distance available with location"} · Difficulty {previewCache.difficulty}/5 · Terrain {previewCache.terrain}/5</p><button type="button" onClick={()=>{setSelectedCache(previewCache);setPreviewCache(null);if(isCompact()){mobileViewRef.current="list";setMobileView("list");}}} className="mt-3 font-bold text-teal">View box details →</button></div>}{active&&<><div className="absolute bottom-4 left-4 right-4 z-30 max-w-sm rounded-3xl bg-white/95 p-4 shadow-2xl"><p className="text-[10px] font-bold uppercase tracking-widest text-coral">Adventure in progress</p><h2 className="mt-1 text-lg font-bold text-night-sky">{active.title}</h2><p className="mt-1 text-sm font-semibold text-night-sky">{location?distanceLabel(distanceMeters(location.latitude,location.longitude,active.search_latitude,active.search_longitude)):"Waiting for your location"}</p><p className="mt-1 text-xs text-night-sky/60" aria-live="polite">{locationError??(exploring?"Exploring map · tap Recenter to follow":headingAllowed===false?"Compass unavailable · GPS still works":headingAvailable?"Heading-up map active":"Waiting for compass · map stays north up")}</p>{activeDetailsOpen&&<div className="mt-3 max-h-[30vh] overflow-y-auto border-t border-night-sky/10 pt-3 text-sm text-night-sky/70">{active.description&&<p className="leading-6">{active.description}</p>}<p className="mt-2">Difficulty {active.difficulty}/5 · Terrain {active.terrain}/5</p><p className="mt-2">Search within the highlighted area. GPS is approximate; the marker is not the exact hiding spot.</p></div>}<div className="mt-3 flex flex-wrap items-center gap-3">{(exploring||locationError)&&<button type="button" onClick={recenter} className="rounded-full bg-night-sky px-3 py-2 text-xs font-bold text-white">◎ {locationError?"Retry location":"Recenter"}</button>}<button type="button" onClick={()=>setActiveDetailsOpen(value=>!value)} className="text-xs font-bold text-teal">{activeDetailsOpen?"Hide details":"Box details"}</button><button type="button" onClick={exit} className="text-xs font-bold text-night-sky/60">Exit adventure</button></div></div></>}</div>{!active&&<div className={`min-h-0 flex-1 overflow-hidden bg-white lg:hidden ${mobileView==="list"?"block":"hidden"}`}>{panel}</div>}{addView&&<div className="absolute inset-0 z-50 flex items-center justify-center bg-night-sky/45 p-5"><div className="h-[min(760px,92vh)] w-full max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-2xl">{addView==="memorial"?<MemorialCreateForm onCancel={()=>setAddView("chooser")} onCreated={()=>{setAddView(null);refreshMine();}}/>:<div className="p-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-teal">My Treasure</p><h2 className="mt-2 text-2xl font-bold text-night-sky">What are you adding?</h2><p className="mt-2 text-sm leading-6 text-night-sky/55">Choose the kind of treasure you’re placing into the LegacyLink world.</p><div className="mt-5 grid gap-2"><div className="rounded-2xl border border-night-sky/15 p-4 text-left font-bold text-night-sky">Treasure Box <span className="block text-xs font-normal text-night-sky/45">Activate a new physical Treasure Box by tapping its NFC tag.</span></div><button onClick={()=>setAddView("memorial")} className="rounded-2xl border border-teal bg-teal/10 p-4 text-left font-bold text-night-sky">Memorial / Headstone <span className="block text-xs font-normal text-night-sky/45">Create and publish a memorial now</span></button>{TREASURE_BOX_ADVANCED_EXPERIENCES_ENABLED&&<button className="rounded-2xl border border-night-sky/15 p-4 text-left font-bold text-night-sky">Specialty Token <span className="block text-xs font-normal text-night-sky/45">Token placement flow coming next</span></button>}</div><button onClick={()=>setAddView(null)} className="mt-5 w-full rounded-2xl bg-night-sky px-5 py-4 text-sm font-bold text-white">Close</button></div>}</div></div>}{editMemorialId&&<div className="absolute inset-0 z-50 flex items-center justify-center bg-night-sky/45 p-5"><div className="h-[min(820px,94vh)] w-full max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-2xl"><MemorialEditForm experienceId={editMemorialId} onCancel={()=>setEditMemorialId(null)} onSaved={()=>{setEditMemorialId(null);refreshMine();}}/></div></div>}{editTreasureBox&&<div className="absolute inset-0 z-50 flex items-center justify-center bg-night-sky/45 p-5"><div className="h-[min(680px,92vh)] w-full max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-2xl"><TreasureBoxEditForm experienceId={editTreasureBox.experience_id} initialTitle={editTreasureBox.title} initialDescription={editTreasureBox.description} onCancel={()=>setEditTreasureBox(null)} onSaved={()=>{setEditTreasureBox(null);refreshMine();}}/></div></div>}</div>;
}
