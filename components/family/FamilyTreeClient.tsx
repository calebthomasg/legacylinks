"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
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
type InferredGender = "male" | "female" | "unknown";

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

function getBirthYear(person: Person) {
  if (!person.birth_date) return null;

  const year = new Date(person.birth_date).getFullYear();
  return Number.isNaN(year) ? null : year;
}

function getHeadshotEra(person: Person) {
  const year = getBirthYear(person);

  if (!year || year > 1979) return "1980";
  if (year >= 1950) return "1950";
  if (year >= 1920) return "1920";
  if (year >= 1900) return "1900";
  if (year >= 1800) return "1800";
  if (year >= 1700) return "1700";
  if (year >= 1600) return "1600";
  if (year >= 1500) return "1500";
  return "1400";
}

function inferGender(relationship?: Relationship): InferredGender {
  if (!relationship) return "unknown";

  if (relationship.relationship_type === "father") return "male";
  if (relationship.relationship_type === "mother") return "female";

  return "unknown";
}

function getDefaultHeadshot(person: Person, relationship?: Relationship) {
  const gender = inferGender(relationship);
  const genderPrefix = gender === "female" ? "f" : "m";

  return `/images/tree-headshots/${genderPrefix}-${getHeadshotEra(person)}.webp`;
}

function getGenderAccent(relationship?: Relationship) {
  const gender = inferGender(relationship);

  if (gender === "female") return "bg-coral";
  if (gender === "male") return "bg-sky";

  return "bg-teal";
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
    relationship,
    size = "large",
  }: {
    person: Person;
    relationship?: Relationship;
    size?: "small" | "large";
  }) {
    const sizeClasses = size === "large" ? "h-20 w-20" : "h-16 w-16";
    const imageSrc = person.profilePhotoUrl ?? getDefaultHeadshot(person, relationship);

    return (
      <div
        className={`mx-auto flex ${sizeClasses} items-center justify-center overflow-hidden rounded-full bg-night-sky/20 ring-2 ring-white/10`}
      >
        <Image
          src={imageSrc}
          alt={getPersonName(person)}
          width={80}
          height={80}
          className="h-full w-full object-cover"
          unoptimized={Boolean(person.profilePhotoUrl)}
          loading="lazy"
        />
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
        className={`relative flex h-56 w-52 flex-col items-center overflow-hidden rounded-lg border bg-[#2f2f2b] p-5 text-center shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:bg-[#373732] ${
          isSelected
            ? "border-sky/70 ring-2 ring-sky/30"
            : "border-white/10"
        }`}
      >
        <span
          className={`absolute inset-x-0 top-0 h-1 ${getGenderAccent(relationship)}`}
          aria-hidden="true"
        />

        <PersonAvatar person={person} relationship={relationship} />

        <div className="mt-4 flex min-h-12 w-full flex-col items-center justify-start">
          <h3 className="line-clamp-2 text-base font-semibold leading-5 text-white">
            {getPersonName(person)}
          </h3>

          <p className="mt-1 min-h-5 text-sm font-medium text-white/65">
            {relationship?.nickname ?? ""}
          </p>

          <p className="min-h-4 text-xs uppercase tracking-wide text-white/35">
            {relationship
              ? getRelationshipLabel(relationship.relationship_type)
              : ""}
          </p>
        </div>

        <div className="mt-auto w-full">
          <p
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              taggedMemoryCount > 0
                ? "bg-white/10 text-white/75"
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
          <div className="h-px w-72 bg-white/25" aria-hidden="true" />
        )}

        <div className="h-8 w-px bg-white/25" aria-hidden="true" />
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
            className="flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-[#242421] text-sm font-bold text-white/80 shadow-sm hover:bg-[#373732]"
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
            className="flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-[#242421] text-sm font-bold text-white/80 shadow-sm hover:bg-[#373732]"
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
                    key={relationship.id}
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
          <div className="mb-2 h-5 w-px bg-white/25" aria-hidden="true" />
        )}

        <PersonCard person={person} relationship={relationship} />
      </div>
    );
  }

  return (
    <>
      <div className="relative min-h-[calc(100vh-81px)] overflow-hidden bg-[#5f5c56] text-white lg:min-h-screen">
        <section
          ref={treeViewportRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`absolute inset-0 overflow-hidden bg-[#5f5c56] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0_1px,transparent_1px)] [background-size:28px_28px] ${
            isPanning ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          <div className="absolute left-4 top-4 z-20 max-w-sm rounded-lg border border-white/10 bg-[#242421]/90 px-4 py-3 shadow-xl shadow-black/20 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
              Family Tree
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white">
              Explore your family line
            </h1>
          </div>

          <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-lg border border-white/10 bg-[#242421]/90 p-2 shadow-xl shadow-black/20 backdrop-blur">
            <button
              type="button"
              onClick={zoomOut}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 text-sm font-bold text-white/85 hover:bg-white/10"
              aria-label="Zoom out"
            >
              −
            </button>

            <div className="min-w-14 text-center text-xs font-semibold text-white/70">
              {Math.round(zoom * 100)}%
            </div>

            <button
              type="button"
              onClick={zoomIn}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 text-sm font-bold text-white/85 hover:bg-white/10"
              aria-label="Zoom in"
            >
              +
            </button>

            <button
              type="button"
              onClick={resetView}
              className="rounded-md border border-white/15 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
            >
              Reset view
            </button>
          </div>

          <div className="pointer-events-none absolute bottom-4 left-4 z-20 rounded-md bg-[#242421]/90 px-3 py-2 text-xs text-white/60 shadow-sm">
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

        <aside className="absolute bottom-6 left-6 right-6 z-20 max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-[#242421]/95 p-5 shadow-2xl shadow-black/25 backdrop-blur xl:left-auto xl:top-24 xl:max-h-none xl:w-[380px] xl:p-6">
          {!selectedPerson ? (
            <div>
              <h2 className="text-xl font-semibold text-white">
                Person details
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/65">
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
  const avatarUrl = person.profilePhotoUrl ?? getDefaultHeadshot(person, relationship);

  return (
    <div>
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-2 ring-white/10">
          <Image
            src={avatarUrl}
            alt={name}
            width={64}
            height={64}
            className="h-full w-full object-cover"
            unoptimized={Boolean(person.profilePhotoUrl)}
            loading="lazy"
          />
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-white/45">
            {isRoot ? "You" : "Family member"}
          </p>

          <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">
            {name}
          </h2>

          {relationship?.nickname && (
            <p className="mt-1 text-sm font-medium text-white/70">
              Nickname: {relationship.nickname}
            </p>
          )}

          {relationship && (
            <p className="mt-1 text-sm text-white/55">
              Relationship: {getRelationshipLabel(relationship.relationship_type)}
            </p>
          )}
        </div>
      </div>

      <dl className="mt-6 space-y-4 text-sm">
        {birthDate && (
          <div>
            <dt className="font-medium text-white/45">Birthday</dt>
            <dd className="mt-1 text-white">{birthDate}</dd>
          </div>
        )}

        {deathDate && (
          <div>
            <dt className="font-medium text-white/45">Date of death</dt>
            <dd className="mt-1 text-white">{deathDate}</dd>
          </div>
        )}

        <div>
          <dt className="font-medium text-white/45">Living status</dt>
          <dd className="mt-1 text-white">
            {person.is_living ? "Living" : "Deceased"}
          </dd>
        </div>

        {location && (
          <div>
            <dt className="font-medium text-white/45">Location</dt>
            <dd className="mt-1 text-white">{location}</dd>
          </div>
        )}

        {person.bio && (
          <div>
            <dt className="font-medium text-white/45">About</dt>
            <dd className="mt-1 leading-6 text-white/80">{person.bio}</dd>
          </div>
        )}
      </dl>

      <div className="mt-8 border-t border-white/10 pt-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-white">
            Tagged memories
          </h3>

          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
            {taggedMemories.length}
          </span>
        </div>

        {taggedMemories.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-white/65">
            No journal entries have been tagged with this person yet.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {taggedMemories.map((memory) => (
              <article
                key={memory.id}
                className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="text-xs font-medium text-white/45">
                  {formatDate(memory.entry.created_at)}
                </p>

                <h4 className="mt-1 text-sm font-semibold text-white">
                  {memory.entry.title}
                </h4>

                <p className="mt-2 text-sm leading-6 text-white/65">
                  {getEntryPreview(memory.entry.body)}
                </p>

                {memory.entry.images.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {memory.entry.images.slice(0, 3).map((image) =>
                      image.signedUrl ? (
                        <Image
                          key={image.id}
                          src={image.signedUrl}
                          alt={image.file_name ?? "Tagged memory image"}
                          width={120}
                          height={80}
                          className="h-20 w-full rounded-lg object-cover"
                          unoptimized
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
