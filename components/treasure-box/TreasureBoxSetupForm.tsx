"use client";

import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {createClient} from "@/utils/supabase/client";
import TreasureBoxStoryBuilder from "@/components/treasure-box/TreasureBoxStoryBuilder";
import {TREASURE_BOX_ADVANCED_EXPERIENCES_ENABLED} from "@/utils/featureFlags";

type ContentOption="digital_story"|"traveling_token"|"specialty_token"|"quest";
type Step="details"|"placement"|"contents"|"story"|"traveling_token"|"specialty_token"|"quest"|"review"|"published";

type Props={
  token:string;
  boxId:string;
  initial:{
    title:string;
    description:string|null;
    difficulty:number;
    terrain:number;
    latitude:number|null;
    longitude:number|null;
    search_radius_meters:number|null;
    setup_status?:string;
  };
};

type ReviewState={
  box_id:string;
  cache_id:string;
  title:string;
  description:string|null;
  difficulty:number;
  terrain:number;
  latitude:number;
  longitude:number;
  search_radius_meters:number;
  setup_status:string;
  content_options:ContentOption[];
  publishable:boolean;
  nfc_verified_at:string|null;
};

const OPTIONS:{id:ContentOption;title:string;description:string}[]=[
  {id:"digital_story",title:"Digital Story",description:"Create a story Trailblazers unlock when they physically discover this box."},
  {id:"traveling_token",title:"Traveling Token",description:"Send a trackable token on a journey from Treasure Box to Treasure Box."},
  {id:"specialty_token",title:"Specialty Token",description:"Place collectible or special-edition LegacyLink tokens inside this box."},
  {id:"quest",title:"Quest",description:"Make this box part of an ordered adventure where each discovery unlocks the next stop."},
];

function contentOptionToStep(option:ContentOption):Step{
  switch(option){
    case "digital_story":return "story";
    case "traveling_token":return "traveling_token";
    case "specialty_token":return "specialty_token";
    case "quest":return "quest";
  }
}

