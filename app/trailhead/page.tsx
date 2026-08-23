import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import TrailheadMap from "@/components/trailhead/TrailheadMap";
import TrailheadWelcome from "@/components/trailhead/TrailheadWelcome";
import { createClient } from "@/utils/supabase/server";
import { getProfileNavHref } from "@/utils/people/getProfileNavHref";

type TrailheadComment = {
  first_name: string;
  comment: string | null;
  rating: number | null;
  found_at: string;
  photo_paths: string[];
};

type TrailheadCache = {
  cache_id: string;
  public_code: string;
  title: string;
  description: string | null;
  difficulty: number;
  terrain: number;
  chapter_number: number | null;
  adventure_id: string;
  adventure_title: string;
  adventure_slug: string;
  search_latitude: number;
  search_longitude: number;
  search_radius_meters: number;
  arrival_latitude: number | null;
  arrival_longitude: number | null;
  created_at: string;
  unique_find_count: number;
  average_rating: number | null;
  recent_comments: TrailheadComment[];
};

const DEFAULT_TRAILHEAD_CENTER: [number, number] = [-97.3759, 33.0455];

export default async function TrailheadPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/trailhead");

  const profileHref = await getProfileNavHref(user.id);
  const [{ data: profile }, { data: caches, error }] = await Promise.all([
    supabase.from("profiles").select("first_name").eq("id", user.id).single(),
    supabase.rpc("get_trailhead_caches"),
  ]);

  const trailheadCaches = (caches ?? []) as TrailheadCache[];
  const firstCache = trailheadCaches[0];
  const mapCenter: [number, number] = firstCache ? [firstCache.search_longitude, firstCache.search_latitude] : DEFAULT_TRAILHEAD_CENTER;

  return <AppShell active="trailhead" userName={profile?.first_name || "Trailblazer"} userEmail={user.email} profileHref={profileHref} contentClassName="relative overflow-hidden bg-sand">
    <div className="relative h-[calc(100dvh-77px)] min-h-[560px] lg:h-screen lg:min-h-[640px]">
      {error ? <div className="flex h-full items-center justify-center bg-sand px-6 text-center"><div className="max-w-md"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Trailhead unavailable</p><h1 className="mt-3 text-2xl font-bold text-night-sky">We couldn’t load nearby adventures.</h1><p className="mt-3 leading-7 text-night-sky/65">Try refreshing Trailhead in a moment.</p></div></div> : <TrailheadMap center={mapCenter} caches={trailheadCaches} />}
      <div className="pointer-events-none absolute left-4 top-4 z-20 lg:left-6 lg:top-6"><div className="pointer-events-auto rounded-2xl border border-night-sky/10 bg-white/95 px-4 py-3 shadow-lg backdrop-blur sm:px-5"><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal">Trailhead</p><p className="mt-1 text-sm font-semibold text-night-sky">{trailheadCaches.length} {trailheadCaches.length === 1 ? "adventure nearby" : "adventures nearby"}</p></div></div>
      <div className="pointer-events-none absolute bottom-4 left-4 z-20 hidden lg:block"><div className="rounded-full bg-night-sky/85 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur">The map gets you close. The adventure gets you there.</div></div>
    </div>
    <TrailheadWelcome />
  </AppShell>;
}
