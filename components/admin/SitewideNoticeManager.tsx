"use client";
import {FormEvent,useEffect,useState} from "react";
import {createClient} from "@/utils/supabase/client";
import {NoticeDialog,type Notice} from "@/components/notices/SitewideNotice";
const categories=[["fix","Fix / Known Issue"],["feature","New Feature"],["maintenance","Scheduled Maintenance"],["announcement","General Announcement"],["important","Important Update"]];
export default function SitewideNoticeManager(){
 const [rows,setRows]=useState<Notice[]>([]),[category,setCategory]=useState("fix"),[headline,setHeadline]=useState(""),[description,setDescription]=useState(""),[buttonText,setButtonText]=useState("Got it, thanks!"),[preview,setPreview]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const supabase=createClient();
 async function refresh(){const {data,error}=await supabase.from("sitewide_notices").select("*").order("created_at",{ascending:false});if(error)setMessage(error.message);else setRows(data||[])}
 useEffect(()=>{void refresh()},[]);
 async function save(e:FormEvent<HTMLFormElement>,status:"draft"|"published"){e.preventDefault();setBusy(true);setMessage("");const {error}=await supabase.from("sitewide_notices").insert({category,headline:headline.trim(),description:description.trim(),button_text:buttonText.trim(),status});setBusy(false);if(error){setMessage(error.message);return}setMessage(status==="published"?"Notice published.":"Draft saved.");setHeadline("");setDescription("");await refresh()}
 async function changeStatus(id:string,status:"published"|"inactive"){setMessage("");const {error}=await supabase.from("sitewide_notices").update({status,updated_at:new Date().toISOString()}).eq("id",id);if(error)setMessage(error.message);else await refresh()}
 const sample:Notice={id:"preview",category,headline:headline||"Notice headline",description:description||"Notice description",button_text:buttonText||"Got it",status:"draft",created_at:""};
 return <section className="mt-6 rounded-3xl border border-night-sky/10 bg-white p-5 shadow-sm lg:p-6">
 <p className="text-xs font-bold uppercase tracking-[.14em] text-teal">Communication</p><h2 className="mt-1 text-xl font-bold">Sitewide Notices</h2><p className="mt-2 text-sm text-night-sky/60">Publish one-time announcements across LegacyLink. Each visitor can dismiss each notice individually.</p>
 <form id="sitewide-notice-editor" onSubmit={e=>save(e,"draft")} className="mt-5 grid gap-3">
 <label className="text-sm font-bold">Notice category<select className="mt-1 w-full rounded-xl border p-3" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 <label className="text-sm font-bold">Headline<input required maxLength={120} className="mt-1 w-full rounded-xl border p-3" value={headline} onChange={e=>setHeadline(e.target.value)}/></label>
 <label className="text-sm font-bold">Description<textarea required maxLength={2000} rows={4} className="mt-1 w-full rounded-xl border p-3" value={description} onChange={e=>setDescription(e.target.value)}/></label>
 <label className="text-sm font-bold">Button text<input required maxLength={60} className="mt-1 w-full rounded-xl border p-3" value={buttonText} onChange={e=>setButtonText(e.target.value)}/></label>
 <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setPreview(true)} className="rounded-xl border px-4 py-2 font-bold">Preview</button><button disabled={busy} className="rounded-xl border px-4 py-2 font-bold">Save draft</button><button type="button" disabled={busy||!headline.trim()||!description.trim()||!buttonText.trim()} onClick={()=>{const form=document.querySelector<HTMLFormElement>("#sitewide-notice-editor");if(form?.reportValidity())void save({preventDefault:()=>{}} as FormEvent<HTMLFormElement>,"published")}} className="rounded-xl bg-forest px-4 py-2 font-bold text-white">Publish now</button></div>
 </form>

 {message&&<p role="status" className="mt-3 text-sm text-teal">{message}</p>}
 <h3 className="mt-7 font-bold">Previous notices</h3><div className="mt-3 space-y-3">{rows.map(n=><div key={n.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><p className="font-bold">{n.headline}</p><p className="text-xs text-night-sky/60">{n.category} · {n.status}</p></div><div className="flex gap-2">{n.status!=="published"&&<button onClick={()=>changeStatus(n.id,"published")} className="rounded-lg border px-3 py-2 text-sm">Publish</button>}{n.status==="published"&&<button onClick={()=>changeStatus(n.id,"inactive")} className="rounded-lg border px-3 py-2 text-sm">Deactivate</button>}</div></div>)}{rows.length===0&&<p className="text-sm text-night-sky/50">No notices yet.</p>}</div>
 {preview&&<NoticeDialog notice={sample} onClose={()=>setPreview(false)}/>}
 </section>;
}
