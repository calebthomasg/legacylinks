import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import LogoutButton from "@/components/auth/LogoutButton";
import JournalEntryForm from "@/components/journal/JournalEntryForm";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();

  const fullName = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ");

  const { data: journalEntries } = await supabase
    .from("journal_entries")
    .select("id, title, body, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <section className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Dashboard
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-950">
              Welcome to LegacyLinks
            </h1>
            <p className="mt-3 text-gray-600">
              You are logged in as {fullName || user.email}
            </p>
          </div>

          <LogoutButton />
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-[1fr_2fr]">
          <aside className="space-y-6">
            <Link
              href="/profile"
              className="block rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h2 className="text-xl font-semibold text-gray-950">
                View your profile
              </h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                Edit your account details and begin shaping your LegacyLinks profile.
              </p>
            </Link>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-950">
                Journal count
              </h2>
              <p className="mt-3 text-3xl font-bold text-gray-950">
                {journalEntries?.length ?? 0}
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Entries saved so far.
              </p>
            </div>
          </aside>

          <div className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold text-gray-950">
                Write a journal entry
              </h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                Capture a memory, lesson, experience, or moment from your life.
                This entry will be saved to your LegacyLinks profile.
              </p>

              <div className="mt-6">
                <JournalEntryForm userId={user.id} />
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold text-gray-950">
                Your journal entries
              </h2>

              {!journalEntries || journalEntries.length === 0 ? (
                <p className="mt-4 text-sm leading-6 text-gray-600">
                  You have not written any journal entries yet. Start with a
                  simple memory, a lesson you learned, or something you want
                  your family to remember.
                </p>
              ) : (
                <div className="mt-6 space-y-4">
                  {journalEntries.map((entry) => (
                    <article
                      key={entry.id}
                      className="rounded-xl border border-gray-200 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-950">
                            {entry.title}
                          </h3>
                          <p className="mt-1 text-xs text-gray-500">
                            {new Date(entry.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <p className="mt-4 whitespace-pre-line text-sm leading-6 text-gray-700">
                        {entry.body}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}