export default function TreasureBoxSetupForm({token,boxId,initial}:Props){
  const supabase=useMemo(()=>createClient(),[]);
  const[title,setTitle]=useState(initial.title==="Untitled Treasure Box"?"":initial.title);
  const[description,setDescription]=useState(initial.description??"");
  const[difficulty,setDifficulty]=useState(initial.difficulty||1);
  const[terrain,setTerrain]=useState(initial.terrain||1);
  const[latitude,setLatitude]=useState(initial.latitude?.toString()??"");
  const[longitude,setLongitude]=useState(initial.longitude?.toString()??"");
  const[radius,setRadius]=useState(initial.search_radius_meters??75);
  const[selected,setSelected]=useState<ContentOption[]>([]);
  const[step,setStep]=useState<Step>(initial.setup_status==="ready_to_publish"?"review":"details");
  const[busy,setBusy]=useState(false);
  const[locating,setLocating]=useState(false);
  const[error,setError]=useState<string|null>(null);
  const[message,setMessage]=useState<string|null>(null);
  const[optionsLoaded,setOptionsLoaded]=useState(!TREASURE_BOX_ADVANCED_EXPERIENCES_ENABLED);
  const[review,setReview]=useState<ReviewState|null>(null);

  useEffect(()=>{
    if(!TREASURE_BOX_ADVANCED_EXPERIENCES_ENABLED)return;
    let active=true;
    (async()=>{
      const{data}=await supabase.rpc("get_claimed_treasure_box_content_options",{p_nfc_public_token:token});
      if(!active)return;
      setSelected((Array.isArray(data)?data:[]) as ContentOption[]);
      setOptionsLoaded(true);
    })();
    return()=>{active=false};
  },[supabase,token]);

  const steps=useMemo<Step[]>(()=>{
    if(!TREASURE_BOX_ADVANCED_EXPERIENCES_ENABLED)return ["details","placement","review"];
    return ["details","placement","contents",...selected.map(contentOptionToStep),"review"];
  },[selected]);

  const index=Math.max(0,steps.indexOf(step));
  const labels:Record<Step,string>={
    details:"Details",
    placement:"Placement",
    contents:"What's Inside",
    story:"Story",
    traveling_token:"Traveling Token",
    specialty_token:"Specialty Token",
    quest:"Quest",
    review:"Review",
    published:"Published",
  };

  function go(next:Step){
    setError(null);
    setMessage(null);
    setStep(next);
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function previous(){
    const i=steps.indexOf(step);
    if(i>0)go(steps[i-1]);
  }

  function nextStep(){
    const i=steps.indexOf(step);
    if(i>=0&&i<steps.length-1)go(steps[i+1]);
  }

  function useLocation(){
    setError(null);
    if(!navigator.geolocation){
      setError("Location is not available on this device. You can enter coordinates manually.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos=>{
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setLocating(false);
        setMessage(`Location added${Number.isFinite(pos.coords.accuracy)?` (about ${Math.round(pos.coords.accuracy)} m accuracy)`:""}.`);
      },
      ()=>{
        setLocating(false);
        setError("We couldn't get your location. Try again or enter coordinates manually.");
      },
      {enableHighAccuracy:true,timeout:12000,maximumAge:0}
    );
  }

  function saveBasics(){
    setError(null);
    if(!title.trim()){
      setError("Give your Treasure Box a name.");
      return;
    }
    go("placement");
  }

  async function savePlacement(){
    setError(null);
    const lat=Number(latitude),lng=Number(longitude);
    if(!title.trim()){
      setError("Give your Treasure Box a name.");
      return;
    }
    if(!Number.isFinite(lat)||!Number.isFinite(lng)){
      setError("Add the Treasure Box location before continuing.");
      return;
    }
    setBusy(true);
    const{error:e}=await supabase.rpc("save_claimed_treasure_box_setup",{
      p_nfc_public_token:token,
      p_title:title.trim(),
      p_description:description.trim()||null,
      p_difficulty:difficulty,
      p_terrain:terrain,
      p_latitude:lat,
      p_longitude:lng,
      p_search_radius_meters:radius,
    });
    setBusy(false);
    if(e){
      setError(e.message);
      return;
    }
    go(TREASURE_BOX_ADVANCED_EXPERIENCES_ENABLED?"contents":"review");
  }

  function toggle(id:ContentOption){
    setSelected(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
  }

  async function saveContents(){
    setError(null);
    setBusy(true);
    const{error:e}=await supabase.rpc("save_claimed_treasure_box_content_options",{
      p_nfc_public_token:token,
      p_content_options:selected,
    });
    setBusy(false);
    if(e){
      setError(e.message);
      return;
    }
    const dynamic=selected.map(contentOptionToStep);
    go(dynamic[0]??"review");
  }

  async function loadReview(){
    setError(null);
    const{data,error:e}=await supabase.rpc("get_owned_treasure_box_review",{p_nfc_public_token:token});
    if(e){
      setError(e.message);
      return;
    }
    const row=(Array.isArray(data)?data[0]:data) as ReviewState|null;
    setReview(row);
  }

  useEffect(()=>{
    if(step==="review")void loadReview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[step]);

  async function publish(){
    setError(null);
    if(!review?.publishable){
      setError("This Treasure Box still needs its required details and placement before it can go live.");
      return;
    }
    setBusy(true);
    const{error:e}=await supabase.rpc("publish_claimed_treasure_box",{p_nfc_public_token:token});
    setBusy(false);
    if(e){
      setError(e.message);
      return;
    }
    setStep("published");
  }

  const score=(label:string,value:number,setter:(v:number)=>void)=><label className="block">
    <span className="text-xs font-bold uppercase tracking-[.12em] text-night-sky/55">{label}</span>
    <select value={value} onChange={e=>setter(Number(e.target.value))} className="mt-2 w-full rounded-2xl border border-night-sky/15 bg-white px-4 py-3 text-sm">
      {[1,2,3,4,5].map(n=><option key={n} value={n}>{n} / 5</option>)}
    </select>
  </label>;

  if(!optionsLoaded)return <div className="mt-8 rounded-2xl bg-sand p-5 text-sm font-semibold text-night-sky/60">Opening setup…</div>;

  if(step==="published")return <div className="mt-8">
    <div className="rounded-3xl border-2 border-teal/30 bg-teal/10 p-6">
      <p className="text-xs font-bold uppercase tracking-[.14em] text-teal">Treasure Box published</p>
      <h2 className="mt-2 text-3xl font-bold text-night-sky">Your Treasure Box is live.</h2>
      <p className="mt-3 leading-7 text-night-sky/65">It can now appear on Trailhead. Your exact hiding coordinates remain private; Trailhead uses the public search area instead.</p>
    </div>
    <div className="mt-5 rounded-2xl bg-sand p-5">
      <p className="font-bold text-night-sky">One final physical check</p>
      <p className="mt-2 text-sm leading-6 text-night-sky/60">Tap the NFC tag on the physical box again. When the published NFC experience opens for you, LegacyLink will record the tag as verified.</p>
    </div>
    <Link href="/trailhead" className="button-primary mt-5 inline-flex w-full justify-center">Open Trailhead</Link>
  </div>;

  return <div className="mt-8">
    <div className="mb-7">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-teal">Step {index+1} of {steps.length}</p>
        <p className="text-xs font-semibold text-night-sky/45">{labels[step]}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-night-sky/10">
        <div className="h-full rounded-full bg-teal transition-all" style={{width:`${((index+1)/steps.length)*100}%`}}/>
      </div>
      <div className="mt-3 hidden gap-2 sm:flex">
        {steps.map((s,i)=><button key={s} type="button" onClick={()=>go(s)} className={`text-xs font-semibold ${i===index?"text-teal":"text-night-sky/40"}`}>
          {labels[s]}{i<steps.length-1&&<span className="ml-2 text-night-sky/20">→</span>}
        </button>)}
      </div>
    </div>

    {step==="details"&&<section>
      <div className="rounded-2xl bg-sand p-4">
        <p className="text-xs font-bold uppercase tracking-[.12em] text-night-sky/45">Physical Treasure Box</p>
        <p className="mt-1 font-mono text-lg font-bold text-night-sky">{boxId}</p>
      </div>
      <h2 className="mt-6 text-2xl font-bold text-night-sky">Tell us about your Treasure Box.</h2>
      <p className="mt-2 text-sm leading-6 text-night-sky/60">These are the basic details Trailblazers will see before they head out.</p>
      <div className="mt-6 space-y-5">
        <label className="block text-xs font-bold uppercase tracking-[.12em] text-night-sky/55">Treasure Box name
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Give this adventure a name" className="mt-2 w-full rounded-2xl border border-night-sky/15 px-4 py-3 text-base"/>
        </label>
        <label className="block text-xs font-bold uppercase tracking-[.12em] text-night-sky/55">Short description
          <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={4} placeholder="What should Trailblazers know before they start looking?" className="mt-2 w-full resize-none rounded-2xl border border-night-sky/15 px-4 py-3 text-sm leading-6"/>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">{score("Difficulty",difficulty,setDifficulty)}{score("Terrain",terrain,setTerrain)}</div>
      </div>
      <WizardError error={error}/>
      <button type="button" onClick={saveBasics} className="button-primary mt-6 inline-flex w-full justify-center">Continue to Placement</button>
    </section>}

    {step==="placement"&&<section>
      <p className="text-xs font-bold uppercase tracking-[.14em] text-teal">Placement</p>
      <h2 className="mt-2 text-2xl font-bold text-night-sky">Place the physical box before you publish it.</h2>
      <p className="mt-3 text-sm leading-6 text-night-sky/60">Use your device while standing at the hiding location. LegacyLink stores the exact placement privately and gives Trailhead an approximate search area.</p>
      <div className="mt-6 rounded-2xl border border-night-sky/10 p-4">
        <button type="button" onClick={useLocation} disabled={locating} className="w-full rounded-xl bg-teal px-4 py-3 text-sm font-bold text-white">{locating?"Finding location…":"Use my current location"}</button>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input value={latitude} onChange={e=>setLatitude(e.target.value)} placeholder="Latitude" className="rounded-xl border border-night-sky/15 px-3 py-3 font-mono text-sm"/>
          <input value={longitude} onChange={e=>setLongitude(e.target.value)} placeholder="Longitude" className="rounded-xl border border-night-sky/15 px-3 py-3 font-mono text-sm"/>
        </div>
        <label className="mt-4 block text-xs font-bold uppercase tracking-[.12em] text-night-sky/55">Search area
          <select value={radius} onChange={e=>setRadius(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-night-sky/15 bg-white px-3 py-3 text-sm">
            <option value={25}>25 meters — tight</option><option value={50}>50 meters</option><option value={75}>75 meters — standard</option><option value={100}>100 meters</option><option value={150}>150 meters — broad</option>
          </select>
        </label>
      </div>
      {message&&<p className="mt-4 rounded-2xl bg-teal/10 p-4 text-sm font-semibold text-night-sky">{message}</p>}
      <WizardError error={error}/>
      <div className="mt-6 flex gap-3"><Back onClick={previous}/><button type="button" onClick={savePlacement} disabled={busy} className="button-primary flex-1">{busy?"Saving placement…":"Confirm Placement"}</button></div>
    </section>}

    {step==="contents"&&TREASURE_BOX_ADVANCED_EXPERIENCES_ENABLED&&<section>
      <h2 className="text-2xl font-bold text-night-sky">What will Trailblazers discover here?</h2>
      <p className="mt-2 text-sm leading-6 text-night-sky/60">Optional experiences are not required for the Treasure Box itself to go live.</p>
      <div className="mt-6 grid gap-3">{OPTIONS.map(o=>{const active=selected.includes(o.id);return <button key={o.id} type="button" onClick={()=>toggle(o.id)} className={`rounded-2xl border p-4 text-left ${active?"border-teal bg-teal/10":"border-night-sky/10"}`}><span className="font-bold text-night-sky">{active?"✓ ":""}{o.title}</span><span className="mt-1 block text-sm leading-6 text-night-sky/60">{o.description}</span></button>})}</div>
      <WizardError error={error}/>
      <div className="mt-6 flex gap-3"><Back onClick={previous}/><button type="button" onClick={saveContents} disabled={busy} className="button-primary flex-1">{busy?"Saving…":"Save & Continue"}</button></div>
    </section>}

    {step==="story"&&TREASURE_BOX_ADVANCED_EXPERIENCES_ENABLED&&<section>
      <TreasureBoxStoryBuilder token={token}/>
      <div className="mt-5 flex gap-3"><Back onClick={previous}/><button type="button" onClick={nextStep} className="button-primary flex-1">Continue</button></div>
    </section>}

    {(step==="traveling_token"||step==="specialty_token"||step==="quest")&&TREASURE_BOX_ADVANCED_EXPERIENCES_ENABLED&&<section>
      <p className="text-xs font-bold uppercase tracking-[.14em] text-teal">{labels[step]}</p>
      <h2 className="mt-2 text-2xl font-bold text-night-sky">{labels[step]} setup is still in development.</h2>
      <p className="mt-3 leading-7 text-night-sky/60">This optional module does not prevent the Treasure Box itself from being published.</p>
      <div className="mt-6 flex gap-3"><Back onClick={previous}/><button type="button" onClick={nextStep} className="button-primary flex-1">Continue</button></div>
    </section>}

    {step==="review"&&<section>
      <p className="text-xs font-bold uppercase tracking-[.14em] text-teal">Final Review</p>
      <h2 className="mt-2 text-2xl font-bold text-night-sky">Ready to put this box on the trail?</h2>
      <p className="mt-3 leading-7 text-night-sky/60">Publishing makes the Treasure Box discoverable. Optional stories, tokens, and quests are not required.</p>
      {!review?<div className="mt-6 rounded-2xl bg-sand p-5 text-sm font-semibold text-night-sky/55">Checking your setup…</div>:<div className="mt-6 space-y-3">
        <ReviewRow label="Treasure Box" value={review.box_id}/>
        <ReviewRow label="Name" value={review.title}/>
        <ReviewRow label="Description" value={review.description||"No description"}/>
        <ReviewRow label="Difficulty / Terrain" value={`${review.difficulty}/5 · ${review.terrain}/5`}/>
        <ReviewRow label="Exact placement" value={`${review.latitude.toFixed(5)}, ${review.longitude.toFixed(5)} (private)`}/>
        <ReviewRow label="Public search area" value={`${review.search_radius_meters} meter radius around an approximate map point`}/>
        {TREASURE_BOX_ADVANCED_EXPERIENCES_ENABLED&&<ReviewRow label="Optional experiences" value={review.content_options.length?review.content_options.map(x=>x.replaceAll("_"," ")).join(", "):"None"}/>}
      </div>}
      <WizardError error={error}/>
      <div className="mt-6 flex gap-3"><Back onClick={previous}/><button type="button" disabled={busy||!review?.publishable} onClick={publish} className="button-primary flex-1 disabled:opacity-40">{busy?"Publishing…":"Publish Treasure Box"}</button></div>
    </section>}
  </div>;
}

function Back({onClick}:{onClick:()=>void}){return <button type="button" onClick={onClick} className="rounded-xl border border-night-sky/15 px-5 py-3 text-sm font-bold text-night-sky">Back</button>}
function WizardError({error}:{error:string|null}){return error?<p className="mt-4 rounded-2xl bg-coral/10 p-4 text-sm font-semibold text-night-sky">{error}</p>:null}
function ReviewRow({label,value}:{label:string;value:string}){return <div className="rounded-2xl bg-sand p-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-night-sky/40">{label}</p><p className="mt-1 text-sm font-semibold leading-6 text-night-sky">{value}</p></div>}
