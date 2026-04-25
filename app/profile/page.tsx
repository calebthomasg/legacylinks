import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import LogoutButton from "@/components/auth/LogoutButton";
import ProfileForm from "@/components/profile/ProfileForm";

export default async function ProfilePage() {
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

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <section className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Profile
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-950">
              Your LegacyLinks profile
            </h1>
          </div>

          <LogoutButton />
        </div>

        <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-950">
            Account details
          </h2>

          <dl className="mt-6 space-y-4 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-gray-950">{user.email}</dd>
            </div>

            <div>
              <dt className="font-medium text-gray-500">User ID</dt>
              <dd className="mt-1 break-all text-gray-950">{user.id}</dd>
            </div>
          </dl>

          <div className="mt-8 border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-950">
              Edit your name
            </h3>

            <ProfileForm
              userId={user.id}
              initialFirstName={profile?.first_name ?? ""}
              initialLastName={profile?.last_name ?? ""}
            />
          </div>
        </div>

        <div className="mt-6">
          <Link href="/dashboard" className="text-sm font-semibold text-gray-950">
            ← Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}