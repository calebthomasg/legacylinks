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
  birth_date: string | null;
  death_date: string | null;
  is_living: boolean | null;
  city: string | null;
  state: string | null;
  bio: string | null;
};

type EditPersonFormProps = {
  person: Person;
};

export default function EditPersonForm({ person }: EditPersonFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [firstName, setFirstName] = useState(person.first_name ?? "");
  const [lastName, setLastName] = useState(person.last_name ?? "");
  const [birthDate, setBirthDate] = useState(person.birth_date ?? "");
  const [deathDate, setDeathDate] = useState(person.death_date ?? "");
  const [isLiving, setIsLiving] = useState(person.is_living ?? true);
  const [city, setCity] = useState(person.city ?? "");
  const [stateValue, setStateValue] = useState(person.state ?? "");
  const [bio, setBio] = useState(person.bio ?? "");

  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    const displayName = [firstName, lastName].filter(Boolean).join(" ");

    const { error } = await supabase
      .from("people")
      .update({
        first_name: firstName,
        last_name: lastName || null,
        display_name: displayName || firstName,
        birth_date: birthDate || null,
        death_date: isLiving ? null : deathDate || null,
        is_living: isLiving,
        city: city || null,
        state: stateValue || null,
        bio: bio || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", person.id);

    if (error) {
      setMessage(error.message);
      setIsSaving(false);
      return;
    }

    setMessage("Person updated.");
    setIsSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-900">
            First name
          </label>
          <input
            type="text"
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900"
            placeholder="First name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900">
            Last name
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900"
            placeholder="Last name"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-900">
            Birthday
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900">
            Living status
          </label>
          <select
            value={isLiving ? "living" : "deceased"}
            onChange={(event) => setIsLiving(event.target.value === "living")}
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900"
          >
            <option value="living">Living</option>
            <option value="deceased">Deceased</option>
          </select>
        </div>
      </div>

      {!isLiving && (
        <div>
          <label className="block text-sm font-medium text-gray-900">
            Date of death
          </label>
          <input
            type="date"
            value={deathDate}
            onChange={(event) => setDeathDate(event.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900"
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-900">
            City
          </label>
          <input
            type="text"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900"
            placeholder="City"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900">
            State
          </label>
          <select
            value={stateValue}
            onChange={(event) => setStateValue(event.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900"
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
        <label className="block text-sm font-medium text-gray-900">
          About this person
        </label>
        <textarea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          rows={6}
          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 outline-none focus:border-gray-900"
          placeholder="Add a short note, memory, or description..."
        />
      </div>

      {message && (
        <p className="rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-700">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={isSaving}
        className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}