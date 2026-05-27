import { redirect, notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AppShell from "@/components/layout/AppShell";
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
    <AppShell active="journal" userEmail={user.email}>
      <section className="mx-auto max-w-3xl px-6 py-10">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-night-sky/60">
            Edit journal entry
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight text-night-sky">
            Edit memory
          </h1>

          <p className="mt-3 text-sm leading-6 text-night-sky/70">
            Update the title, story, or people tagged in this memory.
          </p>
        </div>

        <section className="mt-8 rounded-2xl border border-night-sky/10 bg-white p-6 shadow-sm">
          <EditJournalEntryForm
            entryId={entry.id}
            initialTitle={entry.title}
            initialBody={entry.body}
            people={people ?? []}
            initialTaggedPersonIds={initialTaggedPersonIds}
          />
        </section>

        <section className="mt-6 rounded-2xl border border-coral/30 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-coral">
            Delete this journal entry
          </h2>

          <p className="mt-3 text-sm leading-6 text-night-sky/70">
            This will permanently delete this journal entry and its attached
            image files.
          </p>

          <div className="mt-5">
            <DeleteJournalEntryButton entryId={entry.id} />
          </div>
        </section>
      </section>
    </AppShell>
  );
}
