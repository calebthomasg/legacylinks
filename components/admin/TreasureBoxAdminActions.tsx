"use client";

import {useMemo,useState} from "react";
import {createClient} from "@/utils/supabase/client";

type Result={box_id:string;activation_pin:string;nfc_public_token:string;nfc_path:string};

export default function TreasureBoxAdminActions({
  itemId,status,isSuperAdmin,onChanged
}:{itemId:string;status:string;isSuperAdmin:boolean;onChanged:()=>Promise<void>}){
  const supabase=useMemo(()=>createClient(),[]);
  const[busy,setBusy]=useState(false);
  const[result,setResult]=useState<Result|null>(null);
  const[error,setError]=useState<string|null>(null);
  const isDesignated=itemId==="LL-TB-000004"||itemId==="LL-TB-000007";

  async function regenerate(){
    setBusy(true);setError(null);setResult(null);
    const{data,error}=await supabase.rpc("admin_regenerate_treasure_box_activation_pin",{p_box_id:itemId});
    setBusy(false);
    if(error){setError(error.message);return}
    const row=(Array.isArray(data)?data[0]:data) as Result|null;
    if(row)setResult(row);
    await onChanged();
  }

  async function reset(){
    const phrase=`RESET ${itemId}`;
    const confirmation=window.prompt(`This removes the current setup data for ${itemId} but keeps its physical ID and NFC URL. Type exactly: ${phrase}`);
    if(confirmation!==phrase)return;
    setBusy(true);setError(null);setResult(null);
    const{data,error}=await supabase.rpc("admin_reset_designated_test_treasure_box",{p_box_id:itemId,p_confirmation:confirmation});
    setBusy(false);
    if(error){setError(error.message);return}
    const row=(Array.isArray(data)?data[0]:data) as Result|null;
    if(row)setResult(row);
    await onChanged();
  }

  return <div className="min-w-[180px]">
    <div className="flex flex-wrap gap-2">
      {status==="Unclaimed"&&<button type="button" disabled={busy} onClick={regenerate} className="rounded-lg border border-night-sky/15 px-2.5 py-1.5 text-xs font-bold text-night-sky disabled:opacity-50">New PIN</button>}
      {isSuperAdmin&&isDesignated&&<button type="button" disabled={busy} onClick={reset} className="rounded-lg border border-coral/30 px-2.5 py-1.5 text-xs font-bold text-coral disabled:opacity-50">Reset test box</button>}
    </div>
    {error&&<p className="mt-2 text-xs font-semibold text-coral">{error}</p>}
    {result&&<div className="mt-2 rounded-xl bg-teal/10 p-2.5 text-xs">
      <p className="font-bold text-teal">New one-time PIN</p>
      <p className="mt-1 font-mono text-base font-bold tracking-[.12em] text-night-sky">{result.activation_pin}</p>
      <p className="mt-1 break-all text-night-sky/45">{result.nfc_path}</p>
    </div>}
  </div>
}
