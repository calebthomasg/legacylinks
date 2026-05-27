"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { US_STATES } from "@/utils/usStates";

type Person = {
  id: string;
  first_name: string;
  last_name: string | null;
  display_name: string | null;
};

export type RelativeMode = "child" | "sibling" | "spouse";

type AddRelativeModalProps = {
  userId: string;
  anchorPerson: Person;
  mode: RelativeMode;
  onClose: () => void;
};

const relationshipOptions = {
  child: [
    { value: "son", label: "Son" },
    { value: "daughter", label: "Daughter" },
    { value: "child", label: "Child" },
  ],
  sibling: [
    { value: "brother", label: "Brother" },
    { value: "sister", label: "Sister" },
    { value: "sibling", label: "Sibling" },
  ],
  spouse: [
    { value: "husband", label: "Husband" },
    { value: "wife", label: "Wife" },
    { value: "spouse", label: "Spouse" },
  ],
};

function getPersonName(person: Person) {
  return (
    person.display_name ||
    [person.first_name, person.last_name].filter(Boolean).join(" ")
  );
}

function getModeCopy(mode: RelativeMode, name: string) {
  if (mode === "child") {
    return {
      eyebrow: "Add child",
      title: `Add child for ${name}`,
      help: "This creates a new person profile and connects them as this person's child.",
      relationshipLabel: `How is this child related to ${name}?`,
      placeholder: "Buddy, Sweet Pea, Junior, etc.",
      error: "Could not add child.",
    };
  }

  if (mode === "sibling") {
    return {
      eyebrow: "Add sibling",
      title: `Add sibling for ${name}`,
      help: "This creates a new person profile and connects them as this person's sibling.",
      relationshipLabel: `How is this sibling related to ${name}?`,
      placeholder: "Sis, Bubba, Big Brother, etc.",
      error: "Could not add sibling.",
    };
  }

  return {
    eyebrow: "Add spouse",
    title: `Add spouse for ${name}`,
    help: "This creates a new person profile and connects them as this person's spouse.",
    relationshipLabel: `How is this spouse related to ${name}?`,
    placeholder: "Honey, Love, Husband, Wife, etc.",
    error: "Could not add spouse.",
  };
}

export default function AddRelativeModal({
  userId,
  anchorPerson,
  mode,
  onClose,
}: AddRelativeModalProps) {
  const router = useRouter();
  const supabase = createClient();
  const name = getPersonName(anchorPerson);
  const copy = getModeCopy(mode, name);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [relationshipType, setRelationshipType] = useState(
    relationshipOptions[mode][0].value
  );
  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [deathDate, setDeathDate] = useState("");
  const [isLiving, setIsLiving] = useState(true);
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [bio, setBio] = useState("");

  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    const displayName = [firstName, lastName].filter(Boolean).join(" ");

    const { data: newPerson, error: personError } = await supabase
      .from("people")
      .insert({
        created_by_user_id: userId,
        first_name: firstName,
        last_name: lastName || null,
        display_name: displayName || firstName,
        birth_date: birthDate || null,
        death_date: isLiving ? null : deathDate || null,
        is_living: isLiving,
        city: city || null,
        state: stateValue || null,
        bio: bio || null,
      })
      .select("id")
      .single();

    if (personError || !newPerson) {
      setMessage(personError?.message ?? copy.error);
      setIsSaving(false);
      return;
    }

    const { error: relationshipError } = await supabase
      .from("family_relationships")
      .insert({
        created_by_user_id: userId,
        person_id: anchorPerson.id,
        related_person_id: newPerson.id,
        relationship_type: relationshipType,
        nickname: nickname || null,
      });

    if (relationshipError) {
      setMessage(relationshipError.message);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night-sky/70 px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-night-sky/60">
              {copy.eyebrow}
            </p>

            <h2 className="mt-2 text-2xl font-bold tracking-tight text-night-sky">
              {copy.title}
            </h2>

            <p className="mt-2 text-sm leading-6 text-night-sky/70">
              {copy.help}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-night-sky/20 px-4 py-2 text-sm font-semibold text-night-sky hover:bg-sand"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-night-sky">
              {copy.relationshipLabel}
            </label>

            <select
              value={relationshipType}
              onChange={(event) => setRelationshipType(event.target.value)}
              className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm text-night-sky outline-none focus:border-night-sky"
            >
              {relationshipOptions[mode].map((relationship) => (
                <option key={relationship.value} value={relationship.value}>
                  {relationship.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-night-sky">
                First name
              </label>

              <input
                type="text"
                required
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm text-night-sky outline-none focus:border-night-sky"
                placeholder="First name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-night-sky">
                Last name
              </label>

              <input
                type="text"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm text-night-sky outline-none focus:border-night-sky"
                placeholder="Last name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-night-sky">
              Nickname
            </label>

            <input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm text-night-sky outline-none focus:border-night-sky"
              placeholder={copy.placeholder}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-night-sky">
                Birthday
              </label>

              <input
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm text-night-sky outline-none focus:border-night-sky"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-night-sky">
                Living status
              </label>

              <select
                value={isLiving ? "living" : "deceased"}
                onChange={(event) =>
                  setIsLiving(event.target.value === "living")
                }
                className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm text-night-sky outline-none focus:border-night-sky"
              >
                <option value="living">Living</option>
                <option value="deceased">Deceased</option>
              </select>
            </div>
          </div>

          {!isLiving && (
            <div>
              <label className="block text-sm font-medium text-night-sky">
                Date of death
              </label>

              <input
                type="date"
                value={deathDate}
                onChange={(event) => setDeathDate(event.target.value)}
                className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm text-night-sky outline-none focus:border-night-sky"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-night-sky">
                City
              </label>

              <input
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm text-night-sky outline-none focus:border-night-sky"
                placeholder="City"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-night-sky">
                State
              </label>

              <select
                value={stateValue}
                onChange={(event) => setStateValue(event.target.value)}
                className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm text-night-sky outline-none focus:border-night-sky"
              >
                {US_STATES.map((state) => (
                  <option key={state.value} value={state.value}>
                    {state.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-night-sky">
              About this person
            </label>

            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm text-night-sky outline-none focus:border-night-sky"
              placeholder="A short note about this person"
            />
          </div>

          {message && (
            <p className="rounded-xl bg-sand px-4 py-3 text-sm text-night-sky/75">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-night-sky px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Adding..." : copy.eyebrow}
          </button>
        </form>
      </div>
    </div>
  );
}
