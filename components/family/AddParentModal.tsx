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

type AddParentModalProps = {
  userId: string;
  childPerson: Person;
  onClose: () => void;
};

function getPersonName(person: Person) {
  return (
    person.display_name ||
    [person.first_name, person.last_name].filter(Boolean).join(" ")
  );
}

export default function AddParentModal({
  userId,
  childPerson,
  onClose,
}: AddParentModalProps) {
  const router = useRouter();
  const supabase = createClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [relationshipType, setRelationshipType] = useState("father");
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

    const { data: newParent, error: personError } = await supabase
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

    if (personError || !newParent) {
      setMessage(personError?.message ?? "Could not add parent.");
      setIsSaving(false);
      return;
    }

    const { error: relationshipError } = await supabase
      .from("family_relationships")
      .insert({
        created_by_user_id: userId,
        person_id: childPerson.id,
        related_person_id: newParent.id,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night-sky/60 px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-night-sky/60">
              Add parent
            </p>

            <h2 className="mt-2 text-2xl font-bold tracking-tight text-night-sky">
              Add parent for {getPersonName(childPerson)}
            </h2>

            <p className="mt-2 text-sm leading-6 text-night-sky/70">
              This will create a new person profile and automatically connect
              them as a parent in the family tree.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="button-secondary"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-night-sky">
              How is this person related to {getPersonName(childPerson)}?
            </label>

            <select
              value={relationshipType}
              onChange={(event) => setRelationshipType(event.target.value)}
              className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm text-night-sky outline-none focus:border-night-sky"
            >
              <option value="father">Father</option>
              <option value="mother">Mother</option>
              <option value="parent">Parent</option>
            </select>

            <p className="mt-2 text-xs leading-5 text-night-sky/60">
              Use the direct relationship to this person. For example, if you
              are adding your grandmother above your mom, choose Mother because
              she is your mom’s mother.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-night-sky">
              Nickname
            </label>

            <input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm text-night-sky placeholder:text-night-sky/40 outline-none focus:border-night-sky"
              placeholder="Dad, Mom, Nana, Pawpaw, Grandma Bobbie, etc."
            />

            <p className="mt-2 text-xs leading-5 text-night-sky/60">
              This is optional. It controls how this person appears to you in
              the tree.
            </p>
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
                className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm text-night-sky placeholder:text-night-sky/40 outline-none focus:border-night-sky"
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
                className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm text-night-sky placeholder:text-night-sky/40 outline-none focus:border-night-sky"
                placeholder="Last name"
              />
            </div>
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
                className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm text-night-sky placeholder:text-night-sky/40 outline-none focus:border-night-sky"
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
              rows={5}
              className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm leading-6 text-night-sky placeholder:text-night-sky/40 outline-none focus:border-night-sky"
              placeholder="Add a short note, memory, or description..."
            />
          </div>

          {message && (
            <p className="rounded-xl bg-coral/10 px-4 py-3 text-sm text-coral">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="button-primary"
          >
            {isSaving ? "Adding parent..." : "Add parent"}
          </button>
        </form>
      </div>
    </div>
  );
}
