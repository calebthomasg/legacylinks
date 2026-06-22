import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import PersonDocumentsPanel from "@/components/people/PersonDocumentsPanel";
import {
  type AlternateName,
  CoreFactsCard,
  type EditablePerson,
  type LifeEvent,
  LifeStoryCard,
  OtherInformationCard,
  ProfileHeader,
  type ProfilePhotoHistoryItem,
} from "@/components/people/PersonProfileEditor";
import { createClient } from "@/utils/supabase/server";
import { getRelationshipLabel } from "@/utils/relationshipTypes";
import { getProfileNavHref } from "@/utils/people/getProfileNavHref";

type PersonProfilePageProps = {
  params: Promise<{
    personId: string;
  }>;
};

type Person = {
  id: string;
  linked_user_id: string | null;
  created_by_user_id: string;
  first_name: string;
  last_name: string | null;
  display_name: string | null;
  birth_date: string | null;
  death_date: string | null;
  is_living: boolean | null;
  city: string | null;
  state: string | null;
  bio: string | null;
  profile_photo_path: string | null;
  cover_photo_path: string | null;
  cover_photo_position_x: number | null;
  cover_photo_position_y: number | null;
  profile_summary: string | null;
  notes: string | null;
  sex: string | null;
  birth_city: string | null;
  birth_state: string | null;
  birth_place: string | null;
  death_city: string | null;
  death_state: string | null;
  death_place: string | null;
  burial_date: string | null;
  burial_city: string | null;
  burial_state: string | null;
  burial_place: string | null;
  christening_date: string | null;
  christening_city: string | null;
  christening_state: string | null;
  christening_place: string | null;
  baptism_date: string | null;
  baptism_city: string | null;
  baptism_state: string | null;
  baptism_place: string | null;
};

type Relationship = {
  id: string;
  person_id: string;
  related_person_id: string;
  relationship_type: string;
  nickname: string | null;
};

type JournalEntry = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  entry_date: string | null;
};

type JournalEntryImage = {
  id: string;
  journal_entry_id: string;
  storage_path: string;
  file_name: string | null;
  created_at: string;
};

type PersonDocument = {
  id: string;
  storage_path: string;
  file_name: string;
  document_name: string;
  document_category: string;
  document_date: string | null;
  description: string | null;
  created_at: string;
};

type PersonProfilePhoto = {
  id: string;
  storage_path: string;
  file_name: string | null;
  is_current: boolean;
  created_at: string;
};

type FamilyMember = {
  person: Pick<
    Person,
    | "id"
    | "first_name"
    | "last_name"
    | "display_name"
    | "birth_date"
    | "death_date"
    | "is_living"
    | "linked_user_id"
  >;
  relationship: Relationship;
};

const PARENT_RELATIONSHIP_TYPES = ["father", "mother", "parent"];
const CHILD_RELATIONSHIP_TYPES = ["son", "daughter", "child"];
const SIBLING_RELATIONSHIP_TYPES = ["brother", "sister", "sibling"];
const SPOUSE_RELATIONSHIP_TYPES = ["husband", "wife", "spouse"];

function getPersonName(person: {
  first_name: string;
  last_name: string | null;
  display_name: string | null;
}) {
  return (
    person.display_name ||
    [person.first_name, person.last_name].filter(Boolean).join(" ") ||
    "Unnamed person"
  );
}

function getInitials(person: Person) {
  const name = getPersonName(person);
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "?";
}

function formatDate(dateString: string | null) {
  if (!dateString) return null;

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getYear(dateString: string | null) {
  if (!dateString) return null;

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) return null;

  return date.getFullYear();
}

function isPersonDeceased(person: Person) {
  return person.is_living === false || Boolean(person.death_date);
}

function isPersonOnline(person: Person, userId: string) {
  // TODO: replace this placeholder with true Supabase Realtime presence once
  // the account/family sharing model is ready.
  return !isPersonDeceased(person) && person.linked_user_id === userId;
}

function getPreview(body: string) {
  const trimmed = body.trim();

  if (trimmed.length <= 150) return trimmed;

  return `${trimmed.slice(0, 150)}...`;
}

function dedupeFamilyMembers(members: FamilyMember[]) {
  const memberMap = new Map<string, FamilyMember>();

  members.forEach((member) => {
    if (!memberMap.has(member.person.id)) {
      memberMap.set(member.person.id, member);
    }
  });

  return [...memberMap.values()];
}

