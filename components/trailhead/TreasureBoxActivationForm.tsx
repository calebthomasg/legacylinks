"use client";

import {FormEvent,useMemo,useState} from "react";
import {createClient} from "@/utils/supabase/client";

type Props={token:string;boxId:string};

type ClaimResult={physical_box_id:string;box_id:string;was_claimed:boolean;setup_status:string};

export default function TreasureBoxActivationForm({token,boxId}:Props){
 const supabase=useMemo(()=>createClient(),[]);
 const[pin,setPin]=useState("");
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState<string|null>(null);
 const[claimed,setClaimed]=useState<ClaimResult|null>(null);

 async function submit(e:FormEvent){
  e.preventDefault();setError(null);setBusy(true);
  const normalized=pin.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6);
  const{data,error}=await supabase.rpc("claim_physical_treasure_box_by_pin",{p_nfc_public_token:token,p_activation_pin:normalized});
  setBusy(false);
  if(error){setError(error.message);return}
  const row=Array.isArray(data)?data[0]:data;
  if(row)setClaimed(row as ClaimResult);
 }

 if(claimed)return <div className="mt-8 rounded-2xl border-2 border-teal/30 bg-teal/10 p-5"><p className="text-xs font-bold uppercase tracking-[.14em] text-teal">Treasure Box claimed</p><h2 className="mt-2 text-2xl font-bold text-night-sky">This box is yours.</h2><p className="mt-3 leading-7 text-night-sky/65">{claimed.box_id} is now connected to your LegacyLink account. The next step is to set up its Trailhead details, location, and content.</p><div className="mt-5 rounded-xl bg-white p-4 text-sm leading-6 text-night-sky/55">Setup status: <strong className="text-night-sky">In progress</strong></div><p className="mt-4 text-sm text-night-sky/50">The full Treasure Box setup wizard is the next development step, so for this test you can stop here after confirming the claim succeeded.</p></div>;

 return <form onSubmit={submit} className="mt-8"><label className="block text-xs font-bold uppercase tracking-[.12em] text-night-sky/55">Activation PIN<input value={pin} onChange={e=>setPin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6))} inputMode="text" autoCapitalize="characters" autoComplete="one-time-code" placeholder="K7M4P9" className="mt-2 w-full rounded-2xl border border-night-sky/15 bg-white px-4 py-4 text-center font-mono text-2xl font-bold uppercase tracking-[.2em] text-night-sky outline-none focus:border-teal"/></label><p className="mt-2 text-xs leading-5 text-night-sky/45">Enter the six-character PIN from the setup card inside Treasure Box {boxId}.</p>{error&&<p className="mt-4 rounded-2xl bg-coral/10 p-3 text-sm font-semibold text-night-sky">{error}</p>}<button disabled={busy||pin.length!==6} className="mt-5 w-full rounded-2xl bg-night-sky px-5 py-4 text-sm font-bold text-white disabled:opacity-40">{busy?"Claiming Treasure Box…":"Claim My Treasure Box"}</button></form>;
}
