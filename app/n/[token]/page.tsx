import Image from "next/image";
import Link from "next/link";
import {notFound} from "next/navigation";
import {createClient} from "@/utils/supabase/server";
import {withReturnPath} from "@/utils/auth/returnPath";

type PhysicalExperience={experience_id:string;experience_type:"treasure_box"|"memorial"|"token_hunt";title:string;description:string|null;status:string;visibility:string};
type PhysicalScan={event_id:string;experience_id:string;experience_type:string;title:string};
type Props={params:Promise<{token:string}>};
const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function typeLabel(type:PhysicalExperience["experience_type"]){if(type==="memorial")return "Memorial discovered";if(type==="token_hunt")return "Specialty token discovered";return "Treasure discovered"}
function heading(type:PhysicalExperience["experience_type"]){if(type==="memorial")return "You made it to this memorial.";if(type==="token_hunt")return "You found something special.";return "You found it!"}

export default async function PhysicalNfcPage({params}:Props){
 const{token}=await params;if(!UUID_PATTERN.test(token))notFound();
 const supabase=await createClient();
 const[{data:authData},{data:experience,error}]=await Promise.all([
  supabase.auth.getUser(),
  supabase.rpc("get_physical_nfc_experience",{p_public_token:token}).maybeSingle<PhysicalExperience>()
 ]);
 if(error||!experience)notFound();
 const isSignedIn=Boolean(authData.user);let scan:PhysicalScan|null=null;
 if(isSignedIn){const{data}=await supabase.rpc("record_physical_nfc_scan",{p_public_token:token}).maybeSingle<PhysicalScan>();scan=data??null}
 const returnPath=`/n/${token}`;
 return <main className="relative min-h-screen bg-sand px-6 py-24 sm:py-28">
  <Link href="/" className="absolute left-6 top-6 sm:left-10 sm:top-8" aria-label="LegacyLink home"><Image src="/images/ll-logo.svg" alt="LegacyLink" width={192} height={44} className="h-auto w-40 sm:w-48" priority/></Link>
  <section className="mx-auto w-full max-w-2xl rounded-3xl border border-night-sky/10 bg-white p-8 shadow-sm sm:p-10">
   <p className="text-sm font-semibold uppercase tracking-wide text-teal">{typeLabel(experience.experience_type)}</p>
   <h1 className="mt-3 text-4xl font-bold tracking-tight text-night-sky">{heading(experience.experience_type)}</h1>
   <div className="mt-8 rounded-2xl bg-sand p-6"><h2 className="text-2xl font-bold text-night-sky">{experience.title}</h2>{experience.description&&<p className="mt-3 whitespace-pre-line leading-7 text-night-sky/70">{experience.description}</p>}</div>
   {isSignedIn?<div className="mt-8"><div className="rounded-2xl bg-teal/10 p-4 text-sm font-semibold text-night-sky">✓ Physical NFC scan recorded{scan?".":"."}</div><p className="mt-4 text-sm leading-6 text-night-sky/60">This scan is recorded separately from simply viewing this place on Trailhead. Stronger physical-location verification and rewards can be layered onto this discovery later.</p><Link href="/trailhead" className="button-primary mt-8 inline-flex">Continue to Trailhead</Link></div>:<div className="mt-8"><p className="leading-7 text-night-sky/70">You’ve reached this LegacyLink through a physical NFC tag. Log in or create an account so this discovery can be connected to you.</p><div className="mt-6 flex flex-col gap-3 sm:flex-row"><Link href={withReturnPath("/login",returnPath)} className="button-primary inline-flex justify-center">Log in</Link><Link href={withReturnPath("/signup",returnPath)} className="inline-flex items-center justify-center rounded-xl border border-night-sky/20 px-5 py-3 font-semibold text-night-sky">Create account</Link></div></div>}
  </section>
 </main>;
}
