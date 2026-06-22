import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AppShell from "@/components/layout/AppShell";
import ImageGallery from "@/components/gallery/ImageGallery";
import GalleryPageTransition from "@/components/gallery/GalleryPageTransition";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();

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
        entry_date,
        created_at
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Gallery image query error:", error.message);
  }

  const imageIds = (imageRows ?? []).map((image) => image.id);
  const { data: imageLikes, error: imageLikesError } =
    imageIds.length > 0
      ? await supabase
          .from("journal_image_likes")
          .select("image_id, user_id")
          .in("image_id", imageIds)
      : { data: [], error: null };

  if (imageLikesError) {
    console.error("Gallery image likes query error:", imageLikesError.message);
  }

  const { data: commentRows, error: commentsError } =
    imageIds.length > 0
      ? await supabase
          .from("journal_image_comments")
          .select("id, image_id, user_id, parent_comment_id, body, created_at")
          .in("image_id", imageIds)
          .order("created_at", { ascending: true })
      : { data: [], error: null };

  if (commentsError) {
    console.error("Gallery image comments query error:", commentsError.message);
  }

  const commentIds = (commentRows ?? []).map((comment) => comment.id);
  const commentAuthorIds = Array.from(
    new Set((commentRows ?? []).map((comment) => comment.user_id))
  );

  const { data: commentLikes, error: commentLikesError } =
    commentIds.length > 0
      ? await supabase
          .from("journal_image_comment_likes")
          .select("comment_id, user_id")
          .in("comment_id", commentIds)
      : { data: [], error: null };

  if (commentLikesError) {
    console.error(
      "Gallery image comment likes query error:",
      commentLikesError.message
    );
  }

  const { data: commentAuthors, error: commentAuthorsError } =
    commentAuthorIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", commentAuthorIds)
      : { data: [], error: null };

  if (commentAuthorsError) {
    console.error(
      "Gallery image comment authors query error:",
      commentAuthorsError.message
    );
  }

  const authorNamesById = new Map(
    (commentAuthors ?? []).map((author) => [
      author.id,
      [author.first_name, author.last_name].filter(Boolean).join(" ") ||
        "LegacyLinks user",
    ])
  );

  const imageLikesByImageId = new Map<string, Set<string>>();

  (imageLikes ?? []).forEach((like) => {
    if (!imageLikesByImageId.has(like.image_id)) {
      imageLikesByImageId.set(like.image_id, new Set());
    }

    imageLikesByImageId.get(like.image_id)?.add(like.user_id);
  });

  const commentLikesByCommentId = new Map<string, Set<string>>();

  (commentLikes ?? []).forEach((like) => {
    if (!commentLikesByCommentId.has(like.comment_id)) {
      commentLikesByCommentId.set(like.comment_id, new Set());
    }

    commentLikesByCommentId.get(like.comment_id)?.add(like.user_id);
  });

  const commentsByImageId = new Map<
    string,
    {
      id: string;
      imageId: string;
      userId: string;
      parentCommentId: string | null;
      body: string;
      createdAt: string;
      authorName: string;
      likeCount: number;
      isLikedByCurrentUser: boolean;
    }[]
  >();

  (commentRows ?? []).forEach((comment) => {
    const likeUserIds = commentLikesByCommentId.get(comment.id) ?? new Set();
    const comments = commentsByImageId.get(comment.image_id) ?? [];

    comments.push({
      id: comment.id,
      imageId: comment.image_id,
      userId: comment.user_id,
      parentCommentId: comment.parent_comment_id,
      body: comment.body,
      createdAt: comment.created_at,
      authorName: authorNamesById.get(comment.user_id) ?? "LegacyLinks user",
      likeCount: likeUserIds.size,
      isLikedByCurrentUser: likeUserIds.has(user.id),
    });

    commentsByImageId.set(comment.image_id, comments);
  });

  // 4. Create temporary signed URLs for each private image.
  const galleryImages = await Promise.all(
    (imageRows ?? []).map(async (image) => {
      const storage = supabase.storage.from("journal-images");
      const [fullImageResult, thumbnailResult] = await Promise.all([
        storage.createSignedUrl(image.storage_path, 60 * 60),
        storage.createSignedUrl(image.storage_path, 60 * 60, {
          transform: {
            width: 500,
            height: 500,
            resize: "cover",
            quality: 70,
          },
        }),
      ]);

      const entry = Array.isArray(image.journal_entries)
        ? image.journal_entries[0]
        : image.journal_entries;

      return {
        id: image.id,
        signedUrl: fullImageResult.data?.signedUrl ?? null,
        thumbnailUrl:
          thumbnailResult.data?.signedUrl ??
          fullImageResult.data?.signedUrl ??
          null,
        fileName: image.file_name,
        dateAdded: image.created_at,
        entryId: entry?.id ?? null,
        entryTitle: entry?.title ?? "Untitled journal entry",
        entryCreatedAt: entry?.entry_date ?? entry?.created_at ?? null,
        likeCount: imageLikesByImageId.get(image.id)?.size ?? 0,
        isLikedByCurrentUser:
          imageLikesByImageId.get(image.id)?.has(user.id) ?? false,
        comments: commentsByImageId.get(image.id) ?? [],
      };
    })
  );

  const currentUserName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user.email ||
    "You";

  return (
    <AppShell active="gallery" userEmail={user.email}>
      <GalleryPageTransition />

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-night-sky/60">
              Gallery
            </p>

            <h1 className="mt-2 text-4xl font-bold tracking-tight text-night-sky">
              Your journal images
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-night-sky/70">
              View all pictures you have added to your journal entries,
              organized by the date they were uploaded.
            </p>
          </div>
        </div>

        <div className="mt-10">
          <ImageGallery
            images={galleryImages}
            currentUserId={user.id}
            currentUserName={currentUserName}
          />
        </div>
      </section>
    </AppShell>
  );
}
