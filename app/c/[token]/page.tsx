import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { withReturnPath } from "@/utils/auth/returnPath";

type NfcCache = {
  cache_id: string;
  public_code: string;
  title: string;
  description: string | null;
  difficulty: number;
  terrain: number;
};

type CacheEntryPageProps = {
  params: Promise<{ token: string }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function CacheEntryPage({ params }: CacheEntryPageProps) {
  const { token } = await params;

  if (!UUID_PATTERN.test(token)) {
    notFound();
  }

  const supabase = await createClient();
  const [{ data: cache, error }, { data: authData }] = await Promise.all([
    supabase
      .rpc("resolve_cache_nfc", { p_public_token: token })
      .maybeSingle<NfcCache>(),
    supabase.auth.getUser(),
  ]);

  if (error || !cache) {
    notFound();
  }

  const returnPath = `/c/${token}`;
  const isSignedIn = Boolean(authData.user);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-sand px-6 py-12">
      <Link
        href="/"
        className="absolute left-6 top-6 sm:left-10 sm:top-8"
        aria-label="LegacyLinks home"
      >
        <Image
          src="/images/ll-logo.svg"
          alt="LegacyLinks"
          width={192}
          height={44}
          className="h-auto w-40 sm:w-48"
          priority
        />
      </Link>

      <section className="w-full max-w-xl rounded-3xl border border-night-sky/10 bg-white p-8 shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal">
          LegacyLink cache discovered
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-night-sky">
          You found it!
        </h1>

        <div className="mt-8 rounded-2xl bg-sand p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-night-sky/50">
            {cache.public_code}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-night-sky">{cache.title}</h2>
          {cache.description && (
            <p className="mt-3 leading-7 text-night-sky/70">{cache.description}</p>
          )}
          <div className="mt-5 flex gap-6 text-sm text-night-sky/70">
            <span>Difficulty {cache.difficulty}/5</span>
            <span>Terrain {cache.terrain}/5</span>
          </div>
        </div>

        {isSignedIn ? (
          <div className="mt-8">
            <p className="leading-7 text-night-sky/70">
              Your account is connected to this discovery. Find logging will be added in the next cache milestone.
            </p>
            <Link href="/dashboard" className="button-primary mt-6 inline-flex">
              Continue to LegacyLink
            </Link>
          </div>
        ) : (
          <div className="mt-8">
            <p className="leading-7 text-night-sky/70">
              Log in or create a LegacyLink account to continue from this discovery. We’ll bring you right back here afterward.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href={withReturnPath("/login", returnPath)}
                className="button-primary inline-flex justify-center"
              >
                Log in
              </Link>
              <Link
                href={withReturnPath("/signup", returnPath)}
                className="inline-flex items-center justify-center rounded-xl border border-night-sky/20 px-5 py-3 font-semibold text-night-sky"
              >
                Create account
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
