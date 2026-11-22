"use client";

import {FormEvent, useEffect, useMemo, useState} from "react";
import {createClient} from "@/utils/supabase/client";

import SearchRadiusField, { validRadius } from "./SearchRadiusField";

type Props={
  experienceId:string;
  cacheId:string;
  initialTitle:string;
  initialDescription:string|null;
  onCancel:()=>void;
  onSaved:()=>void;
};

export default function TreasureBoxEditForm({experienceId,cacheId,initialTitle,initialDescription,onCancel,onSaved}:Props){
  const supabase=useMemo(()=>createClient(),[]);
  const[title,setTitle]=useState(initialTitle);
  const[description,setDescription]=useState(initialDescription??"");
  const [originalRadius, setOriginalRadius] = useState<number | null>(null);
  const [radius, setRadius] = useState<number | null>(null);
  const[hint,setHint]=useState("");
  const[hintLoaded,setHintLoaded]=useState(false);
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState<string|null>(null);

  useEffect(()=>{
    let active=true;
    supabase.rpc("get_my_treasure_boxes").eq("cache_id",cacheId).maybeSingle<{search_radius_meters:number|null}>().then(({data,error})=>{
      if(!active)return;
      if(error || !data || data.search_radius_meters == null){setError("Couldn’t load the saved search radius. Reopen the editor to retry.");return;}
      setOriginalRadius(data.search_radius_meters);
      setRadius(data.search_radius_meters);
    });
    supabase.rpc("get_owned_treasure_box_hint",{p_cache_id:cacheId}).then(({data,error:loadError})=>{
      if(!active)return;
      if(loadError)setError("We couldn't load this box's hint. Please reopen the editor.");
      else{setHint(typeof data==="string"?data:"");setHintLoaded(true);}
    });
    return()=>{active=false};
  },[supabase,cacheId]);

  async function submit(event:FormEvent){
    event.preventDefault();
    setError(null);
    if(!title.trim()){
      setError("Give your Treasure Box a name.");
      return;
    }
    if(radius === null || !validRadius(radius)){setError("Choose a radius between 10 feet and one mile.");return;}
    setSaving(true);
    const {error:saveError}=await supabase.rpc("edit_published_treasure_box",{
      p_experience_id:experienceId,
      p_title:title.trim(),
      p_description:description.trim()||null,
      p_hint:hint.trim()||null,
      p_radius:radius === originalRadius ? null : radius,
    });
    setSaving(false);
    if(saveError){
      setError(saveError.message);
      return;
    }
    onSaved();
  }

  return <div className="flex h-full min-h-0 flex-col bg-white">
    <div className="flex items-center gap-3 border-b border-night-sky/10 px-5 py-4">
      <button type="button" onClick={onCancel} className="flex h-9 w-9 items-center justify-center rounded-full border border-night-sky/10 text-xl" aria-label="Cancel editing">←</button>
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-teal">My Treasure</p><h2 className="font-bold text-night-sky">Edit Treasure Box</h2></div>
    </div>
    <form onSubmit={submit} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
      <div className="rounded-2xl bg-teal/10 p-4 text-sm leading-6 text-night-sky/65">These changes update what Trailblazers see. Your placement, NFC verification, published status, ownership, and find history stay unchanged.</div>
      <label className="mt-5 block text-xs font-bold uppercase tracking-[.12em] text-night-sky/55">Treasure Box name
        <input value={title} onChange={event=>setTitle(event.target.value)} maxLength={160} required className="mt-2 w-full rounded-2xl border border-night-sky/15 bg-white px-4 py-3 text-base text-night-sky outline-none focus:border-teal"/>
      </label>
      <label className="mt-4 block text-xs font-bold uppercase tracking-[.12em] text-night-sky/55">Description
        <textarea value={description} onChange={event=>setDescription(event.target.value)} maxLength={4000} rows={7} className="mt-2 w-full resize-y rounded-2xl border border-night-sky/15 bg-white px-4 py-3 text-sm leading-6 text-night-sky outline-none focus:border-teal"/>
      </label>
      <p className="mt-2 text-right text-xs text-night-sky/40">{description.length}/4000</p>
      <label className="mt-4 block text-xs font-bold uppercase tracking-[.12em] text-night-sky/55">Hint <span className="normal-case font-normal">(optional)</span>
        <textarea value={hint} onChange={event=>setHint(event.target.value)} maxLength={1000} rows={3} placeholder="A clue Trailblazers can open when they need help" className="mt-2 w-full resize-y rounded-2xl border border-night-sky/15 bg-white px-4 py-3 text-sm leading-6 text-night-sky outline-none focus:border-teal"/>
      </label>
      <p className="mt-2 text-right text-xs text-night-sky/40">{hint.length}/1000</p>
      {radius !== null && <SearchRadiusField meters={radius} onChange={setRadius} />}
      {error&&<p className="mt-5 rounded-2xl bg-coral/10 p-4 text-sm font-semibold text-night-sky" role="alert">{error}</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-2xl border border-night-sky/15 bg-white px-5 py-4 text-sm font-bold text-night-sky disabled:opacity-50">Cancel</button>
        <button disabled={saving||!hintLoaded||radius===null||!title.trim()} className="rounded-2xl bg-night-sky px-5 py-4 text-sm font-bold text-white disabled:opacity-50">{saving?"Saving…":!hintLoaded?"Loading…":"Save Changes"}</button>
      </div>
    </form>
  </div>;
}
