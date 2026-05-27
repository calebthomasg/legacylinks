"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type DeleteRelationshipButtonProps = {
  relationshipId: string;
};

export default function DeleteRelationshipButton({
  relationshipId,
}: DeleteRelationshipButtonProps) {
  const router = useRouter();
  const supabase = createClient();

  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this relationship?"
    );

    if (!confirmed) return;

    setIsDeleting(true);
    setMessage("");

    const { error } = await supabase
      .from("family_relationships")
      .delete()
      .eq("id", relationshipId);

    if (error) {
      setMessage(error.message);
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
        className="rounded-xl border border-coral/30 px-4 py-2 text-sm font-semibold text-coral hover:bg-coral/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </button>

      {message && <p className="mt-2 text-sm text-coral">{message}</p>}
    </div>
  );
}