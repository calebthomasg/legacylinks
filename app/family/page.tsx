import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import LogoutButton from "@/components/auth/LogoutButton";
import AddPersonForm from "@/components/family/AddPersonForm";
import AddRelationshipForm from "@/components/family/AddRelationshipForm";
import { getRelationshipLabel } from "@/utils/relationshipTypes";

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

  // 3. Get all people created by this user.
  const { data: people } = await supabase
    .from("people")
    .select(
      "id, first_name, last_name, display_name, birth_date, death_date, is_living, city, state, created_at"
    )
    .eq("created_by_user_id", user.id)
    .order("created_at", { ascending: false });

  // 4. Get all relationships created by this user.
  const { data: relationships } = await supabase
    .from("family_relationships")
    .select(
      "id, person_id, related_person_id, relationship_type, nickname, created_at"
    )
    .eq("created_by_user_id", user.id)
    .order("created_at", { ascending: false });

  // 5. Create a quick lookup so we can turn person IDs into names.
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
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <section className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Family
            </p>

            <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-950">
              Your family people
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              Add family members, ancestors, and loved ones. These person
              profiles will become the foundation for your family tree.
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
            href="/gallery"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            View gallery
          </Link>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-950">
              Add a person
            </h2>

            <p className="mt-3 text-sm leading-6 text-gray-600">
              Start by adding a family member or loved one. In the next step,
              we will connect them to your tree with relationship labels.
            </p>

            <div className="mt-6">
              <AddPersonForm userId={user.id} />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-950">
              People you have added
            </h2>

            {!people || people.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-gray-600">
                No people added yet. Add yourself, a parent, grandparent, child,
                or loved one to begin building your family tree.
              </p>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {people.map((person) => {
                  const name =
                    person.display_name ||
                    [person.first_name, person.last_name]
                      .filter(Boolean)
                      .join(" ");

                  return (
                    <article
                      key={person.id}
                      className="rounded-xl border border-gray-200 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-950">
                            {name}
                          </h3>

                          <p className="mt-1 text-xs text-gray-500">
                            {person.is_living ? "Living" : "Deceased"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 text-sm text-gray-600">
                        {person.birth_date && (
                          <p>
                            <span className="font-medium text-gray-900">
                              Birth:
                            </span>{" "}
                            {new Date(person.birth_date).toLocaleDateString()}
                          </p>
                        )}

                        {person.death_date && (
                          <p>
                            <span className="font-medium text-gray-900">
                              Death:
                            </span>{" "}
                            {new Date(person.death_date).toLocaleDateString()}
                          </p>
                        )}

                        {(person.city || person.state) && (
                          <p>
                            <span className="font-medium text-gray-900">
                              Location:
                            </span>{" "}
                            {[person.city, person.state]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </div>

                      <div className="mt-5">
                        <Link
                          href={`/family/${person.id}/edit`}
                          className="inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                        >
                          Edit profile
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-950">
              Add a relationship
            </h2>

            <p className="mt-3 text-sm leading-6 text-gray-600">
              Connect two people by defining how they are related. This
              relationship data will eventually power your visual family tree.
            </p>

            <div className="mt-6">
              <AddRelationshipForm userId={user.id} people={people ?? []} />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-950">
              Relationships you have added
            </h2>

            {!relationships || relationships.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-gray-600">
                No relationships added yet. Once you connect people, they will
                appear here.
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                {relationships.map((relationship) => (
                  <article
                    key={relationship.id}
                    className="rounded-xl border border-gray-200 p-5"
                  >
                    <p className="text-sm leading-6 text-gray-700">
                      <span className="font-semibold text-gray-950">
                        {getPersonName(relationship.related_person_id)}
                      </span>{" "}
                      is{" "}
                      <span className="font-semibold text-gray-950">
                        {getPersonName(relationship.person_id)}
                        {relationship.nickname
                          ? `’s “${relationship.nickname}”`
                          : "’s"}
                      </span>{" "}
                      — relationship type:{" "}
                      <span className="font-semibold text-gray-950">
                        {getRelationshipLabel(relationship.relationship_type)}
                      </span>
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}