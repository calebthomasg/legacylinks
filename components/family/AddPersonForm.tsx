"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { US_STATES } from "@/utils/usStates";

type AddPersonFormProps = {
  userId: string;
};

export default function AddPersonForm({ userId }: AddPersonFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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

    const { error } = await supabase.from("people").insert({
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
    });

    if (error) {
      setMessage(error.message);
      setIsSaving(false);
      return;
    }

    setFirstName("");
    setLastName("");
    setBirthDate("");
    setDeathDate("");
    setIsLiving(true);
    setCity("");
    setStateValue("");
    setBio("");
    setMessage("Person added.");
    setIsSaving(false);

    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
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
            className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm outline-none focus:border-night-sky"
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
            className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm outline-none focus:border-night-sky"
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
            className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm outline-none focus:border-night-sky"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-night-sky">
            Living status
          </label>
          <select
            value={isLiving ? "living" : "deceased"}
            onChange={(event) => setIsLiving(event.target.value === "living")}
            className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm outline-none focus:border-night-sky"
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
            className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm outline-none focus:border-night-sky"
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
            className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm outline-none focus:border-night-sky"
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
        className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm outline-none focus:border-night-sky"
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
          className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm leading-6 outline-none focus:border-night-sky"
          placeholder="Add a short note, memory, or description..."
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
        {isSaving ? "Adding..." : "Add person"}
      </button>
    </form>
  );
}