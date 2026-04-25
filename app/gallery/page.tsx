import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import LogoutButton from "@/components/auth/LogoutButton";
import ImageGallery from "@/components/gallery/ImageGallery";

export default async function GalleryPage() {
  const supabase = await createClient();

  // 1. Check whether the user is logged in.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. If no user is logged in, send them to login.
  if (!user) {
    redirect("/login");
  }

  // 3. Get the user's image records and the journal entry each image belongs to.
  const { data: imageRows, error } = await supabase
    .from("journal_entry_images")
    .select(`
      id,
      storage_path,
      file_name,
      created_at,
      journal_entries (
        id,
        title,
        created_at
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Gallery image query error:", error.message);
  }

  // 4. Create temporary signed URLs for each private image.
  const galleryImages = await Promise.all(
    (imageRows ?? []).map(async (image) => {
      const { data } = await supabase.storage
        .from("journal-images")
        .createSignedUrl(image.storage_path, 60 * 60);

      const entry = Array.isArray(image.journal_entries)
        ? image.journal_entries[0]
        : image.journal_entries;

      return {
        id: image.id,
        signedUrl: data?.signedUrl ?? null,
        fileName: image.file_name,
        dateAdded: image.created_at,
        entryTitle: entry?.title ?? "Untitled journal entry",
        entryCreatedAt: entry?.created_at ?? null,
      };
    })
  );

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <section className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Gallery
            </p>

            <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-950">
              Your journal images
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              View all pictures you have added to your journal entries,
              organized by the date they were uploaded.
            </p>
          </div>

          <LogoutButton />
        </div>

        <div className="mt-6 flex gap-4">
          <Link
            href="/dashboard"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            Back to dashboard
          </Link>

          <Link
            href="/profile"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            View profile
          </Link>
        </div>

        <div className="mt-10">
          <ImageGallery images={galleryImages} />
        </div>
      </section>
    </main>
  );
}