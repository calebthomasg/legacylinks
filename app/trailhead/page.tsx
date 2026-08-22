import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
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
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal">
            Trailhead
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-night-sky sm:text-5xl">
            Find your next adventure.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-night-sky/70 sm:text-lg">
            Discover stories and adventures waiting to be found around you.
          </p>
        </header>

        <section className="mt-8 overflow-hidden rounded-[2rem] border border-night-sky/10 bg-white shadow-sm">
          <div className="relative flex min-h-[520px] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.12),_transparent_42%),linear-gradient(to_bottom,_#f5f1e6,_#ffffff)] px-6 py-12 text-center">
            <div className="max-w-lg">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal/10 text-3xl" aria-hidden="true">
                ⌖
              </div>
              <h2 className="mt-5 text-2xl font-bold text-night-sky">
                Your map starts here.
              </h2>
              <p className="mt-3 leading-7 text-night-sky/65">
                The Trailhead map is the next piece of the adventure. Your cache data is connected and ready for Mapbox.
              </p>

              <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-night-sky/10 bg-white px-4 py-2 text-sm font-semibold text-night-sky shadow-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-leaf" aria-hidden="true" />
                {error
                  ? "Trailhead data unavailable"
                  : `${trailheadCaches.length} ${trailheadCaches.length === 1 ? "cache" : "caches"} ready to explore`}
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
