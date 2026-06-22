"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type GalleryComment = {
  id: string;
  imageId: string;
  userId: string;
  parentCommentId: string | null;
  body: string;
  createdAt: string;
  authorName: string;
  likeCount: number;
  isLikedByCurrentUser: boolean;
};

type GalleryImage = {
  id: string;
  signedUrl: string | null;
  thumbnailUrl: string | null;
  fileName: string | null;
  dateAdded: string;
  entryId: string | null;
  entryTitle: string;
  entryCreatedAt: string | null;
  likeCount: number;
  isLikedByCurrentUser: boolean;
  comments: GalleryComment[];
};

type ImageGalleryProps = {
  images: GalleryImage[];
  currentUserId: string;
  currentUserName: string;
};

type GalleryGroupMode = "all" | "entry" | "month";

type GalleryGroup = {
  id: string;
  title: string;
  description: string;
  images: GalleryImage[];
};

const groupOptions: { value: GalleryGroupMode; label: string }[] = [
  { value: "all", label: "All images" },
  { value: "entry", label: "Journal entry" },
  { value: "month", label: "Month added" },
];

function HeartIcon({ isFilled }: { isFilled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill={isFilled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

function EllipsisIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

export default function ImageGallery({
  images,
  currentUserId,
  currentUserName,
}: ImageGalleryProps) {
  const supabase = createClient();
  const [galleryImages, setGalleryImages] = useState(images);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [groupMode, setGroupMode] = useState<GalleryGroupMode>("all");
  const [commentText, setCommentText] = useState("");
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(
    null
  );
  const [hiddenCommentIds, setHiddenCommentIds] = useState<string[]>([]);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [socialMessage, setSocialMessage] = useState("");

  const selectedImage =
    galleryImages.find((image) => image.id === selectedImageId) ?? null;

  function formatDate(dateString: string | null) {
    if (!dateString) return "Unknown date";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) return "Unknown date";

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatMonth(dateString: string | null) {
    if (!dateString) return "Unknown month";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) return "Unknown month";

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
    });
  }

  function getImageCountLabel(count: number) {
    return `${count} image${count === 1 ? "" : "s"}`;
  }

  const groups = useMemo(() => {
    if (groupMode === "all") {
      return [
        {
          id: "all",
          title: "All images",
          description: getImageCountLabel(galleryImages.length),
          images: galleryImages,
        },
      ];
    }

    const groupedImages = new Map<string, GalleryGroup>();

    galleryImages.forEach((image) => {
      const groupId =
        groupMode === "entry"
          ? image.entryId ?? image.entryTitle
          : formatMonth(image.dateAdded);
      const title =
        groupMode === "entry" ? image.entryTitle : formatMonth(image.dateAdded);
      const description =
        groupMode === "entry"
          ? `Entry date ${formatDate(image.entryCreatedAt)}`
          : "Grouped by upload month";

      if (!groupedImages.has(groupId)) {
        groupedImages.set(groupId, {
          id: groupId,
          title,
          description,
          images: [],
        });
      }

      groupedImages.get(groupId)?.images.push(image);
    });

    return Array.from(groupedImages.values()).map((group) => ({
      ...group,
      description: `${getImageCountLabel(group.images.length)} · ${
        group.description
      }`,
    }));
  }, [galleryImages, groupMode]);

  function updateImage(
    imageId: string,
    updater: (image: GalleryImage) => GalleryImage
  ) {
    setGalleryImages((currentImages) =>
      currentImages.map((image) =>
        image.id === imageId ? updater(image) : image
      )
    );
  }

  async function toggleImageLike(image: GalleryImage) {
    setSocialMessage("");

    updateImage(image.id, (currentImage) => ({
      ...currentImage,
      isLikedByCurrentUser: !currentImage.isLikedByCurrentUser,
      likeCount: currentImage.isLikedByCurrentUser
        ? Math.max(0, currentImage.likeCount - 1)
        : currentImage.likeCount + 1,
    }));

    const { error } = image.isLikedByCurrentUser
      ? await supabase
          .from("journal_image_likes")
          .delete()
          .eq("image_id", image.id)
          .eq("user_id", currentUserId)
      : await supabase.from("journal_image_likes").insert({
          image_id: image.id,
          user_id: currentUserId,
        });

    if (error) {
      updateImage(image.id, () => image);
      console.error("Photo like error:", error);
      setSocialMessage(
        `Could not update photo like: ${error.message}`
      );
    }
  }

  async function submitComment(parentCommentId: string | null = null) {
    if (!selectedImage) return;

    const body = parentCommentId
      ? replyTexts[parentCommentId]?.trim()
      : commentText.trim();

    if (!body) return;

    setIsSavingComment(true);
    setSocialMessage("");

    const { data, error } = await supabase
      .from("journal_image_comments")
      .insert({
        image_id: selectedImage.id,
        user_id: currentUserId,
        parent_comment_id: parentCommentId,
        body,
      })
      .select("id, image_id, user_id, parent_comment_id, body, created_at")
      .single();

    if (error || !data) {
      console.error("Photo comment error:", error);
      setSocialMessage(
        `Could not save comment: ${
          error?.message ?? "No comment was returned."
        }`
      );
      setIsSavingComment(false);
      return;
    }

    const newComment: GalleryComment = {
      id: data.id,
      imageId: data.image_id,
      userId: data.user_id,
      parentCommentId: data.parent_comment_id,
      body: data.body,
      createdAt: data.created_at,
      authorName: currentUserName,
      likeCount: 0,
      isLikedByCurrentUser: false,
    };

    updateImage(selectedImage.id, (image) => ({
      ...image,
      comments: [...image.comments, newComment],
    }));

    if (parentCommentId) {
      setReplyTexts((currentTexts) => ({
        ...currentTexts,
        [parentCommentId]: "",
      }));
      setActiveReplyId(null);
    } else {
      setCommentText("");
    }

    setIsSavingComment(false);
  }

  async function toggleCommentLike(comment: GalleryComment) {
    if (!selectedImage) return;

    setSocialMessage("");

    updateImage(selectedImage.id, (image) => ({
      ...image,
      comments: image.comments.map((currentComment) =>
        currentComment.id === comment.id
          ? {
              ...currentComment,
              isLikedByCurrentUser: !currentComment.isLikedByCurrentUser,
              likeCount: currentComment.isLikedByCurrentUser
                ? Math.max(0, currentComment.likeCount - 1)
                : currentComment.likeCount + 1,
            }
          : currentComment
      ),
    }));

    const { error } = comment.isLikedByCurrentUser
      ? await supabase
          .from("journal_image_comment_likes")
          .delete()
          .eq("comment_id", comment.id)
          .eq("user_id", currentUserId)
      : await supabase.from("journal_image_comment_likes").insert({
          comment_id: comment.id,
          user_id: currentUserId,
        });

    if (error) {
      updateImage(selectedImage.id, (image) => ({
        ...image,
        comments: image.comments.map((currentComment) =>
          currentComment.id === comment.id ? comment : currentComment
        ),
      }));
      console.error("Photo comment like error:", error);
      setSocialMessage(
        `Could not update comment like: ${error.message}`
      );
    }
  }

  function removeCommentFromImage(
    image: GalleryImage,
    commentId: string
  ): GalleryImage {
    const commentIdsToRemove = new Set([commentId]);
    let foundNewComment = true;

    while (foundNewComment) {
      foundNewComment = false;

      image.comments.forEach((comment) => {
        if (
          comment.parentCommentId &&
          commentIdsToRemove.has(comment.parentCommentId) &&
          !commentIdsToRemove.has(comment.id)
        ) {
          commentIdsToRemove.add(comment.id);
          foundNewComment = true;
        }
      });
    }

    return {
      ...image,
      comments: image.comments.filter(
        (comment) => !commentIdsToRemove.has(comment.id)
      ),
    };
  }

  function hideComment(comment: GalleryComment) {
    setHiddenCommentIds((currentIds) =>
      currentIds.includes(comment.id) ? currentIds : [...currentIds, comment.id]
    );
    setOpenCommentMenuId(null);
    setSocialMessage("Comment hidden from this view.");
  }

  async function deleteComment(comment: GalleryComment) {
    if (!selectedImage) return;

    const previousImage = selectedImage;

    setOpenCommentMenuId(null);
    setSocialMessage("");
    updateImage(selectedImage.id, (image) =>
      removeCommentFromImage(image, comment.id)
    );

    const { error } = await supabase
      .from("journal_image_comments")
      .delete()
      .eq("id", comment.id)
      .eq("user_id", currentUserId);

    if (error) {
      updateImage(selectedImage.id, () => previousImage);
      console.error("Photo comment delete error:", error);
      setSocialMessage(`Could not delete comment: ${error.message}`);
    }
  }

  function getCommentThreads(comments: GalleryComment[]) {
    const visibleComments = comments.filter(
      (comment) => !hiddenCommentIds.includes(comment.id)
    );

    return visibleComments
      .filter((comment) => !comment.parentCommentId)
      .map((comment) => ({
        comment,
        replies: visibleComments.filter(
          (reply) => reply.parentCommentId === comment.id
        ),
      }));
  }

  function renderImageCard(image: GalleryImage) {
    return (
      <button
        key={image.id}
        type="button"
        onClick={() => {
          setSelectedImageId(image.id);
          setSocialMessage("");
        }}
        className="overflow-hidden rounded-xl border border-night-sky/10 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="aspect-square bg-sand">
          {image.thumbnailUrl ? (
            <img
              src={image.thumbnailUrl}
              alt={image.fileName ?? "Journal image"}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-night-sky/60">
              Image unavailable
            </div>
          )}
        </div>

        <div className="p-2.5 min-[575px]:p-3">
          <p className="line-clamp-2 text-[0.7rem] font-semibold leading-snug text-night-sky min-[575px]:text-xs">
            {image.entryTitle}
          </p>

          <div className="mt-1 flex items-center gap-2 text-[0.65rem] leading-snug text-night-sky/60 min-[575px]:text-[0.7rem]">
            <span>Added {formatDate(image.dateAdded)}</span>
            <span className="inline-flex items-center gap-0.5 text-coral">
              <HeartIcon isFilled={image.isLikedByCurrentUser} />
              {image.likeCount}
            </span>
          </div>

          <p className="mt-0.5 text-[0.65rem] leading-snug text-night-sky/60 min-[575px]:text-[0.7rem]">
            {image.comments.length} comment
            {image.comments.length === 1 ? "" : "s"}
          </p>
        </div>
      </button>
    );
  }

  function renderComment(comment: GalleryComment, isReply = false) {
    const canDeleteComment = comment.userId === currentUserId;

    return (
      <div
        key={comment.id}
        className={`group/comment relative mr-10 rounded-xl border border-night-sky/10 bg-white p-3 ${
          isReply ? "ml-5" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-night-sky">
              {comment.authorName}
            </p>
            <p className="text-xs text-night-sky/45">
              {formatDate(comment.createdAt)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => toggleCommentLike(comment)}
            className={`mr-8 inline-flex items-center gap-1 text-xs font-semibold transition ${
              comment.isLikedByCurrentUser
                ? "text-coral"
                : "text-night-sky/45 hover:text-coral"
            }`}
          >
            <HeartIcon isFilled={comment.isLikedByCurrentUser} />
            {comment.likeCount}
          </button>
        </div>

        <div className="absolute -right-10 top-2">
          <button
            type="button"
            aria-label="Comment options"
            aria-expanded={openCommentMenuId === comment.id}
            onClick={() =>
              setOpenCommentMenuId((currentId) =>
                currentId === comment.id ? null : comment.id
              )
            }
            className={`flex h-7 w-7 items-center justify-center rounded-full border border-night-sky/10 bg-white text-lg leading-none text-night-sky/55 shadow-sm transition hover:text-night-sky ${
              openCommentMenuId === comment.id
                ? "opacity-100"
                : "opacity-0 group-hover/comment:opacity-100 focus:opacity-100"
            }`}
          >
            <EllipsisIcon />
          </button>

          {openCommentMenuId === comment.id && (
            <div className="absolute right-0 top-8 z-10 w-32 overflow-hidden rounded-xl border border-night-sky/10 bg-white py-1 text-sm shadow-lg">
              <button
                type="button"
                onClick={() => hideComment(comment)}
                className="block w-full px-3 py-2 text-left text-night-sky/70 hover:bg-sand"
              >
                Hide
              </button>

              {canDeleteComment && (
                <button
                  type="button"
                  onClick={() => deleteComment(comment)}
                  className="block w-full px-3 py-2 text-left text-coral hover:bg-sand"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>

        <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-night-sky/75">
          {comment.body}
        </p>

        {!isReply && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() =>
                setActiveReplyId((currentId) =>
                  currentId === comment.id ? null : comment.id
                )
              }
              className="text-xs font-bold uppercase tracking-[0.12em] text-sky-depth"
            >
              Reply
            </button>

            {activeReplyId === comment.id && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={replyTexts[comment.id] ?? ""}
                  onChange={(event) =>
                    setReplyTexts((currentTexts) => ({
                      ...currentTexts,
                      [comment.id]: event.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="Write a reply..."
                  className="text-sm"
                />

                <button
                  type="button"
                  onClick={() => submitComment(comment.id)}
                  disabled={isSavingComment}
                  className="button-secondary px-3 py-2 text-xs"
                >
                  Post reply
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {galleryImages.length === 0 ? (
        <div className="rounded-2xl border border-night-sky/10 bg-white p-8 text-center shadow-sm">
          <h2 className="text-2xl font-semibold text-night-sky">
            No images yet
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-night-sky/70">
            Once you add pictures to your journal entries, they will appear here
            in your gallery.
          </p>
        </div>
      ) : (
        <div>
          <div className="mb-6 flex flex-wrap gap-2">
            {groupOptions.map((option) => {
              const isActive = option.value === groupMode;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setGroupMode(option.value)}
                  className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] transition ${
                    isActive
                      ? "border-sky bg-sky text-white shadow-sm"
                      : "border-night-sky/10 bg-white text-night-sky/65 hover:border-sky/60 hover:text-night-sky"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-9">
            {groups.map((group) => (
              <section key={group.id}>
                {groupMode !== "all" && (
                  <div className="mb-3">
                    <h2 className="text-lg font-semibold text-night-sky">
                      {group.title}
                    </h2>

                    <p className="mt-1 text-xs text-night-sky/60">
                      {group.description}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 min-[575px]:gap-4 min-[745px]:grid-cols-3 min-[910px]:grid-cols-5 min-[1075px]:grid-cols-6">
                  {group.images.map((image) => renderImageCard(image))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {selectedImage && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-night-sky/80 px-4 py-8">
          <div className="relative mx-auto grid w-full max-w-7xl gap-4 rounded-2xl bg-white p-4 shadow-2xl lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="min-w-0 pr-0">
              <div className="mb-3 flex justify-start">
                <button
                  type="button"
                  onClick={() => setSelectedImageId(null)}
                  className="button-secondary shadow-lg"
                >
                  Close
                </button>
              </div>

              <div className="overflow-hidden rounded-xl bg-sand">
                {selectedImage.signedUrl ? (
                  <img
                    src={selectedImage.signedUrl}
                    alt={selectedImage.fileName ?? "Journal image"}
                    className="max-h-[75vh] w-full object-contain"
                  />
                ) : (
                  <div className="flex h-96 items-center justify-center text-sm text-night-sky/60">
                    Image unavailable
                  </div>
                )}
              </div>

              <div className="mt-4">
                <h2 className="text-xl font-semibold text-night-sky">
                  {selectedImage.entryTitle}
                </h2>

                <p className="mt-1 text-sm text-night-sky/70">
                  Added {formatDate(selectedImage.dateAdded)}
                </p>

                <p className="mt-1 text-sm text-night-sky/70">
                  From entry dated {formatDate(selectedImage.entryCreatedAt)}
                </p>
              </div>
            </div>

            <aside className="rounded-2xl border border-night-sky/10 bg-sand/35 p-4 lg:max-h-[82vh] lg:overflow-y-auto">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-night-sky">
                    Photo comments
                  </h3>
                  <p className="mt-1 text-xs text-night-sky/55">
                    {selectedImage.comments.length} comment
                    {selectedImage.comments.length === 1 ? "" : "s"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => toggleImageLike(selectedImage)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold transition ${
                    selectedImage.isLikedByCurrentUser
                      ? "border-coral bg-coral text-white"
                      : "border-night-sky/10 bg-white text-night-sky/60 hover:text-coral"
                  }`}
                >
                  <HeartIcon isFilled={selectedImage.isLikedByCurrentUser} />
                  {selectedImage.likeCount}
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <textarea
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  rows={3}
                  placeholder="Write a comment..."
                  className="text-sm"
                />

                <button
                  type="button"
                  onClick={() => submitComment()}
                  disabled={isSavingComment || !commentText.trim()}
                  className="button-primary w-full"
                >
                  Post comment
                </button>
              </div>

              {socialMessage && (
                <p className="mt-4 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-night-sky/65">
                  {socialMessage}
                </p>
              )}

              <div className="mt-5 space-y-3">
                {selectedImage.comments.length === 0 ? (
                  <p className="rounded-xl bg-white px-4 py-6 text-center text-sm text-night-sky/55">
                    No comments yet. Add the first note for this photo.
                  </p>
                ) : (
                  getCommentThreads(selectedImage.comments).map(
                    ({ comment, replies }) => (
                      <div key={comment.id} className="space-y-2">
                        {renderComment(comment)}
                        {replies.map((reply) => renderComment(reply, true))}
                      </div>
                    )
                  )
                )}
              </div>
            </aside>
          </div>
        </div>
      )}
    </>
  );
}
