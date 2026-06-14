"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type DeleteJournalEntryButtonProps = {
  entryId: string;
};

export default function DeleteJournalEntryButton({
  entryId,
}: DeleteJournalEntryButtonProps) {
  const router = useRouter();
  const supabase = createClient();

  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this journal entry? This cannot be undone."
    );

    if (!confirmed) return;

    setIsDeleting(true);
    setMessage("");

    const { data: images, error: imageQueryError } = await supabase
      .from("journal_entry_images")
      .select("storage_path")
      .eq("journal_entry_id", entryId);

    if (imageQueryError) {
      setMessage(imageQueryError.message);
      setIsDeleting(false);
      return;
    }

    const imagePaths = (images ?? []).map((image) => image.storage_path);

    if (imagePaths.length > 0) {
      const { error: storageDeleteError } = await supabase.storage
        .from("journal-images")
        .remove(imagePaths);

      if (storageDeleteError) {
        setMessage(storageDeleteError.message);
        setIsDeleting(false);
        return;
      }
    }

    const { error: deleteEntryError } = await supabase
      .from("journal_entries")
      .delete()
      .eq("id", entryId);

    if (deleteEntryError) {
      setMessage(deleteEntryError.message);
      setIsDeleting(false);
      return;
    }

    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="button-danger"
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </button>

      {message && <p className="mt-2 text-sm text-coral">{message}</p>}
    </div>
  );
}
