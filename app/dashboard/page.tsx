import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AppShell from "@/components/layout/AppShell";
import DashboardJournalComposer from "@/components/dashboard/DashboardJournalComposer";

type PersonOption = {
  id: string;
  first_name: string;
  last_name: string | null;
  display_name: string | null;
  profile_photo_path: string | null;
};

type JournalEntryImage = {
  id: string;
  storage_path: string;
  file_name: string | null;
};

type JournalEntryPerson = {
  person_id: string;
};

type JournalEntry = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  entry_date: string | null;
  journal_entry_images: JournalEntryImage[] | null;
  journal_entry_people: JournalEntryPerson[] | null;
};

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

  const { data: people } = await supabase
    .from("people")
    .select("id, first_name, last_name, display_name, profile_photo_path")
    .eq("created_by_user_id", user.id)
    .order("created_at", { ascending: false });

  const peopleWithPhotoUrls = await Promise.all(
    (people ?? []).map(async (person: PersonOption) => {
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

  const { data: journalEntries } = await supabase
    .from("journal_entries")
    .select(`
      id,
      title,
      body,
      created_at,
      entry_date,
      journal_entry_images (
        id,
        storage_path,
        file_name
      ),
      journal_entry_people (
        person_id
      )
    `)
    .eq("user_id", user.id)
    .order("entry_date", { ascending: false });

  const entriesWithImageUrls = await Promise.all(
    ((journalEntries ?? []) as JournalEntry[]).map(async (entry) => {
      const imagesWithUrls = await Promise.all(
        (entry.journal_entry_images ?? []).map(async (image) => {
          const { data } = await supabase.storage
            .from("journal-images")
            .createSignedUrl(image.storage_path, 60 * 60);

          return {
            id: image.id,
            storage_path: image.storage_path,
            file_name: image.file_name,
            signedUrl: data?.signedUrl ?? null,
          };
        })
      );

      return {
        id: entry.id,
        title: entry.title,
        body: entry.body,
        created_at: entry.created_at,
        entry_date: entry.entry_date,
        images: imagesWithUrls,
        taggedPersonIds:
          entry.journal_entry_people?.map((tag) => tag.person_id) ?? [],
      };
    })
  );

  const userFirstName = profile?.first_name || "Friend";

  return (
    <AppShell
      active="journal"
      userName={userFirstName}
      userEmail={user.email}
      contentClassName="relative isolate overflow-hidden bg-sand bg-[url('/images/topo-background-teal.webp')] bg-cover bg-center bg-no-repeat"
    >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-0 h-72 bg-[url('/images/sky-fade.png')] bg-cover bg-top bg-no-repeat sm:h-80 lg:h-96"
            aria-hidden="true"
          />

          <div className="relative z-10 mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
            <DashboardJournalComposer
              userFirstName={userFirstName}
              people={peopleWithPhotoUrls}
              entries={entriesWithImageUrls}
            />
          </div>
    </AppShell>
  );
}
