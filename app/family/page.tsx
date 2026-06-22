import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import AppShell from "@/components/layout/AppShell";
import AddPersonForm from "@/components/family/AddPersonForm";
import AddRelationshipForm from "@/components/family/AddRelationshipForm";
import DeletePersonButton from "@/components/family/DeletePersonButton";
import DeleteRelationshipButton from "@/components/family/DeleteRelationshipButton";
import { getRelationshipLabel } from "@/utils/relationshipTypes";
import { getProfileNavHref } from "@/utils/people/getProfileNavHref";

export default async function FamilyPage() {
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
      "id, linked_user_id, first_name, last_name, display_name, birth_date, death_date, is_living, city, state, profile_photo_path, created_at"
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

  // 5. Get all relationships created by this user.
  const { data: relationships } = await supabase
    .from("family_relationships")
    .select(
      "id, person_id, related_person_id, relationship_type, nickname, created_at"
    )
    .eq("created_by_user_id", user.id)
    .order("created_at", { ascending: false });

  // 6. Create a quick lookup so we can turn person IDs into names.
  const peopleById = new Map(
    (people ?? []).map((person) => [person.id, person])
  );

  function getPersonName(personId: string) {
    const person = peopleById.get(personId);

    if (!person) {
      return "Unknown person";
    }

    return (
      person.display_name ||
      [person.first_name, person.last_name].filter(Boolean).join(" ")
    );
  }

  return (
    <AppShell active="family" userEmail={user.email} profileHref={profileHref}>
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-night-sky/60">
            Family
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight text-night-sky">
            Your family people
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-night-sky/70">
            Add family members, ancestors, and loved ones. These person
            profiles will become the foundation for your family tree.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-4">
          <Link
            href="/tree"
            className="button-secondary"
          >
            View family tree
          </Link>

          <Link
            href="/gallery"
            className="button-secondary"
          >
            View gallery
          </Link>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <section className="rounded-2xl border border-night-sky/10 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-night-sky">
              Add a person
            </h2>

            <p className="mt-3 text-sm leading-6 text-night-sky/70">
              Start by adding a family member or loved one. In the next step,
              we will connect them to your tree with relationship labels.
            </p>

            <div className="mt-6">
              <AddPersonForm userId={user.id} />
            </div>
          </section>

          <section className="rounded-2xl border border-night-sky/10 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-night-sky">
              People you have added
            </h2>

            {peopleWithPhotoUrls.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-night-sky/70">
                No people added yet. Add yourself, a parent, grandparent, child,
                or loved one to begin building your family tree.
              </p>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {peopleWithPhotoUrls.map((person) => {
                  const name =
                    person.display_name ||
                    [person.first_name, person.last_name]
                      .filter(Boolean)
                      .join(" ");

                  return (
                    <article
                      key={person.id}
                      className="rounded-xl border border-night-sky/10 p-5"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sand text-base font-bold text-night-sky/75">
                          {person.profilePhotoUrl ? (
                            <img
                              src={person.profilePhotoUrl}
                              alt={name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <>
                              {person.first_name?.charAt(0)}
                              {person.last_name?.charAt(0)}
                            </>
                          )}
                        </div>

                        <div>
                          <h3 className="text-lg font-semibold text-night-sky">
                            {name}
                          </h3>

                          <p className="mt-1 text-xs text-night-sky/60">
                            {person.is_living ? "Living" : "Deceased"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 text-sm text-night-sky/70">
                        {person.birth_date && (
                          <p>
                            <span className="font-medium text-night-sky">
                              Birth:
                            </span>{" "}
                            {new Date(person.birth_date).toLocaleDateString()}
                          </p>
                        )}

                        {person.death_date && (
                          <p>
                            <span className="font-medium text-night-sky">
                              Death:
                            </span>{" "}
                            {new Date(person.death_date).toLocaleDateString()}
                          </p>
                        )}

                        {(person.city || person.state) && (
                          <p>
                            <span className="font-medium text-night-sky">
                              Location:
                            </span>{" "}
                            {[person.city, person.state]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <Link
                          href={`/family/${person.id}/edit`}
                          className="button-secondary"
                        >
                          Edit profile
                        </Link>

                        <DeletePersonButton
                          personId={person.id}
                          isLinkedUser={person.linked_user_id === user.id}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <section className="rounded-2xl border border-night-sky/10 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-night-sky">
              Add a relationship
            </h2>

            <p className="mt-3 text-sm leading-6 text-night-sky/70">
              Connect two people by defining how they are related. This
              relationship data will eventually power your visual family tree.
            </p>

            <div className="mt-6">
              <AddRelationshipForm userId={user.id} people={people ?? []} />
            </div>
          </section>

          <section className="rounded-2xl border border-night-sky/10 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-night-sky">
              Relationships you have added
            </h2>

            {!relationships || relationships.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-night-sky/70">
                No relationships added yet. Once you connect people, they will
                appear here.
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                {relationships.map((relationship) => (
                  <article
                    key={relationship.id}
                    className="rounded-xl border border-night-sky/10 p-5"
                  >
                    <p className="text-sm leading-6 text-night-sky/75">
                      <span className="font-semibold text-night-sky">
                        {getPersonName(relationship.related_person_id)}
                      </span>{" "}
                      is{" "}
                      <span className="font-semibold text-night-sky">
                        {getPersonName(relationship.person_id)}
                        {relationship.nickname
                          ? `’s “${relationship.nickname}”`
                          : "’s"}
                      </span>{" "}
                      — relationship type:{" "}
                      <span className="font-semibold text-night-sky">
                        {getRelationshipLabel(relationship.relationship_type)}
                      </span>
                    </p>

                    <div className="mt-4">
                      <DeleteRelationshipButton
                        relationshipId={relationship.id}
                      />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </AppShell>
  );
}