function buildFamilySections(
  personId: string,
  relationships: Relationship[],
  sharedParentRelationships: Relationship[],
  peopleById: Map<string, Person>
) {
  function toMember(personIdToFind: string, relationship: Relationship) {
    const person = peopleById.get(personIdToFind);

    if (!person) return null;

    return { person, relationship };
  }

  const parents = relationships
    .filter(
      (relationship) =>
        relationship.person_id === personId &&
        PARENT_RELATIONSHIP_TYPES.includes(relationship.relationship_type)
    )
    .map((relationship) => toMember(relationship.related_person_id, relationship))
    .filter(Boolean) as FamilyMember[];

  const directChildren = relationships
    .filter(
      (relationship) =>
        relationship.person_id === personId &&
        CHILD_RELATIONSHIP_TYPES.includes(relationship.relationship_type)
    )
    .map((relationship) => toMember(relationship.related_person_id, relationship))
    .filter(Boolean) as FamilyMember[];

  const inverseChildren = relationships
    .filter(
      (relationship) =>
        relationship.related_person_id === personId &&
        PARENT_RELATIONSHIP_TYPES.includes(relationship.relationship_type)
    )
    .map((relationship) => toMember(relationship.person_id, relationship))
    .filter(Boolean) as FamilyMember[];

  const directSpouses = relationships
    .filter(
      (relationship) =>
        relationship.person_id === personId &&
        SPOUSE_RELATIONSHIP_TYPES.includes(relationship.relationship_type)
    )
    .map((relationship) => toMember(relationship.related_person_id, relationship))
    .filter(Boolean) as FamilyMember[];

  const inverseSpouses = relationships
    .filter(
      (relationship) =>
        relationship.related_person_id === personId &&
        SPOUSE_RELATIONSHIP_TYPES.includes(relationship.relationship_type)
    )
    .map((relationship) => toMember(relationship.person_id, relationship))
    .filter(Boolean) as FamilyMember[];

  const explicitSiblings = relationships
    .filter(
      (relationship) =>
        relationship.person_id === personId &&
        SIBLING_RELATIONSHIP_TYPES.includes(relationship.relationship_type)
    )
    .map((relationship) => toMember(relationship.related_person_id, relationship))
    .filter(Boolean) as FamilyMember[];

  // TODO: replace this best-effort sibling inference with a canonical family
  // graph once shared family access and reciprocal relationships are formalized.
  const sharedParentSiblings = sharedParentRelationships
    .filter((relationship) => relationship.person_id !== personId)
    .map((relationship) => toMember(relationship.person_id, relationship))
    .filter(Boolean) as FamilyMember[];

  return {
    parents: dedupeFamilyMembers(parents),
    siblings: dedupeFamilyMembers([...explicitSiblings, ...sharedParentSiblings]),
    spouses: dedupeFamilyMembers([...directSpouses, ...inverseSpouses]),
    children: dedupeFamilyMembers([...directChildren, ...inverseChildren]),
  };
}

