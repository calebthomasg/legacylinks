"use client";

import { useMemo, useState } from "react";
import { getRelationshipLabel } from "@/utils/relationshipTypes";

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
};

type Relationship = {
  id: string;
  person_id: string;
  related_person_id: string;
  relationship_type: string;
  nickname: string | null;
};

type FamilyTreeClientProps = {
  rootPerson: Person;
  people: Person[];
  relationships: Relationship[];
};

const PARENT_RELATIONSHIP_TYPES = ["father", "mother", "parent"];

function getPersonName(person: Person) {
  return (
    person.display_name ||
    [person.first_name, person.last_name].filter(Boolean).join(" ")
  );
}

function formatDate(dateString: string | null) {
  if (!dateString) return null;

  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function FamilyTreeClient({
  rootPerson,
  people,
  relationships,
}: FamilyTreeClientProps) {
  const [expandedPersonIds, setExpandedPersonIds] = useState<string[]>([
    rootPerson.id,
  ]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(
    rootPerson.id
  );

  const peopleById = useMemo(() => {
    return new Map(people.map((person) => [person.id, person]));
  }, [people]);

  const selectedPerson = selectedPersonId
    ? peopleById.get(selectedPersonId)
    : null;

  function togglePerson(personId: string) {
    setExpandedPersonIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId]
    );
  }

  function getParentsForPerson(personId: string) {
    return relationships
      .filter(
        (relationship) =>
          relationship.person_id === personId &&
          PARENT_RELATIONSHIP_TYPES.includes(relationship.relationship_type)
      )
      .map((relationship) => {
        const person = peopleById.get(relationship.related_person_id);

        if (!person) return null;

        return {
          person,
          relationship,
        };
      })
      .filter(Boolean) as {
      person: Person;
      relationship: Relationship;
    }[];
  }

  function getRelationshipForSelectedPerson(personId: string) {
    return relationships.find(
      (relationship) => relationship.related_person_id === personId
    );
  }

  function TreeNode({
    person,
    relationship,
    depth = 0,
    visitedIds = [],
  }: {
    person: Person;
    relationship?: Relationship;
    depth?: number;
    visitedIds?: string[];
  }) {
    const parents = getParentsForPerson(person.id);
    const isExpanded = expandedPersonIds.includes(person.id);
    const hasParents = parents.length > 0;
    const isSelected = selectedPersonId === person.id;

    const nextVisitedIds = [...visitedIds, person.id];

    return (
      <div className="flex flex-col items-center">
        {hasParents && isExpanded && (
          <div className="mb-5 flex flex-wrap items-start justify-center gap-5">
            {parents.map(({ person: parentPerson, relationship }) => {
              const alreadyVisited = nextVisitedIds.includes(parentPerson.id);

              if (alreadyVisited) {
                return null;
              }

              return (
                <TreeNode
                  key={parentPerson.id}
                  person={parentPerson}
                  relationship={relationship}
                  depth={depth + 1}
                  visitedIds={nextVisitedIds}
                />
              );
            })}
          </div>
        )}

        {hasParents && (
          <button
            type="button"
            onClick={() => togglePerson(person.id)}
            className="mb-2 flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50"
            aria-label={isExpanded ? "Hide previous generation" : "Show previous generation"}
          >
            {isExpanded ? "−" : "↑"}
          </button>
        )}

        {hasParents && (
          <div className="mb-2 h-5 w-px bg-gray-300" aria-hidden="true" />
        )}

        <button
          type="button"
          onClick={() => setSelectedPersonId(person.id)}
          className={`w-56 rounded-2xl border bg-white p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
            isSelected ? "border-gray-950 ring-2 ring-gray-950/10" : "border-gray-200"
          }`}
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-xl font-bold text-gray-700">
            {person.first_name?.charAt(0)}
            {person.last_name?.charAt(0)}
          </div>

          <h3 className="mt-4 text-base font-semibold text-gray-950">
            {getPersonName(person)}
          </h3>

          {relationship?.nickname && (
            <p className="mt-1 text-sm font-medium text-gray-600">
              {relationship.nickname}
            </p>
          )}

          {relationship && (
            <p className="mt-1 text-xs uppercase tracking-wide text-gray-400">
              {getRelationshipLabel(relationship.relationship_type)}
            </p>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="min-h-[600px] overflow-auto rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex min-w-[700px] justify-center pb-12 pt-6">
          <TreeNode person={rootPerson} />
        </div>
      </section>

      <aside className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:sticky lg:top-6 lg:h-fit">
        {!selectedPerson ? (
          <div>
            <h2 className="text-xl font-semibold text-gray-950">
              Person details
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Select a person in the tree to view their details.
            </p>
          </div>
        ) : (
          <PersonDetails
            person={selectedPerson}
            relationship={getRelationshipForSelectedPerson(selectedPerson.id)}
            isRoot={selectedPerson.id === rootPerson.id}
          />
        )}
      </aside>
    </div>
  );
}

function PersonDetails({
  person,
  relationship,
  isRoot,
}: {
  person: Person;
  relationship?: Relationship;
  isRoot: boolean;
}) {
  const name = getPersonName(person);
  const birthDate = formatDate(person.birth_date);
  const deathDate = formatDate(person.death_date);
  const location = [person.city, person.state].filter(Boolean).join(", ");

  return (
    <div>
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xl font-bold text-gray-700">
          {person.first_name?.charAt(0)}
          {person.last_name?.charAt(0)}
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {isRoot ? "You" : "Family member"}
          </p>

          <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-950">
            {name}
          </h2>

          {relationship?.nickname && (
            <p className="mt-1 text-sm font-medium text-gray-600">
              Nickname: {relationship.nickname}
            </p>
          )}

          {relationship && (
            <p className="mt-1 text-sm text-gray-500">
              Relationship: {getRelationshipLabel(relationship.relationship_type)}
            </p>
          )}
        </div>
      </div>

      <dl className="mt-6 space-y-4 text-sm">
        {birthDate && (
          <div>
            <dt className="font-medium text-gray-500">Birthday</dt>
            <dd className="mt-1 text-gray-950">{birthDate}</dd>
          </div>
        )}

        {deathDate && (
          <div>
            <dt className="font-medium text-gray-500">Date of death</dt>
            <dd className="mt-1 text-gray-950">{deathDate}</dd>
          </div>
        )}

        <div>
          <dt className="font-medium text-gray-500">Living status</dt>
          <dd className="mt-1 text-gray-950">
            {person.is_living ? "Living" : "Deceased"}
          </dd>
        </div>

        {location && (
          <div>
            <dt className="font-medium text-gray-500">Location</dt>
            <dd className="mt-1 text-gray-950">{location}</dd>
          </div>
        )}

        {person.bio && (
          <div>
            <dt className="font-medium text-gray-500">About</dt>
            <dd className="mt-1 leading-6 text-gray-950">{person.bio}</dd>
          </div>
        )}
      </dl>

      <div className="mt-8 rounded-2xl bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-950">
          Tagged memories
        </h3>

        <p className="mt-2 text-sm leading-6 text-gray-600">
          Soon, photos and journal entries tagged with this person will appear
          here.
        </p>
      </div>
    </div>
  );
}