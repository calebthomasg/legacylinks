"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type DeletePersonButtonProps = {
  personId: string;
  isLinkedUser?: boolean;
};

export default function DeletePersonButton({
  personId,
  isLinkedUser = false,
}: DeletePersonButtonProps) {
  const router = useRouter();
  const supabase = createClient();

  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleDelete() {
    if (isLinkedUser) {
      setMessage("You cannot delete the person profile connected to your account.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this person profile? This may also remove relationships and tags connected to this person."
    );

    if (!confirmed) return;

    setIsDeleting(true);
    setMessage("");

    const { error } = await supabase.from("people").delete().eq("id", personId);

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
        disabled={isDeleting || isLinkedUser}
        className="button-danger"
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </button>

      {message && <p className="mt-2 text-sm text-coral">{message}</p>}
    </div>
  );
}