export default async function PersonProfilePage({
  params,
}: PersonProfilePageProps) {
  const { personId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profileHref = await getProfileNavHref(user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();

  const { data: person } = await supabase
    .from("people")
    .select(
      "id, linked_user_id, created_by_user_id, first_name, last_name, display_name, birth_date, death_date, is_living, city, state, bio, profile_photo_path, cover_photo_path, cover_photo_position_x, cover_photo_position_y, profile_summary, notes, sex, birth_city, birth_state, birth_place, death_city, death_state, death_place, burial_date, burial_city, burial_state, burial_place, christening_date, christening_city, christening_state, christening_place, baptism_date, baptism_city, baptism_state, baptism_place"
    )
    .eq("id", personId)
    .single();

  if (!person) {
    notFound();
  }

  const typedPerson = person as Person;
  const canEdit = typedPerson.created_by_user_id === user.id;
  const isOwnProfile =
    typedPerson.linked_user_id === user.id && !isPersonDeceased(typedPerson);

  const profilePhotoUrl = typedPerson.profile_photo_path
    ? (
        await supabase.storage
          .from("person-photos")
          .createSignedUrl(typedPerson.profile_photo_path, 60 * 60)
      ).data?.signedUrl ?? null
    : null;

  const coverPhotoUrl = typedPerson.cover_photo_path
    ? (
        await supabase.storage
          .from("person-cover-photos")
          .createSignedUrl(typedPerson.cover_photo_path, 60 * 60)
      ).data?.signedUrl ?? null
    : null;

  const { data: profilePhotoHistoryData } = canEdit
    ? await supabase
        .from("person_profile_photos")
        .select("id, storage_path, file_name, is_current, created_at")
        .eq("person_id", personId)
        .eq("uploaded_by_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12)
    : { data: [] };

  const profilePhotoHistory = await Promise.all(
    ((profilePhotoHistoryData ?? []) as PersonProfilePhoto[]).map(
      async (photo) => {
        const { data } = await supabase.storage
          .from("person-photos")
          .createSignedUrl(photo.storage_path, 60 * 60, {
            transform: {
              width: 120,
              height: 120,
              resize: "cover",
              quality: 70,
            },
          });

        return {
          ...photo,
          signedUrl: data?.signedUrl ?? null,
        };
      }
    )
  );

  const { data: relationshipsData } = await supabase
    .from("family_relationships")
    .select("id, person_id, related_person_id, relationship_type, nickname")
    .eq("created_by_user_id", user.id)
    .or(`person_id.eq.${personId},related_person_id.eq.${personId}`);

  const relationships = (relationshipsData ?? []) as Relationship[];
  const parentIds = relationships
    .filter(
      (relationship) =>
        relationship.person_id === personId &&
        PARENT_RELATIONSHIP_TYPES.includes(relationship.relationship_type)
    )
    .map((relationship) => relationship.related_person_id);

  const { data: sharedParentRelationshipsData } = parentIds.length
    ? await supabase
        .from("family_relationships")
        .select("id, person_id, related_person_id, relationship_type, nickname")
        .eq("created_by_user_id", user.id)
        .in("related_person_id", parentIds)
        .in("relationship_type", PARENT_RELATIONSHIP_TYPES)
    : { data: [] };

  const sharedParentRelationships =
    (sharedParentRelationshipsData ?? []) as Relationship[];
  const relatedPersonIds = new Set<string>();

  relationships.forEach((relationship) => {
    relatedPersonIds.add(relationship.person_id);
    relatedPersonIds.add(relationship.related_person_id);
  });
  sharedParentRelationships.forEach((relationship) => {
    relatedPersonIds.add(relationship.person_id);
    relatedPersonIds.add(relationship.related_person_id);
  });
  relatedPersonIds.delete(personId);

  const { data: relatedPeopleData } = relatedPersonIds.size
    ? await supabase
        .from("people")
        .select(
          "id, linked_user_id, created_by_user_id, first_name, last_name, display_name, birth_date, death_date, is_living, city, state, bio, profile_photo_path, cover_photo_path, cover_photo_position_x, cover_photo_position_y, profile_summary, notes, sex, birth_city, birth_state, birth_place, death_city, death_state, death_place, burial_date, burial_city, burial_state, burial_place, christening_date, christening_city, christening_state, christening_place, baptism_date, baptism_city, baptism_state, baptism_place"
        )
        .in("id", [...relatedPersonIds])
    : { data: [] };

  const peopleById = new Map<string, Person>([
    [typedPerson.id, typedPerson],
    ...((relatedPeopleData ?? []) as Person[]).map((relatedPerson) => [
      relatedPerson.id,
      relatedPerson,
    ] as const),
  ]);

  const familySections = buildFamilySections(
    personId,
    relationships,
    sharedParentRelationships,
    peopleById
  );

  const { data: taggedRows } = await supabase
    .from("journal_entry_people")
    .select("journal_entry_id, created_at")
    .eq("person_id", personId)
    .eq("tagged_by_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(6);

  const memoryEntryIds = [
    ...new Set((taggedRows ?? []).map((row) => row.journal_entry_id as string)),
  ];

  const { data: entriesData } = memoryEntryIds.length
    ? await supabase
        .from("journal_entries")
        .select("id, title, body, created_at, entry_date")
        .eq("user_id", user.id)
        .in("id", memoryEntryIds)
        .order("entry_date", { ascending: false })
        .limit(6)
    : { data: [] };

  const { data: imagesData } = memoryEntryIds.length
    ? await supabase
        .from("journal_entry_images")
        .select("id, journal_entry_id, storage_path, file_name, created_at")
        .eq("user_id", user.id)
        .in("journal_entry_id", memoryEntryIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const firstImageByEntryId = new Map<string, JournalEntryImage>();

  ((imagesData ?? []) as JournalEntryImage[]).forEach((image) => {
    if (!firstImageByEntryId.has(image.journal_entry_id)) {
      firstImageByEntryId.set(image.journal_entry_id, image);
    }
  });

  const memories = await Promise.all(
    ((entriesData ?? []) as JournalEntry[]).map(async (entry) => {
      const image = firstImageByEntryId.get(entry.id);

      if (!image) {
        return {
          ...entry,
          thumbnailUrl: null,
        };
      }

      const { data } = await supabase.storage
        .from("journal-images")
        .createSignedUrl(image.storage_path, 60 * 60, {
          transform: {
            width: 240,
            height: 160,
            resize: "cover",
            quality: 70,
          },
        });

      return {
        ...entry,
        thumbnailUrl: data?.signedUrl ?? null,
      };
    })
  );

  const { data: documentsData } = await supabase
    .from("person_documents")
    .select(
      "id, storage_path, file_name, document_name, document_category, document_date, description, created_at"
    )
    .eq("person_id", personId)
    .eq("uploaded_by_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(8);

  const { data: alternateNamesData } = canEdit
    ? await supabase
        .from("person_alternate_names")
        .select("id, name, name_type, notes")
        .eq("person_id", personId)
        .eq("created_by_user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const { data: lifeEventsData } = canEdit
    ? await supabase
        .from("person_life_events")
        .select("id, event_type, title, event_date, event_place, description")
        .eq("person_id", personId)
        .eq("created_by_user_id", user.id)
        .order("event_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
    : { data: [] };

  const userName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.first_name ||
    "LegacyLinks";
  const personName = getPersonName(typedPerson);

  return (
    <AppShell
      active={isOwnProfile ? "profile" : "tree"}
      userName={userName}
      userEmail={user.email}
      profileHref={profileHref}
      contentClassName="bg-sand"
    >
      <section className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        <Link
          href="/tree"
          className="text-sm font-semibold text-night-sky/65 transition hover:text-sky-depth"
        >
          Back to family tree
        </Link>

        <ProfileHeader
          person={typedPerson as EditablePerson}
          userId={user.id}
          canEdit={canEdit}
          personName={personName}
          initials={getInitials(typedPerson)}
          isDeceased={isPersonDeceased(typedPerson)}
          isOnline={isPersonOnline(typedPerson, user.id)}
          showAccountLink={isOwnProfile}
          profilePhotoUrl={profilePhotoUrl}
          coverPhotoUrl={coverPhotoUrl}
          profilePhotoHistory={
            profilePhotoHistory as ProfilePhotoHistoryItem[]
          }
        />

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <CoreFactsCard
              person={typedPerson as EditablePerson}
              canEdit={canEdit}
            />

            <LifeStoryCard
              person={typedPerson as EditablePerson}
              canEdit={canEdit}
            />

            <InfoCard title="Stories & memories">
              {memories.length === 0 ? (
                <EmptyState>
                  No memories have been added yet. This could be the first
                  breadcrumb on the trail.
                </EmptyState>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {memories.map((memory) => (
                    <Link
                      key={memory.id}
                      href={`/journal/${memory.id}/edit`}
                      className="group overflow-hidden rounded-xl border border-night-sky/10 bg-white transition hover:-translate-y-0.5 hover:shadow-sm"
                    >
                      {memory.thumbnailUrl && (
                        <Image
                          src={memory.thumbnailUrl}
                          alt=""
                          width={240}
                          height={160}
                          className="h-36 w-full object-cover"
                          unoptimized
                        />
                      )}
                      <div className="p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-night-sky/45">
                          {formatDate(memory.entry_date ?? memory.created_at)}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-night-sky group-hover:text-sky-depth">
                          {memory.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-night-sky/65">
                          {getPreview(memory.body)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </InfoCard>

            <PersonDocumentsPanel
              personId={typedPerson.id}
              userId={user.id}
              documents={(documentsData ?? []) as PersonDocument[]}
            />

            <OtherInformationCard
              person={typedPerson as EditablePerson}
              userId={user.id}
              canEdit={canEdit}
              alternateNames={(alternateNamesData ?? []) as AlternateName[]}
              lifeEvents={(lifeEventsData ?? []) as LifeEvent[]}
            />
          </div>

          <aside className="space-y-6">
            <InfoCard title="Family members">
              <div className="space-y-6">
                <FamilySection
                  title="Parents"
                  members={familySections.parents}
                />
                <FamilySection
                  title="Siblings"
                  members={familySections.siblings}
                />
                <FamilySection
                  title="Spouse/spouses"
                  members={familySections.spouses}
                />
                <FamilySection
                  title="Children"
                  members={familySections.children}
                />
              </div>
            </InfoCard>
          </aside>
        </div>
      </section>
    </AppShell>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-night-sky/10 bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-semibold text-night-sky">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-sand px-4 py-5 text-sm leading-6 text-night-sky/65">
      {children}
    </p>
  );
}

function FamilySection({
  title,
  members,
}: {
  title: string;
  members: FamilyMember[];
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-night-sky">{title}</h3>
        <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold text-night-sky/55">
          {members.length}
        </span>
      </div>

      {members.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-night-sky/55">
          Nothing connected here yet.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {members.map(({ person, relationship }) => (
            <Link
              key={`${relationship.id}-${person.id}`}
              href={`/people/${person.id}`}
              className="block rounded-xl border border-night-sky/10 px-4 py-3 transition hover:border-sky/50 hover:bg-sand/55"
            >
              <p className="font-semibold text-night-sky">
                {getPersonName(person)}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-night-sky/45">
                {getRelationshipLabel(relationship.relationship_type)}
              </p>
              <p className="mt-1 text-xs text-night-sky/55">
                {[getYear(person.birth_date), getYear(person.death_date)]
                  .filter(Boolean)
                  .join(" - ") || "Dates unknown"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
