"use client";

import Script from "next/script";
import {useEffect, useEffectEvent, useRef, useState} from "react";
import {formatDistance, useMeasurementUnits} from "@/components/trailhead/TrailheadMeasurementSettings";
import {MAPBOX_CSP_SCRIPT, MAPBOX_CSP_WORKER, MAPBOX_GL_VERSION, type MapboxMap, type MapboxMarker} from "@/utils/trailhead/mapbox";
import {parsePlacement, radiusPolygon, type Placement} from "@/utils/trailhead/placement";

type Props = {
  latitude: string; longitude: string; radius: number;
  onChange: (latitude: string, longitude: string) => void;
};
const empty = {type:"FeatureCollection",features:[]};

export default function PlacementEditor({latitude,longitude,radius,onChange}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const pin = useRef<MapboxMarker | null>(null);
  const [ready,setReady] = useState(false);
  const [loaded,setLoaded] = useState(false);
  const [warning,setWarning] = useState("");
  const [locating,setLocating] = useState(false);
  const [accuracy,setAccuracy] = useState<number | null>(null);
  const gpsRequest = useRef(0);
  const [units] = useMeasurementUnits();
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const currentRadius = useEffectEvent(() => radius);
  const mapUnavailable = useEffectEvent(() => setWarning("Satellite imagery is unavailable. Use GPS or enter coordinates below."));
  const initial = useEffectEvent(() => parsePlacement(latitude,longitude));
  const choose = useEffectEvent((point: Placement) => {
    gpsRequest.current++;
    setLocating(false);
    setAccuracy(null);
    onChange(point.latitude.toFixed(7),point.longitude.toFixed(7));
  });
  useEffect(() => () => { gpsRequest.current++; }, []);
  useEffect(() => {
    const api = window.mapboxgl;
    if (!ready || !api || !token || !host.current) return;
    const p = initial();
    api.workerUrl = MAPBOX_CSP_WORKER;
    let instance: MapboxMap;
    try {
      instance = new api.Map({container:host.current,accessToken:token,style:"mapbox://styles/mapbox/satellite-streets-v12",
        center:p ? [p.longitude,p.latitude] : [-98.5795,39.8283],zoom:p ? 19 : 3,maxZoom:22});
    } catch {
      const frame = requestAnimationFrame(mapUnavailable);
      return () => cancelAnimationFrame(frame);
    }
    map.current = instance;
    instance.addControl(new api.NavigationControl({showCompass:false}),"top-right");
    instance.on("click",({lngLat}) => choose({latitude:lngLat.lat,longitude:((lngLat.lng+540)%360)-180}));
    instance.on("load",() => {
      instance.addSource("placement-radius",{type:"geojson",data:empty});
      instance.addLayer({id:"placement-fill",type:"fill",source:"placement-radius",paint:{"fill-color":"#28b8ac","fill-opacity":0.22}});
      instance.addLayer({id:"placement-line",type:"line",source:"placement-radius",paint:{"line-color":"#fff","line-width":2}});
      setLoaded(true);
    });
    instance.on("error",() => setWarning("Some imagery could not load. GPS and manual coordinates are still available."));
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(host.current);
    return () => { observer.disconnect(); pin.current?.remove(); pin.current=null; instance.remove(); map.current=null; };
  },[ready,token]);

  useEffect(() => {
    const instance=map.current, api=window.mapboxgl;
    if(!loaded || !instance || !api) return;
    const point=parsePlacement(latitude,longitude);
    const source=instance.getSource("placement-radius");
    source?.setData?.(point && Number.isFinite(radius) && radius>0 ? radiusPolygon(point,radius) : empty);
    if(!point){pin.current?.remove();pin.current=null;return;}
    if(!pin.current){
      const marker=new api.Marker({draggable:true,color:"#0c807c"}).setLngLat([point.longitude,point.latitude]).addTo(instance);
      marker.on("drag",()=>{
        const {lat,lng}=marker.getLngLat();
        const meters = currentRadius();
        if(Number.isFinite(meters) && meters > 0) source?.setData?.(radiusPolygon({latitude:lat,longitude:lng},meters));
      });
      marker.on("dragend",()=>{const {lat,lng}=marker.getLngLat();choose({latitude:lat,longitude:((lng+540)%360)-180});});
      pin.current=marker;
    } else pin.current.setLngLat([point.longitude,point.latitude]);
    if(!instance.getBounds().contains([point.longitude,point.latitude])) instance.flyTo({center:[point.longitude,point.latitude],zoom:19,duration:0});
  },[loaded,latitude,longitude,radius]);

  function capture(){
    if(!navigator.geolocation){setWarning("GPS is unavailable. Tap the map or enter coordinates.");return;}
    const request=++gpsRequest.current;
    setLocating(true);setWarning("");
    navigator.geolocation.getCurrentPosition(({coords})=>{
      if(request!==gpsRequest.current)return;
      onChange(coords.latitude.toFixed(7),coords.longitude.toFixed(7));
      setLocating(false);setAccuracy(coords.accuracy);
      map.current?.flyTo({center:[coords.longitude,coords.latitude],zoom:19});
    },()=>{if(request===gpsRequest.current){setLocating(false);setWarning("Couldn’t get your location. Tap the map or enter coordinates.");}},
    {enableHighAccuracy:true,maximumAge:0,timeout:12000});
  }
  function manual(lat:string,lng:string){gpsRequest.current++;setLocating(false);setAccuracy(null);onChange(lat,lng);}
  return <div className="space-y-3">
    <button type="button" onClick={capture} disabled={locating} className="button-secondary">{locating?"Finding location…":"Use my current location"}</button>
    {accuracy!==null && <p role="status">GPS accuracy: about {formatDistance(accuracy,units)}.</p>}
    {token && <>
      <link rel="stylesheet" href={`https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_GL_VERSION}/mapbox-gl.css`}/>
      <Script src={MAPBOX_CSP_SCRIPT} onReady={()=>setReady(true)} onError={()=>setWarning("Satellite imagery is unavailable. Use GPS or manual coordinates.")}/>
      <p className="text-sm">Zoom in and tap the hiding spot, or drag the pin to refine it. The circle shows the selected radius around your pin.</p>
      <div ref={host} aria-label="Satellite placement map" className="h-[45vh] min-h-72 max-h-[34rem] w-full overflow-hidden rounded-xl bg-sand"/>
    </>}
    {(warning || !token) && <p role="status">{warning || "Satellite imagery is unavailable. Use GPS or enter coordinates."}</p>}
    <div className="grid gap-2 sm:grid-cols-2">
      <label>Latitude<input className="mt-1 w-full rounded-lg border p-2" value={latitude} onChange={e=>manual(e.target.value,longitude)}/></label>
      <label>Longitude<input className="mt-1 w-full rounded-lg border p-2" value={longitude} onChange={e=>manual(latitude,e.target.value)}/></label>
    </div>
  </div>;
}
