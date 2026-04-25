export default function Home() {
  return (
    <main className="min-h-screen px-6 py-20">
      <section className="mx-auto max-w-4xl">
        <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          LegacyLinks
        </p>

        <h1 className="text-5xl font-bold tracking-tight text-gray-950">
          Start building the story your family will carry forward.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
          LegacyLinks helps families preserve journal entries, memories, and
          stories in one meaningful place.
        </p>

        <div className="mt-8 flex gap-4">
          <a
            href="/signup"
            className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white"
          >
            Create an account
          </a>

          <a
            href="/login"
            className="rounded-full border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-900"
          >
            Log in
          </a>
        </div>
      </section>
    </main>
  );
}