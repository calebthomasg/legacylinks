import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { withReturnPath } from "@/utils/auth/returnPath";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Explore Trailhead | LegacyLink",
  description:
    "Choose an adventure, follow the trail, and discover real LegacyLink Treasure Boxes.",
};

type JoinPageProps = {
  searchParams: Promise<{ campaign?: string | string[] }>;
};

const steps = [
  {
    number: "01",
    title: "Choose your adventure",
    body: "Explore Trailhead and find a Treasure Box adventure that calls to you.",
  },
  {
    number: "02",
    title: "Follow the trail",
    body: "Use the map to reach the search area. Once you arrive, the real hunt begins.",
  },
  {
    number: "03",
    title: "Discover what waits",
    body: "Find the physical Treasure Box, open it, and tap the Scan Here marker inside.",
  },
];

function getCampaign(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate) {
    return null;
  }

  const normalized = candidate.trim().toLowerCase();

  return /^[a-z0-9_-]{1,64}$/.test(normalized) ? normalized : null;
}

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const params = await searchParams;
  const campaign = getCampaign(params.campaign);
  const trailheadPath = campaign
    ? "/trailhead?campaign=" + encodeURIComponent(campaign)
    : "/trailhead";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const primaryHref = user
    ? trailheadPath
    : withReturnPath("/signup", trailheadPath);

  return (
    <main className="min-h-screen overflow-hidden bg-sand text-night-sky">
      <section className="relative isolate overflow-hidden bg-night-sky text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_34%,rgba(20,184,166,0.32),transparent_28%),radial-gradient(circle_at_12%_82%,rgba(93,180,249,0.24),transparent_30%)]"
        />
        <div
          aria-hidden="true"
          className="absolute -right-28 top-20 -z-10 h-80 w-80 rounded-full border border-white/10"
        />
        <div
          aria-hidden="true"
          className="absolute -right-8 top-40 -z-10 h-48 w-48 rounded-full border border-white/10"
        />

        <div className="mx-auto max-w-7xl px-5 pb-16 pt-6 sm:px-8 sm:pb-20 sm:pt-8 lg:px-10 lg:pb-24">
          <header className="flex items-center justify-between gap-5">
            <Link href="/" aria-label="LegacyLink home">
              <Image
                src="/images/legacy-link-logo-white.svg"
                alt="LegacyLink — For Every Trailblazer"
                width={678}
                height={168}
                className="h-auto w-44 sm:w-56"
                priority
              />
            </Link>

            {user ? (
              <Link
                href={trailheadPath}
                className="button-primary min-h-11 whitespace-nowrap px-4 text-[0.65rem] sm:px-6 sm:text-xs"
              >
                Open Trailhead
              </Link>
            ) : (
              <Link
                href={withReturnPath("/login", trailheadPath)}
                className="button-secondary min-h-11 whitespace-nowrap px-4 text-[0.65rem] sm:px-6 sm:text-xs"
              >
                Log in
              </Link>
            )}
          </header>

          <div className="mt-14 grid items-center gap-10 lg:mt-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.75fr)] lg:gap-16">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-teal sm:text-sm">
                Welcome to Trailhead
              </p>
              <h1 className="mt-4 text-[clamp(2.8rem,7vw,6.5rem)] leading-[0.9] tracking-[-0.045em] text-[#f5f2e8]">
                There&apos;s treasure out there. Really.
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-8 text-white/72 sm:text-lg">
                Pick an adventure, follow the map, and search for a real
                Treasure Box hidden somewhere out in the world. What you find
                could be a story, a token, a surprise, or the beginning of
                another trail.
              </p>

              <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <Link
                  href={primaryHref}
                  className="button-primary min-h-14 px-7 text-center text-xs sm:text-sm"
                >
                  {user ? "Explore Trailhead" : "Create an account to explore"}
                </Link>
                {!user && (
                  <p className="text-center text-sm text-white/60 sm:text-left">
                    Already a Trailblazer?{" "}
                    <Link
                      href={withReturnPath("/login", trailheadPath)}
                      className="font-bold text-white underline decoration-white/35 underline-offset-4 hover:decoration-white"
                    >
                      Log in
                    </Link>
                  </p>
                )}
              </div>
            </div>

            <div className="relative mx-auto flex w-full max-w-md items-end justify-center">
              <div
                aria-hidden="true"
                className="absolute bottom-8 h-52 w-52 rounded-full bg-teal/25 blur-3xl"
              />
              <Image
                src="/images/ranger-rowan.svg"
                alt="Ranger Rowan, your Trailhead guide"
                width={560}
                height={700}
                className="relative h-auto max-h-[520px] w-auto drop-shadow-[0_24px_32px_rgba(0,0,0,0.28)]"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal">
            How Trailhead works
          </p>
          <h2 className="mt-3 text-3xl tracking-tight sm:text-4xl">
            The map gets you close. Curiosity takes you the rest of the way.
          </h2>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <article
              key={step.number}
              className="rounded-[1.75rem] border border-night-sky/10 bg-white p-6 shadow-[0_18px_50px_rgba(15,29,58,0.06)] sm:p-7"
            >
              <p className="font-mono text-sm font-bold text-teal">
                {step.number}
              </p>
              <h3 className="mt-5 text-xl font-bold">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-night-sky/65">
                {step.body}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-14 rounded-[2rem] bg-white p-7 shadow-[0_18px_60px_rgba(15,29,58,0.07)] sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-10">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal">
              Ready, Trailblazer?
            </p>
            <h2 className="mt-3 text-3xl tracking-tight">
              Your next story may already be waiting.
            </h2>
            <p className="mt-3 leading-7 text-night-sky/65">
              Create your LegacyLink account to open Trailhead, choose an
              adventure, and keep your discoveries connected to you.
            </p>
          </div>
          <Link
            href={primaryHref}
            className="button-primary mt-7 min-h-14 shrink-0 px-7 text-center text-xs sm:mt-0 sm:text-sm"
          >
            {user ? "Open Trailhead" : "Create an account"}
          </Link>
        </div>
      </section>
    </main>
  );
}
