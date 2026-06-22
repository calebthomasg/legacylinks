import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AppShell from "@/components/layout/AppShell";
import FamilyTreeClient from "@/components/family/FamilyTreeClient";
import { getProfileNavHref } from "@/utils/people/getProfileNavHref";

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

  const profileHref = await getProfileNavHref(user.id);

  // 3. Get all people created by this user.
  const { data: people } = await supabase
    .from("people")
    .select(
      "id, linked_user_id, created_by_user_id, first_name, last_name, display_name, birth_date, death_date, is_living, city, state, bio, profile_photo_path"
    )
    .eq("created_by_user_id", user.id)
    .order("created_at", { ascending: false });

  // 4. Create temporary signed URLs for person profile photos.
  const peopleWithPhotoUrls = await Promise.all(
    (people ?? []).map(async (person) => {
      if (!person.profile_photo_path) {
        return {
          ...person,
          profilePhotoUrl: null,
        };
      }

      const { data } = await supabase.storage
        .from("person-photos")
        .createSignedUrl(person.profile_photo_path, 60 * 60);

      return {
        ...person,
        profilePhotoUrl: data?.signedUrl ?? null,
      };
    })
  );

  // 5. Find the person profile connected to the logged-in user.
  const rootPerson = peopleWithPhotoUrls.find(
    (person) => person.linked_user_id === user.id
  );

  // 6. If the user does not have a person profile yet, send them to family page.
  if (!rootPerson) {
    redirect("/family");
  }

  // 7. Get all relationships created by this user.
  const { data: relationships } = await supabase
    .from("family_relationships")
    .select("id, person_id, related_person_id, relationship_type, nickname")
    .eq("created_by_user_id", user.id);

  // 8. Get journal entries tagged to people.
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

  // 9. Create signed image URLs for tagged memory thumbnails.
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

  const cleanTaggedMemories = taggedMemories.filter(
    (memory): memory is NonNullable<typeof memory> => memory !== null
  );

  return (
    <AppShell
      active="tree"
      userEmail={user.email}
      profileHref={profileHref}
      contentClassName="overflow-hidden bg-[#5f5c56]"
    >
      <FamilyTreeClient
        userId={user.id}
        rootPerson={rootPerson}
        people={peopleWithPhotoUrls}
        relationships={relationships ?? []}
        taggedMemories={cleanTaggedMemories}
      />
    </AppShell>
  );
}
