"use client";
import {useEffect,useState} from "react";
import {createClient} from "@/utils/supabase/client";
export type Notice={id:string;category:string;headline:string;description:string;button_text:string;status:string;created_at:string};
const symbols:Record<string,string>={fix:"🔧",feature:"✨",maintenance:"🕒",announcement:"📣",important:"⚠️"};
const accents:Record<string,string>={fix:"#ffc83d",feature:"#6dbf67",maintenance:"#4daaf5",announcement:"#14b8a6",important:"#ff6868"};
export function NoticeDialog({notice,onClose}:{notice:Notice;onClose:()=>void}){
 useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=previous}},[]);
 return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-night-sky/65 p-4" role="presentation">
 <section role="dialog" aria-modal="true" aria-labelledby="site-notice-title" aria-describedby="site-notice-description" className="relative w-full max-w-md rounded-3xl bg-white p-7 text-night-sky shadow-2xl">
 <button aria-label="Dismiss notice" onClick={onClose} className="absolute right-5 top-4 rounded-full p-2 text-night-sky/60 hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2">✕</button>
 <div aria-hidden="true" className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-3xl" style={{backgroundColor:accents[notice.category]||"#f5f1e6"}}>{symbols[notice.category]||"📣"}</div>
 <h2 id="site-notice-title" className="pr-7 text-2xl font-extrabold">{notice.headline}</h2>
 <p id="site-notice-description" className="mt-4 whitespace-pre-wrap text-sm leading-7 text-night-sky/75">{notice.description}</p>
 <button onClick={onClose} autoFocus className="mt-7 w-full rounded-2xl bg-forest px-5 py-3 font-bold text-white hover:opacity-90">{notice.button_text}</button>
 </section></div>;
}
export default function SitewideNotice(){
 const [notices,setNotices]=useState<Notice[]>([]);const [index,setIndex]=useState(0);
 useEffect(()=>{let alive=true;const supabase=createClient();void supabase.from("sitewide_notices").select("id,category,headline,description,button_text,status,created_at").eq("status","published").order("created_at",{ascending:true}).then(({data})=>{if(alive)setNotices((data||[]).filter(n=>{try{return localStorage.getItem("legacylink:notice:"+n.id)!=="dismissed"}catch{return true}}))});return()=>{alive=false}},[]);
 const notice=notices[index];if(!notice)return null;
 return <NoticeDialog key={notice.id} notice={notice} onClose={()=>{try{localStorage.setItem("legacylink:notice:"+notice.id,"dismissed")}catch{}setIndex(i=>i+1)}}/>;
}
