"use client";

import {useEffect,useState} from "react";

export type MeasurementUnits="imperial"|"metric";
export const MEASUREMENT_KEY="legacylink:trailhead:units";
export const MEASUREMENT_EVENT="legacylink:trailhead:units-changed";
export function readMeasurementUnits():MeasurementUnits{
  if(typeof window==="undefined")return "imperial";
  try{return window.localStorage.getItem(MEASUREMENT_KEY)==="metric"?"metric":"imperial";}catch{return "imperial";}
}
export function setMeasurementUnits(value:MeasurementUnits){
  try{window.localStorage.setItem(MEASUREMENT_KEY,value);}catch{}
  window.dispatchEvent(new Event(MEASUREMENT_EVENT));
}
export function useMeasurementUnits(){
  const[units,setUnits]=useState<MeasurementUnits>("imperial");
  useEffect(()=>{
    const update=()=>setUnits(readMeasurementUnits());
    update();
    window.addEventListener(MEASUREMENT_EVENT,update);
    window.addEventListener("storage",update);
    return()=>{window.removeEventListener(MEASUREMENT_EVENT,update);window.removeEventListener("storage",update);};
  },[]);
  return [units,setMeasurementUnits] as const;
}
export function formatDistance(meters:number,units:MeasurementUnits){
  if(units==="metric")return meters<1000?`${Math.round(meters)} m`:`${(meters/1000).toFixed(1)} km`;
  const feet=meters*3.280839895;
  return feet<300?`${Math.round(feet)} ft`:` ${(feet/5280).toFixed(1)} mi`.trim();
}
export default function TrailheadMeasurementSettings(){
  const[units,changeUnits]=useMeasurementUnits();
  return <div className="rounded-2xl border border-night-sky/10 bg-white p-4">
    <h3 className="font-bold text-night-sky">Measurement units</h3>
    <p className="mt-1 text-xs leading-5 text-night-sky/55">Choose how distances appear in Trailhead. Treasure Box radii remain stored in meters.</p>
    <div className="mt-3 grid grid-cols-2 gap-2">
      {(["imperial","metric"] as const).map(value=><button key={value} type="button" aria-pressed={units===value} onClick={()=>changeUnits(value)} className={`rounded-xl border px-3 py-3 text-sm font-bold ${units===value?"border-teal bg-teal/10 text-night-sky":"border-night-sky/10 text-night-sky/60"}`}>{value==="imperial"?"Feet & miles":"Meters & km"}</button>)}
    </div>
    <p className="mt-2 text-xs text-night-sky/45">Saved on this browser. Account synchronization will follow.</p>
  </div>;
}
