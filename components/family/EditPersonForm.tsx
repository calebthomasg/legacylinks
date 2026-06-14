"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { US_STATES } from "@/utils/usStates";

type Person = {
  id: string;
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setPhotoFile(selectedFile);
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    let profilePhotoPath = person.profile_photo_path;

    if (photoFile) {
      const fileExtension = photoFile.name.split(".").pop();
      const safeFileName = `${crypto.randomUUID()}.${fileExtension}`;
      const storagePath = `${person.created_by_user_id}/${person.id}/${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("person-photos")
        .upload(storagePath, photoFile, {
          cacheControl: "31536000",
          upsert: false,
        });

      if (uploadError) {
        setMessage(uploadError.message);
        setIsSaving(false);
        return;
      }

      if (person.profile_photo_path) {
        await supabase.storage
          .from("person-photos")
          .remove([person.profile_photo_path]);
      }

      profilePhotoPath = storagePath;
    }

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
        profile_photo_path: profilePhotoPath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", person.id);

    if (error) {
      setMessage(error.message);
      setIsSaving(false);
      return;
    }

    setPhotoFile(null);
    setMessage("Person updated.");
    setIsSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-night-sky">
          Profile photo
        </label>

        <input
          type="file"
          accept="image/*"
          onChange={handlePhotoChange}
          className="mt-2 block w-full text-sm text-night-sky file:mr-4 file:rounded-xl file:border-0 file:bg-night-sky file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />

        {photoFile && (
          <p className="mt-2 text-sm text-night-sky/70">
            Selected: {photoFile.name}
          </p>
        )}
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
            onChange={(event) => setIsLiving(event.target.value === "living")}
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
          rows={6}
          className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm leading-6 text-night-sky placeholder:text-night-sky/40 outline-none focus:border-night-sky"
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
        className="button-primary"
      >
        {isSaving ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
