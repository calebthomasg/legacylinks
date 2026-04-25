"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type JournalEntryFormProps = {
  userId: string;
};

export default function JournalEntryForm({ userId }: JournalEntryFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    const { error } = await supabase.from("journal_entries").insert({
      user_id: userId,
      title,
      body,
    });

    if (error) {
      setMessage(error.message);
      setIsSaving(false);
      return;
    }

    setTitle("");
    setBody("");
    setMessage("Journal entry saved.");
    setIsSaving(false);

    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-900">
          Entry title
        </label>
        <input
          type="text"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-gray-900"
          placeholder="Example: A story I want my family to remember"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900">
          Journal entry
        </label>
        <textarea
          required
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={8}
          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 outline-none focus:border-gray-900"
          placeholder="Write a memory, lesson, story, or moment from your life..."
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
        {isSaving ? "Saving..." : "Save journal entry"}
      </button>
    </form>
  );
}