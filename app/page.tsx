import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-20">
      <section className="mx-auto max-w-4xl">
        <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-night-sky/60">
          LegacyLinks
        </p>

        <h1 className="text-5xl font-bold tracking-tight text-night-sky">
          Start building the story your family will carry forward.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-night-sky/70">
          LegacyLinks helps families preserve journal entries, memories, and
          stories in one meaningful place.
        </p>

        <div className="mt-8 flex gap-4">
          <Link
            href="/signup"
            className="rounded-full bg-night-sky px-6 py-3 text-sm font-semibold text-white"
          >
            Create an account
          </Link>

          <Link
            href="/login"
            className="rounded-full border border-night-sky/20 px-6 py-3 text-sm font-semibold text-night-sky"
          >
            Log in
          </Link>
        </div>
      </section>
    </main>
  );
}