import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import TrailheadMap from "@/components/trailhead/TrailheadMap";
import TrailheadWelcome from "@/components/trailhead/TrailheadWelcome";
import { createClient } from "@/utils/supabase/server";
import { getProfileNavHref } from "@/utils/people/getProfileNavHref";

type TrailheadComment={first_name:string;comment:string|null;rating:number|null;found_at:string;photo_paths:string[]};
type TrailheadCache={cache_id:string;public_code:string;title:string;description:string|null;difficulty:number;terrain:number;chapter_number:number|null;adventure_id:string;adventure_title:string;adventure_slug:string;search_latitude:number;search_longitude:number;search_radius_meters:number;arrival_latitude:number|null;arrival_longitude:number|null;created_at:string;unique_find_count:number;average_rating:number|null;recent_comments:TrailheadComment[]};
type MyTreasureBox={cache_id:string;public_code:string;title:string;description:string|null;difficulty:number;terrain:number|null;chapter_number:number|null;adventure_id:string;adventure_title:string;lifecycle_status:string;created_at:string;search_latitude:number|null;search_longitude:number|null;search_radius_meters:number|null;unique_find_count:number;average_rating:number|null};
type DiscoveryItem={experience_id:string;experience_type:"treasure_box"|"memorial"|"token_hunt";cache_id:string|null;title:string;description:string|null;latitude:number;longitude:number;search_radius_meters:number|null;marker_variant:"treasure_box"|"memorial"|"token";teaser_text:string|null};
type MyTreasureItem={experience_id:string;experience_type:"treasure_box"|"memorial"|"token_hunt"|"traveling_token";cache_id:string|null;title:string;description:string|null;status:string;visibility:string;latitude:number|null;longitude:number|null;created_at:string;nfc_public_token?:string|null;token_code?:string|null;mission?:string|null;from_box_code?:string|null;current_box_code?:string|null;total_miles?:number|null;stop_count?:number|null};
type CarriedToken={token_id:string;nfc_public_token:string;token_code:string;name:string|null;mission:string|null;status:string;picked_up_at:string|null;from_box_code:string|null;total_miles:number;stop_count:number};
type OwnedToken={token_id:string;token_code:string;nfc_public_token:string;name:string|null;mission:string|null;status:string;current_box_code:string|null;circulation_started_at:string|null;stop_count:number;total_miles:number};

const CENTER:[number,number]=[-98.5795,39.8283];

export default async function TrailheadPage(){
 const supabase=await createClient();
 const{data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login?next=/trailhead");
 const profileHref=await getProfileNavHref(user.id);
 const[{data:profile},{data:caches,error},{data:myBoxes},{data:discoveryItems},{data:myItems},{data:carriedTokens},{data:ownedTokens},{data:isAdmin}]=await Promise.all([
  supabase.from("profiles").select("first_name").eq("id",user.id).single(),
  supabase.rpc("get_trailhead_caches"),
  supabase.rpc("get_my_treasure_boxes"),
  supabase.rpc("get_trailhead_discovery_items"),
  supabase.rpc("get_my_trailhead_items"),
  supabase.rpc("get_carried_traveling_tokens"),
  supabase.rpc("get_owned_traveling_tokens"),
  supabase.rpc("is_legacy_link_admin")
 ]);
 const base=(myItems??[]) as MyTreasureItem[];
 const carried=(carriedTokens??[]) as CarriedToken[];
 const owned=(ownedTokens??[]) as OwnedToken[];
 const tokens=new Map<string,MyTreasureItem>();
 for(const t of owned)tokens.set(t.token_id,{
  experience_id:t.token_id,
  experience_type:"traveling_token",
  cache_id:null,
  title:t.name||t.token_code,
  description:t.mission,
  status:t.status,
  visibility:t.status==="in_circulation"?"public":"private",
  latitude:null,
  longitude:null,
  created_at:t.circulation_started_at||new Date().toISOString(),
  nfc_public_token:t.nfc_public_token,
  token_code:t.token_code,
  mission:t.mission,
  current_box_code:t.current_box_code,
  total_miles:t.total_miles,
  stop_count:t.stop_count
 });
 for(const t of carried)tokens.set(t.token_id,{
  experience_id:t.token_id,
  experience_type:"traveling_token",
  cache_id:null,
  title:t.name||t.token_code,
  description:t.mission,
  status:"in_transit",
  visibility:"private",
  latitude:null,
  longitude:null,
  created_at:t.picked_up_at||new Date().toISOString(),
  nfc_public_token:t.nfc_public_token,
  token_code:t.token_code,
  mission:t.mission,
  from_box_code:t.from_box_code,
  total_miles:t.total_miles,
  stop_count:t.stop_count
 });
 const ownedItems=[...tokens.values(),...base];
 return <AppShell active="trailhead" userName={profile?.first_name||"Trailblazer"} userEmail={user.email} profileHref={profileHref} isAdmin={Boolean(isAdmin)} contentClassName="relative overflow-hidden bg-sand"><div className="relative h-[calc(100dvh-77px)] min-h-[560px] lg:h-screen lg:min-h-[640px]">{error?<div className="flex h-full items-center justify-center bg-sand px-6 text-center"><div className="max-w-md"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Trailhead unavailable</p><h1 className="mt-3 text-2xl font-bold text-night-sky">We couldn’t load nearby adventures.</h1></div></div>:<TrailheadMap center={CENTER} caches={(caches??[]) as TrailheadCache[]} myBoxes={(myBoxes??[]) as MyTreasureBox[] as any} discoveryItems={(discoveryItems??[]) as DiscoveryItem[]} myItems={ownedItems}/>}</div><TrailheadWelcome/></AppShell>;
}
