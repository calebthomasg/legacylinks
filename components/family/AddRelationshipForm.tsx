"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { RELATIONSHIP_TYPES } from "@/utils/relationshipTypes";

type PersonOption = {
  id: string;
  display_name: string | null;
  first_name: string;
  last_name: string | null;
};

type AddRelationshipFormProps = {
  userId: string;
  people: PersonOption[];
};

export default function AddRelationshipForm({
  userId,
  people,
}: AddRelationshipFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [personId, setPersonId] = useState("");
  const [relatedPersonId, setRelatedPersonId] = useState("");
  const [relationshipType, setRelationshipType] = useState("");
  const [nickname, setNickname] = useState("");

  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function getPersonName(person: PersonOption) {
    return (
      person.display_name ||
      [person.first_name, person.last_name].filter(Boolean).join(" ")
    );
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    if (personId === relatedPersonId) {
      setMessage("Please choose two different people.");
      setIsSaving(false);
      return;
    }

    const { error } = await supabase.from("family_relationships").insert({
      created_by_user_id: userId,
      person_id: personId,
      related_person_id: relatedPersonId,
      relationship_type: relationshipType,
      nickname: nickname || null,
    });

    if (error) {
      setMessage(error.message);
      setIsSaving(false);
      return;
    }

    setPersonId("");
    setRelatedPersonId("");
    setRelationshipType("");
    setNickname("");
    setMessage("Relationship added.");
    setIsSaving(false);

    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-900">
          Start with this person
        </label>

        <select
          required
          value={personId}
          onChange={(event) => setPersonId(event.target.value)}
          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900"
        >
          <option value="">Select a person</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {getPersonName(person)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900">
          Their family member is
        </label>

        <select
          required
          value={relatedPersonId}
          onChange={(event) => setRelatedPersonId(event.target.value)}
          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900"
        >
          <option value="">Select a family member</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {getPersonName(person)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900">
          Relationship
        </label>

        <select
          required
          value={relationshipType}
          onChange={(event) => setRelationshipType(event.target.value)}
          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900"
        >
          {RELATIONSHIP_TYPES.map((relationship) => (
            <option key={relationship.value} value={relationship.value}>
              {relationship.label}
            </option>
          ))}
        </select>

        <p className="mt-2 text-xs leading-5 text-gray-500">
          Example: If you choose yourself first, then choose Carlton, and select
          Father, LegacyLinks will know Carlton is your father.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900">
          Personal nickname
        </label>

        <input
          type="text"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900"
          placeholder="Dad, Mom, Nana, Pawpaw, etc."
        />

        <p className="mt-2 text-xs leading-5 text-gray-500">
          This is how this person appears to you. It does not change their
          actual profile name.
        </p>
      </div>

      {message && (
        <p className="rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-700">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={isSaving || people.length < 2}
        className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? "Adding..." : "Add relationship"}
      </button>

      {people.length < 2 && (
        <p className="text-sm text-gray-600">
          Add at least two people before creating a relationship.
        </p>
      )}
    </form>
  );
}