"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type PersonOption = {
  id: string;
  first_name: string;
  last_name: string | null;
  display_name: string | null;
};

type EditJournalEntryFormProps = {
  entryId: string;
  initialTitle: string;
  initialBody: string;
  people: PersonOption[];
  initialTaggedPersonIds: string[];
};

function getPersonName(person: PersonOption) {
  return (
    person.display_name ||
    [person.first_name, person.last_name].filter(Boolean).join(" ")
  );
}

export default function EditJournalEntryForm({
  entryId,
  initialTitle,
  initialBody,
  people,
  initialTaggedPersonIds,
}: EditJournalEntryFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>(
    initialTaggedPersonIds
  );

  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function togglePerson(personId: string) {
    setSelectedPersonIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId]
    );
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    const { error: entryError } = await supabase
      .from("journal_entries")
      .update({
        title,
        body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entryId);

    if (entryError) {
      setMessage(entryError.message);
      setIsSaving(false);
      return;
    }

    const { error: deleteTagsError } = await supabase
      .from("journal_entry_people")
      .delete()
      .eq("journal_entry_id", entryId);

    if (deleteTagsError) {
      setMessage(deleteTagsError.message);
      setIsSaving(false);
      return;
    }

    if (selectedPersonIds.length > 0) {
      const tagRows = selectedPersonIds.map((personId) => ({
        journal_entry_id: entryId,
        person_id: personId,
        tagged_by_user_id: undefined,
      }));

      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("You must be logged in to update tags.");
        setIsSaving(false);
        return;
      }

      const finalTagRows = tagRows.map((row) => ({
        journal_entry_id: row.journal_entry_id,
        person_id: row.person_id,
        tagged_by_user_id: user.id,
      }));

      const { error: insertTagsError } = await supabase
        .from("journal_entry_people")
        .insert(finalTagRows);

      if (insertTagsError) {
        setMessage(insertTagsError.message);
        setIsSaving(false);
        return;
      }
    }

    setMessage("Journal entry updated.");
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
          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-950 placeholder:text-gray-400 outline-none focus:border-gray-900"
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
          rows={10}
          className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 text-gray-950 placeholder:text-gray-400 outline-none focus:border-gray-900"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900">
          Who is this memory about?
        </label>

        {people.length === 0 ? (
          <p className="mt-2 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Add people on your family page before tagging them in journal
            entries.
          </p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {people.map((person) => {
              const isSelected = selectedPersonIds.includes(person.id);

              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => togglePerson(person.id)}
                  className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                    isSelected
                      ? "border-gray-950 bg-gray-950 text-white"
                      : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {getPersonName(person)}
                </button>
              );
            })}
          </div>
        )}

        {selectedPersonIds.length > 0 && (
          <p className="mt-2 text-sm text-gray-600">
            {selectedPersonIds.length} person
            {selectedPersonIds.length === 1 ? "" : "s"} tagged.
          </p>
        )}
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