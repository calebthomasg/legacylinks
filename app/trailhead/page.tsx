import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import TrailheadMap from "@/components/trailhead/TrailheadMap";
import { createClient } from "@/utils/supabase/server";
import { getProfileNavHref } from "@/utils/people/getProfileNavHref";

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
};

const DEFAULT_TRAILHEAD_CENTER: [number, number] = [-97.3759, 33.0455];

export default async function TrailheadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/trailhead");
  }

  const profileHref = await getProfileNavHref(user.id);
  const [{ data: profile }, { data: caches, error }] = await Promise.all([
    supabase.from("profiles").select("first_name").eq("id", user.id).single(),
    supabase.rpc("get_trailhead_caches"),
  ]);

  const trailheadCaches = (caches ?? []) as TrailheadCache[];
  const firstCache = trailheadCaches[0];
  const mapCenter: [number, number] = firstCache
    ? [firstCache.search_longitude, firstCache.search_latitude]
    : DEFAULT_TRAILHEAD_CENTER;

  return (
    <AppShell
      active="trailhead"
      userName={profile?.first_name || "Trailblazer"}
      userEmail={user.email}
      profileHref={profileHref}
      contentClassName="relative isolate overflow-hidden bg-sand"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[url('/images/sky-fade.png')] bg-cover bg-top bg-no-repeat"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        <header className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal">Trailhead</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-night-sky sm:text-5xl">
            Find your next adventure.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-night-sky/70 sm:text-lg">
            Discover stories and adventures waiting to be found around you.
          </p>
        </header>

        <section className="mt-8 overflow-hidden rounded-[2rem] border border-night-sky/10 bg-white shadow-sm">
          {error ? (
            <div className="flex min-h-[520px] items-center justify-center bg-sand px-6 text-center">
              <div className="max-w-md">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Trailhead unavailable</p>
                <h2 className="mt-3 text-2xl font-bold text-night-sky">We couldn’t load nearby adventures.</h2>
                <p className="mt-3 leading-7 text-night-sky/65">Try refreshing Trailhead in a moment.</p>
              </div>
            </div>
          ) : (
            <TrailheadMap center={mapCenter} caches={trailheadCaches} />
          )}
        </section>

        <div className="mt-4 flex items-center justify-between gap-4 text-sm text-night-sky/60">
          <p>The map gets you close. The adventure gets you there.</p>
          <p className="shrink-0 font-semibold text-night-sky/70">
            {trailheadCaches.length} {trailheadCaches.length === 1 ? "cache" : "caches"} nearby
          </p>
        </div>
      </div>
    </AppShell>
  );
}
