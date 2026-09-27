"use client";

import {FormEvent, useMemo, useState} from "react";
import {createClient} from "@/utils/supabase/client";

type Props={
  experienceId:string;
  initialTitle:string;
  initialDescription:string|null;
  onCancel:()=>void;
  onSaved:()=>void;
};

export default function TreasureBoxEditForm({experienceId,initialTitle,initialDescription,onCancel,onSaved}:Props){
  const supabase=useMemo(()=>createClient(),[]);
  const[title,setTitle]=useState(initialTitle);
  const[description,setDescription]=useState(initialDescription??"");
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState<string|null>(null);

  async function submit(event:FormEvent){
    event.preventDefault();
    setError(null);
    if(!title.trim()){
      setError("Give your Treasure Box a name.");
      return;
    }
    setSaving(true);
    const{error:saveError}=await supabase.rpc("update_published_treasure_box_metadata",{
      p_experience_id:experienceId,
      p_title:title.trim(),
      p_description:description.trim()||null,
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
      {error&&<p className="mt-5 rounded-2xl bg-coral/10 p-4 text-sm font-semibold text-night-sky" role="alert">{error}</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-2xl border border-night-sky/15 bg-white px-5 py-4 text-sm font-bold text-night-sky disabled:opacity-50">Cancel</button>
        <button disabled={saving||!title.trim()} className="rounded-2xl bg-night-sky px-5 py-4 text-sm font-bold text-white disabled:opacity-50">{saving?"Saving…":"Save Changes"}</button>
      </div>
    </form>
  </div>;
}
