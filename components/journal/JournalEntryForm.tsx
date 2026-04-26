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

type JournalEntryFormProps = {
  userId: string;
  people: PersonOption[];
};

function getPersonName(person: PersonOption) {
  return (
    person.display_name ||
    [person.first_name, person.last_name].filter(Boolean).join(" ")
  );
}

export default function JournalEntryForm({
  userId,
  people,
}: JournalEntryFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);

  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    setImages(selectedFiles);
  }

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

    // 1. Save the journal entry first.
    const { data: journalEntry, error: journalError } = await supabase
      .from("journal_entries")
      .insert({
        user_id: userId,
        title,
        body,
      })
      .select("id")
      .single();

    if (journalError || !journalEntry) {
      setMessage(journalError?.message ?? "Could not save journal entry.");
      setIsSaving(false);
      return;
    }

    // 2. Save people tags for this journal entry.
    if (selectedPersonIds.length > 0) {
      const tagRows = selectedPersonIds.map((personId) => ({
        journal_entry_id: journalEntry.id,
        person_id: personId,
        tagged_by_user_id: userId,
      }));

      const { error: tagError } = await supabase
        .from("journal_entry_people")
        .insert(tagRows);

      if (tagError) {
        setMessage(tagError.message);
        setIsSaving(false);
        return;
      }
    }

    // 3. Upload images, if any were selected.
    if (images.length > 0) {
      const imageRows = [];

      for (const image of images) {
        const fileExtension = image.name.split(".").pop();
        const safeFileName = `${crypto.randomUUID()}.${fileExtension}`;
        const storagePath = `${userId}/${journalEntry.id}/${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("journal-images")
          .upload(storagePath, image, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          setMessage(uploadError.message);
          setIsSaving(false);
          return;
        }

        imageRows.push({
          journal_entry_id: journalEntry.id,
          user_id: userId,
          storage_path: storagePath,
          file_name: image.name,
        });
      }

      const { error: imageRecordError } = await supabase
        .from("journal_entry_images")
        .insert(imageRows);

      if (imageRecordError) {
        setMessage(imageRecordError.message);
        setIsSaving(false);
        return;
      }
    }

    setTitle("");
    setBody("");
    setImages([]);
    setSelectedPersonIds([]);
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

      <div>
        <label className="block text-sm font-medium text-gray-900">
          Add pictures
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageChange}
          className="mt-2 block w-full text-sm text-gray-700 file:mr-4 file:rounded-xl file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />

        {images.length > 0 && (
          <p className="mt-2 text-sm text-gray-600">
            {images.length} image{images.length === 1 ? "" : "s"} selected.
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
        {isSaving ? "Saving..." : "Save journal entry"}
      </button>
    </form>
  );
}