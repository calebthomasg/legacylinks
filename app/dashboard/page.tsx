import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import LogoutButton from "@/components/auth/LogoutButton";
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
    <main className="min-h-screen bg-white text-gray-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-[280px] shrink-0 border-r border-gray-200 bg-white lg:flex lg:flex-col">
          <div className="border-b border-gray-200 px-8 py-8">
            <Link href="/dashboard" className="block">
              <img
                src="/images/LL-Logo-1-B.png"
                alt="LegacyLink"
                className="h-auto w-48"
              />
            </Link>
          </div>

          <nav className="flex-1 px-4 py-6">
            <div className="space-y-1">
              <SidebarLink href="/dashboard" active>
                Journal
              </SidebarLink>

              <SidebarLink href="/tree">My Family Tree</SidebarLink>
              <SidebarLink href="/gallery">Photo Gallery</SidebarLink>
              <SidebarLink href="/family">Manage Family</SidebarLink>
              <SidebarLink href="/profile">Account</SidebarLink>

              <div className="pt-6">
                <p className="px-4 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                  Coming later
                </p>
              </div>

              <SidebarLink href="#" disabled>
                Family Feed
              </SidebarLink>

              <SidebarLink href="#" disabled>
                Family Chat
              </SidebarLink>

              <SidebarLink href="#" disabled>
                Clans
              </SidebarLink>

              <SidebarLink href="#" disabled>
                FamilySearch Sync
              </SidebarLink>

              <SidebarLink href="#" disabled>
                LegacyLinks Map
              </SidebarLink>

              <SidebarLink href="#" disabled>
                Bedtime Stories
              </SidebarLink>
            </div>
          </nav>

          <div className="border-t border-gray-200 px-6 py-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {userFirstName}
                </p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>

              <LogoutButton />
            </div>
          </div>
        </aside>

        <section className="flex-1 bg-gray-50">
          <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
            <div className="mb-6 flex flex-wrap items-center gap-3 lg:hidden">
              <Link
                href="/tree"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
              >
                My Family Tree
              </Link>

              <Link
                href="/gallery"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
              >
                Photo Gallery
              </Link>

              <Link
                href="/family"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
              >
                Manage Family
              </Link>
            </div>

            <DashboardJournalComposer
              userFirstName={userFirstName}
              people={peopleWithPhotoUrls}
              entries={entriesWithImageUrls}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function SidebarLink({
  href,
  children,
  active = false,
  disabled = false,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div className="flex items-center justify-between rounded-2xl px-4 py-3 text-[15px] font-medium text-gray-400">
        <span>{children}</span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-2xl px-4 py-3 text-[15px] font-medium transition ${
        active
          ? "bg-gray-900 text-white"
          : "text-gray-700 hover:bg-gray-100 hover:text-gray-950"
      }`}
    >
      <span>{children}</span>
    </Link>
  );
}