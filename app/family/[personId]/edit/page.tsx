import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import LogoutButton from "@/components/auth/LogoutButton";
import EditPersonForm from "@/components/family/EditPersonForm";

type EditPersonPageProps = {
  params: Promise<{
    personId: string;
  }>;
};

export default async function EditPersonPage({ params }: EditPersonPageProps) {
  const { personId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: person } = await supabase
    .from("people")
    .select(
      "id, first_name, last_name, display_name, birth_date, death_date, is_living, city, state, bio, created_by_user_id"
    )
    .eq("id", personId)
    .single();

  if (!person) {
    notFound();
  }

  if (person.created_by_user_id !== user.id) {
    redirect("/family");
  }

  const name =
    person.display_name ||
    [person.first_name, person.last_name].filter(Boolean).join(" ");

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <section className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Edit person
            </p>

            <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-950">
              Edit {name}
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-600">
              Update this person’s details. Only the original creator can edit
              this profile.
            </p>
          </div>

          <LogoutButton />
        </div>

        <div className="mt-6">
          <Link href="/family" className="text-sm font-semibold text-gray-950">
            ← Back to family
          </Link>
        </div>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <EditPersonForm person={person} />
        </section>
      </section>
    </main>
  );
}