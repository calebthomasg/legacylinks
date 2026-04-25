"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

type ProfileFormProps = {
  userId: string;
  initialFirstName: string | null;
  initialLastName: string | null;
};

export default function ProfileForm({
  userId,
  initialFirstName,
  initialLastName,
}: ProfileFormProps) {
  const supabase = createClient();

  const [firstName, setFirstName] = useState(initialFirstName ?? "");
  const [lastName, setLastName] = useState(initialLastName ?? "");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setIsSaving(true);
  setMessage("");

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (profileError) {
    setMessage(profileError.message);
    setIsSaving(false);
    return;
  }

  const { error: authError } = await supabase.auth.updateUser({
    data: {
      first_name: firstName,
      last_name: lastName,
    },
  });

  if (authError) {
    setMessage(authError.message);
    setIsSaving(false);
    return;
  }

  setMessage("Profile updated.");
  setIsSaving(false);
}

  return (
    <form onSubmit={handleSave} className="mt-6 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-900">
            First name
          </label>
          <input
            type="text"
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