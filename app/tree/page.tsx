import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import LogoutButton from "@/components/auth/LogoutButton";
import FamilyTreeClient from "@/components/family/FamilyTreeClient";

type JournalEntryImage = {
  id: string;
  storage_path: string;
  file_name: string | null;
};

type JournalEntry = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  journal_entry_images: JournalEntryImage[] | null;
};

type TaggedMemoryRow = {
  id: string;
  person_id: string;
  journal_entries: JournalEntry | JournalEntry[] | null;
};

export default async function TreePage() {
  const supabase = await createClient();

  // 1. Check whether the user is logged in.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. If no user is logged in, send them to login.
  if (!user) {
    redirect("/login");
  }

  // 3. Get all people created by this user.
  const { data: people } = await supabase
    .from("people")
    .select(
      "id, linked_user_id, created_by_user_id, first_name, last_name, display_name, birth_date, death_date, is_living, city, state, bio"
    )
    .eq("created_by_user_id", user.id)
    .order("created_at", { ascending: false });

  // 4. Find the person profile connected to the logged-in user.
  const rootPerson = people?.find((person) => person.linked_user_id === user.id);

  // 5. If the user does not have a person profile yet, send them to family page.
  if (!people || !rootPerson) {
    redirect("/family");
  }

  // 6. Get all relationships created by this user.
  const { data: relationships } = await supabase
    .from("family_relationships")
    .select("id, person_id, related_person_id, relationship_type, nickname")
    .eq("created_by_user_id", user.id);

  // 7. Get journal entries tagged to people.
  const { data: taggedMemoryRows } = await supabase
    .from("journal_entry_people")
    .select(`
      id,
      person_id,
      journal_entries (
        id,
        title,
        body,
        created_at,
        journal_entry_images (
          id,
          storage_path,
          file_name
        )
      )
    `)
    .eq("tagged_by_user_id", user.id);

  // 8. Create signed image URLs for tagged memory thumbnails.
  const taggedMemories = await Promise.all(
    ((taggedMemoryRows ?? []) as TaggedMemoryRow[]).map(async (tag) => {
      const entry = Array.isArray(tag.journal_entries)
        ? tag.journal_entries[0]
        : tag.journal_entries;

      if (!entry) {
        return null;
      }

      const imagesWithUrls = await Promise.all(
        (entry.journal_entry_images ?? []).map(async (image) => {
          const { data } = await supabase.storage
            .from("journal-images")
            .createSignedUrl(image.storage_path, 60 * 60);

          return {
            id: image.id,
            file_name: image.file_name,
            signedUrl: data?.signedUrl ?? null,
          };
        })
      );

      return {
        id: tag.id,
        personId: tag.person_id,
        entry: {
          id: entry.id,
          title: entry.title,
          body: entry.body,
          created_at: entry.created_at,
          images: imagesWithUrls,
        },
      };
    })
  );

  const cleanTaggedMemories = taggedMemories.filter((memory) => memory !== null);

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <section className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Family Tree
            </p>

            <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-950">
              Explore your family line
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              Start with yourself, then expand previous generations to see the
              people connected to your family story.
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

          <Link
            href="/family"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            Manage family
          </Link>

          <Link
            href="/gallery"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            View gallery
          </Link>
        </div>

        <div className="mt-10">
          <FamilyTreeClient
            rootPerson={rootPerson}
            people={people}
            relationships={relationships ?? []}
            taggedMemories={cleanTaggedMemories}
          />
        </div>
      </section>
    </main>
  );
}