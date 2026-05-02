"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getRelationshipLabel } from "@/utils/relationshipTypes";
import AddParentModal from "@/components/family/AddParentModal";

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
  profilePhotoUrl: string | null;
};

type Relationship = {
  id: string;
  person_id: string;
  related_person_id: string;
  relationship_type: string;
  nickname: string | null;
};

type TaggedMemory = {
  id: string;
  personId: string;
  entry: {
    id: string;
    title: string;
    body: string;
    created_at: string;
    images: {
      id: string;
      file_name: string | null;
      signedUrl: string | null;
    }[];
  };
};

type FamilyTreeClientProps = {
  userId: string;
  rootPerson: Person;
  people: Person[];
  relationships: Relationship[];
  taggedMemories: TaggedMemory[];
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

function getEntryPreview(body: string) {
  if (body.length <= 120) {
    return body;
  }

  return `${body.slice(0, 120)}...`;
}

export default function FamilyTreeClient({
  userId,
  rootPerson,
  people,
  relationships,
  taggedMemories,
}: FamilyTreeClientProps) {
  const [expandedPersonIds, setExpandedPersonIds] = useState<string[]>([
    rootPerson.id,
  ]);

  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(
    rootPerson.id
  );

  const [addingParentForPerson, setAddingParentForPerson] =
    useState<Person | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPointerPosition, setLastPointerPosition] = useState({
    x: 0,
    y: 0,
  });

  const treeViewportRef = useRef<HTMLElement | null>(null);

  const peopleById = useMemo(() => {
    return new Map(people.map((person) => [person.id, person]));
  }, [people]);

  const selectedPerson = selectedPersonId
    ? peopleById.get(selectedPersonId)
    : null;

  useEffect(() => {
    const viewport = treeViewportRef.current;

    if (!viewport) return;

    function handleNativeWheel(event: WheelEvent) {
      event.preventDefault();

      const zoomDirection = event.deltaY > 0 ? -0.08 : 0.08;

      setZoom((current) => {
        const nextZoom = Number((current + zoomDirection).toFixed(2));
        return Math.min(Math.max(nextZoom, 0.4), 1.8);
      });
    }

    viewport.addEventListener("wheel", handleNativeWheel, { passive: false });

    return () => {
      viewport.removeEventListener("wheel", handleNativeWheel);
    };
  }, []);

  function togglePerson(personId: string) {
    setExpandedPersonIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId]
    );
  }

  function getParentsForPerson(personId: string) {
    const parentRelationships = relationships.filter(
      (relationship) =>
        relationship.person_id === personId &&
        PARENT_RELATIONSHIP_TYPES.includes(relationship.relationship_type)
    );

    const sortedRelationships = [...parentRelationships].sort((a, b) => {
      const order = ["father", "mother", "parent"];

      return (
        order.indexOf(a.relationship_type) -
        order.indexOf(b.relationship_type)
      );
    });

    return sortedRelationships
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

  function getTaggedMemoriesForPerson(personId: string) {
    return taggedMemories.filter((memory) => memory.personId === personId);
  }

  function zoomIn() {
    setZoom((current) => Math.min(Number((current + 0.1).toFixed(2)), 1.8));
  }

  function zoomOut() {
    setZoom((current) => Math.max(Number((current - 0.1).toFixed(2)), 0.4));
  }

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLElement>) {
    const target = event.target as HTMLElement;

    if (target.closest("button, a, input, textarea, select")) {
      return;
    }

    setIsPanning(true);
    setLastPointerPosition({
      x: event.clientX,
      y: event.clientY,
    });

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    if (!isPanning) return;

    const deltaX = event.clientX - lastPointerPosition.x;
    const deltaY = event.clientY - lastPointerPosition.y;

    setPan((current) => ({
      x: current.x + deltaX,
      y: current.y + deltaY,
    }));

    setLastPointerPosition({
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handlePointerUp() {
    setIsPanning(false);
  }

  function PersonAvatar({
    person,
    size = "large",
  }: {
    person: Person;
    size?: "small" | "large";
  }) {
    const sizeClasses = size === "large" ? "h-16 w-16" : "h-14 w-14";

    return (
      <div
        className={`mx-auto flex ${sizeClasses} items-center justify-center overflow-hidden rounded-full bg-gray-100 text-xl font-bold text-gray-700`}
      >
        {person.profilePhotoUrl ? (
          <img
            src={person.profilePhotoUrl}
            alt={getPersonName(person)}
            className="h-full w-full object-cover"
          />
        ) : (
          <>
            {person.first_name?.charAt(0)}
            {person.last_name?.charAt(0)}
          </>
        )}
      </div>
    );
  }

  function PersonCard({
    person,
    relationship,
  }: {
    person: Person;
    relationship?: Relationship;
  }) {
    const isSelected = selectedPersonId === person.id;
    const taggedMemoryCount = getTaggedMemoriesForPerson(person.id).length;

    return (
      <button
        type="button"
        onClick={() => setSelectedPersonId(person.id)}
        className={`flex h-52 w-56 flex-col items-center rounded-2xl border bg-white p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
          isSelected
            ? "border-gray-950 ring-2 ring-gray-950/10"
            : "border-gray-200"
        }`}
      >
        <PersonAvatar person={person} />

        <div className="mt-4 flex min-h-12 w-full flex-col items-center justify-start">
          <h3 className="line-clamp-2 text-base font-semibold leading-5 text-gray-950">
            {getPersonName(person)}
          </h3>

          <p className="mt-1 min-h-5 text-sm font-medium text-gray-600">
            {relationship?.nickname ?? ""}
          </p>

          <p className="min-h-4 text-xs uppercase tracking-wide text-gray-400">
            {relationship
              ? getRelationshipLabel(relationship.relationship_type)
              : ""}
          </p>
        </div>

        <div className="mt-auto w-full">
          <p
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              taggedMemoryCount > 0
                ? "bg-gray-100 text-gray-600"
                : "bg-transparent text-transparent"
            }`}
          >
            {taggedMemoryCount > 0
              ? `${taggedMemoryCount} tagged memor${
                  taggedMemoryCount === 1 ? "y" : "ies"
                }`
              : "0 tagged memories"}
          </p>
        </div>
      </button>
    );
  }

  function TreeConnector({ hasTwoParents }: { hasTwoParents: boolean }) {
    return (
      <div className="flex flex-col items-center">
        {hasTwoParents && (
          <div className="h-px w-72 bg-gray-300" aria-hidden="true" />
        )}

        <div className="h-8 w-px bg-gray-300" aria-hidden="true" />
      </div>
    );
  }

  function TreeControls({
    person,
    hasParents,
    isExpanded,
    parentCount,
  }: {
    person: Person;
    hasParents: boolean;
    isExpanded: boolean;
    parentCount: number;
  }) {
    const canAddMoreParents = parentCount < 2;

    return (
      <div className="mb-2 flex items-center justify-center gap-2">
        {hasParents && (
          <button
            type="button"
            onClick={() => togglePerson(person.id)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50"
            aria-label={
              isExpanded
                ? "Hide previous generation"
                : "Show previous generation"
            }
          >
            {isExpanded ? "−" : "↑"}
          </button>
        )}

        {canAddMoreParents && (
          <button
            type="button"
            onClick={() => setAddingParentForPerson(person)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50"
            aria-label={`Add parent for ${getPersonName(person)}`}
            title={`Add parent for ${getPersonName(person)}`}
          >
            +
          </button>
        )}
      </div>
    );
  }

  function TreeNode({
    person,
    relationship,
    visitedIds = [],
  }: {
    person: Person;
    relationship?: Relationship;
    visitedIds?: string[];
  }) {
    const parents = getParentsForPerson(person.id);
    const isExpanded = expandedPersonIds.includes(person.id);
    const hasParents = parents.length > 0;
    const nextVisitedIds = [...visitedIds, person.id];

    return (
      <div className="flex flex-col items-center">
        {hasParents && isExpanded && (
          <>
            <div className="flex items-end justify-center gap-6">
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
                    visitedIds={nextVisitedIds}
                  />
                );
              })}
            </div>

            <TreeConnector hasTwoParents={parents.length > 1} />
          </>
        )}

        <TreeControls
          person={person}
          hasParents={hasParents}
          isExpanded={isExpanded}
          parentCount={parents.length}
        />

        {(hasParents || parents.length < 2) && (
          <div className="mb-2 h-5 w-px bg-gray-300" aria-hidden="true" />
        )}

        <PersonCard person={person} relationship={relationship} />
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <section
          ref={treeViewportRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`relative h-[720px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ${
            isPanning ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-2xl border border-gray-200 bg-white/95 p-2 shadow-sm backdrop-blur">
            <button
              type="button"
              onClick={zoomOut}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-300 text-sm font-bold text-gray-800 hover:bg-gray-50"
              aria-label="Zoom out"
            >
              −
            </button>

            <div className="min-w-14 text-center text-xs font-semibold text-gray-600">
              {Math.round(zoom * 100)}%
            </div>

            <button
              type="button"
              onClick={zoomIn}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-300 text-sm font-bold text-gray-800 hover:bg-gray-50"
              aria-label="Zoom in"
            >
              +
            </button>

            <button
              type="button"
              onClick={resetView}
              className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
            >
              Reset view
            </button>
          </div>

          <div className="pointer-events-none absolute bottom-4 left-4 z-20 rounded-xl bg-white/90 px-3 py-2 text-xs text-gray-500 shadow-sm">
            Drag to move • Scroll to zoom
          </div>

          <div
            className="absolute bottom-12 left-1/2 w-max"
            style={{
              transform: `translate(calc(-50% + ${pan.x}px), ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center bottom",
            }}
          >
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
              taggedMemories={getTaggedMemoriesForPerson(selectedPerson.id)}
            />
          )}
        </aside>
      </div>

      {addingParentForPerson && (
        <AddParentModal
          userId={userId}
          childPerson={addingParentForPerson}
          onClose={() => setAddingParentForPerson(null)}
        />
      )}
    </>
  );
}

function PersonDetails({
  person,
  relationship,
  isRoot,
  taggedMemories,
}: {
  person: Person;
  relationship?: Relationship;
  isRoot: boolean;
  taggedMemories: TaggedMemory[];
}) {
  const name = getPersonName(person);
  const birthDate = formatDate(person.birth_date);
  const deathDate = formatDate(person.death_date);
  const location = [person.city, person.state].filter(Boolean).join(", ");

  return (
    <div>
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-xl font-bold text-gray-700">
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

      <div className="mt-8 border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-950">
            Tagged memories
          </h3>

          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            {taggedMemories.length}
          </span>
        </div>

        {taggedMemories.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-gray-600">
            No journal entries have been tagged with this person yet.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {taggedMemories.map((memory) => (
              <article
                key={memory.id}
                className="rounded-xl border border-gray-200 p-4"
              >
                <p className="text-xs font-medium text-gray-500">
                  {formatDate(memory.entry.created_at)}
                </p>

                <h4 className="mt-1 text-sm font-semibold text-gray-950">
                  {memory.entry.title}
                </h4>

                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {getEntryPreview(memory.entry.body)}
                </p>

                {memory.entry.images.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {memory.entry.images.slice(0, 3).map((image) =>
                      image.signedUrl ? (
                        <img
                          key={image.id}
                          src={image.signedUrl}
                          alt={image.file_name ?? "Tagged memory image"}
                          className="h-20 w-full rounded-lg object-cover"
                        />
                      ) : null
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}