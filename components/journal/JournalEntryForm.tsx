"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  getJournalImageStoragePath,
  MAX_JOURNAL_ENTRY_IMAGES,
  optimizeJournalImage,
} from "@/utils/images/client";

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
    if (selectedFiles.length > MAX_JOURNAL_ENTRY_IMAGES) {
      setMessage(`You can add up to ${MAX_JOURNAL_ENTRY_IMAGES} photos per entry.`);
    } else {
      setMessage("");
    }

    setImages(selectedFiles.slice(0, MAX_JOURNAL_ENTRY_IMAGES));
    event.target.value = "";
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

    try {
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
          return;
        }
      }

      // 3. Upload images, if any were selected.
      if (images.length > 0) {
        setMessage(`Optimizing ${images.length} photo${images.length === 1 ? "" : "s"}...`);

        const imageRows = [];

        for (let index = 0; index < images.length; index += 1) {
          const originalImage = images[index];
          const uploadImage = await optimizeJournalImage(originalImage);
          const storagePath = getJournalImageStoragePath(
            userId,
            journalEntry.id,
            uploadImage
          );

          setMessage(`Uploading photo ${index + 1} of ${images.length}...`);

          const { error: uploadError } = await supabase.storage
            .from("journal-images")
            .upload(storagePath, uploadImage, {
              cacheControl: "31536000",
              contentType: uploadImage.type || originalImage.type,
              upsert: false,
            });

          if (uploadError) {
            setMessage(
              `Photo ${index + 1} could not upload: ${uploadError.message}`
            );
            return;
          }

          imageRows.push({
            journal_entry_id: journalEntry.id,
            user_id: userId,
            storage_path: storagePath,
            file_name: originalImage.name,
          });
        }

        const { error: imageRecordError } = await supabase
          .from("journal_entry_images")
          .insert(imageRows);

        if (imageRecordError) {
          setMessage(imageRecordError.message);
          return;
        }
      }

      setTitle("");
      setBody("");
      setImages([]);
      setSelectedPersonIds([]);
      setMessage("Journal entry saved.");

      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while saving this journal entry."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-night-sky">
          Entry title
        </label>
        <input
          type="text"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm outline-none focus:border-night-sky"
          placeholder="Example: A story I want my family to remember"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-night-sky">
          Journal entry
        </label>
        <textarea
          required
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={8}
          className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm leading-6 outline-none focus:border-night-sky"
          placeholder="Write a memory, lesson, story, or moment from your life..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-night-sky">
          Who is this memory about?
        </label>

        {people.length === 0 ? (
          <p className="mt-2 rounded-xl bg-sand px-4 py-3 text-sm text-night-sky/70">
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
                      ? "border-night-sky bg-night-sky text-white"
                      : "border-night-sky/20 bg-white text-night-sky hover:bg-sand"
                  }`}
                >
                  {getPersonName(person)}
                </button>
              );
            })}
          </div>
        )}

        {selectedPersonIds.length > 0 && (
          <p className="mt-2 text-sm text-night-sky/70">
            {selectedPersonIds.length} person
            {selectedPersonIds.length === 1 ? "" : "s"} tagged.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-night-sky">
          Add pictures
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageChange}
          className="mt-2 block w-full text-sm text-night-sky/75 file:mr-4 file:rounded-xl file:border-0 file:bg-night-sky file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />

        {images.length > 0 && (
          <p className="mt-2 text-sm text-night-sky/70">
            {images.length} image{images.length === 1 ? "" : "s"} selected.
          </p>
        )}

        <p className="mt-2 text-xs text-night-sky/45">
          Add up to {MAX_JOURNAL_ENTRY_IMAGES} photos. Large images are
          optimized before upload.
        </p>
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
        {isSaving ? "Saving..." : "Save journal entry"}
      </button>
    </form>
  );
}
