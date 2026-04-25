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
  const [images, setImages] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    setImages(selectedFiles);
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    const {
      data: journalEntry,
      error: journalError,
    } = await supabase
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