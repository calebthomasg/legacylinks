import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import LogoutButton from "@/components/auth/LogoutButton";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <section className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Dashboard
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-950">
              Welcome to LegacyLinks
            </h1>
            <p className="mt-3 text-gray-600">
              You are logged in as {user.email}
            </p>
          </div>

          <LogoutButton />
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Link
            href="/profile"
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="text-xl font-semibold text-gray-950">
              View your profile
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Start shaping the profile your memories and journal entries will connect to.
            </p>
          </Link>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-950">
              Journal entries
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Coming next: write and save your first journal entry.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}