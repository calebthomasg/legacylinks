import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import LogoutButton from "@/components/auth/LogoutButton";
import EditJournalEntryForm from "@/components/journal/EditJournalEntryForm";
import DeleteJournalEntryButton from "@/components/journal/DeleteJournalEntryButton";

type EditJournalEntryPageProps = {
  params: Promise<{
    entryId: string;
  }>;
};

export default async function EditJournalEntryPage({
  params,
}: EditJournalEntryPageProps) {
  const { entryId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: entry } = await supabase
    .from("journal_entries")
    .select(`
      id,
      title,
      body,
      user_id,
      created_at,
      journal_entry_people (
        person_id
      )
    `)
    .eq("id", entryId)
    .single();

  if (!entry) {
    notFound();
  }

  if (entry.user_id !== user.id) {
    redirect("/dashboard");
  }

  const { data: people } = await supabase
    .from("people")
    .select("id, first_name, last_name, display_name")
    .eq("created_by_user_id", user.id)
    .order("created_at", { ascending: false });

  const initialTaggedPersonIds =
    entry.journal_entry_people?.map((tag) => tag.person_id) ?? [];

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <section className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Edit journal entry
            </p>

            <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-950">
              Edit memory
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-600">
              Update the title, story, or people tagged in this memory.
            </p>
          </div>

          <LogoutButton />
        </div>

        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            href="/dashboard"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            Back to dashboard
          </Link>
        </div>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <EditJournalEntryForm
            entryId={entry.id}
            initialTitle={entry.title}
            initialBody={entry.body}
            people={people ?? []}
            initialTaggedPersonIds={initialTaggedPersonIds}
          />
        </section>

        <section className="mt-6 rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-red-700">
            Delete this journal entry
          </h2>

          <p className="mt-3 text-sm leading-6 text-gray-600">
            This will permanently delete this journal entry and its attached
            image files.
          </p>

          <div className="mt-5">
            <DeleteJournalEntryButton entryId={entry.id} />
          </div>
        </section>
      </section>
    </main>
  );
}