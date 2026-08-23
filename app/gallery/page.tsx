import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AppShell from "@/components/layout/AppShell";
import ImageGallery from "@/components/gallery/ImageGallery";
import TrailheadGallery from "@/components/gallery/TrailheadGallery";
import GalleryPageTransition from "@/components/gallery/GalleryPageTransition";
import { getProfileNavHref } from "@/utils/people/getProfileNavHref";

export default async function GalleryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profileHref = await getProfileNavHref(user.id);
  const { data: profile } = await supabase.from("profiles").select("first_name, last_name").eq("id", user.id).single();

  const { data: imageRows, error } = await supabase.from("journal_entry_images").select(`id, storage_path, file_name, created_at, journal_entries (id, title, entry_date, created_at)`).eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) console.error("Gallery image query error:", error.message);

  const imageIds = (imageRows ?? []).map((image) => image.id);
  const { data: imageLikes } = imageIds.length ? await supabase.from("journal_image_likes").select("image_id, user_id").in("image_id", imageIds) : { data: [] };
  const { data: commentRows } = imageIds.length ? await supabase.from("journal_image_comments").select("id, image_id, user_id, parent_comment_id, body, created_at").in("image_id", imageIds).order("created_at", { ascending: true }) : { data: [] };
  const commentIds = (commentRows ?? []).map((comment) => comment.id);
  const commentAuthorIds = Array.from(new Set((commentRows ?? []).map((comment) => comment.user_id)));
  const { data: commentLikes } = commentIds.length ? await supabase.from("journal_image_comment_likes").select("comment_id, user_id").in("comment_id", commentIds) : { data: [] };
  const { data: commentAuthors } = commentAuthorIds.length ? await supabase.from("profiles").select("id, first_name, last_name").in("id", commentAuthorIds) : { data: [] };

  const authorNamesById = new Map((commentAuthors ?? []).map((author) => [author.id, [author.first_name, author.last_name].filter(Boolean).join(" ") || "LegacyLinks user"]));
  const imageLikesByImageId = new Map<string, Set<string>>();
  (imageLikes ?? []).forEach((like) => { if (!imageLikesByImageId.has(like.image_id)) imageLikesByImageId.set(like.image_id, new Set()); imageLikesByImageId.get(like.image_id)?.add(like.user_id); });
  const commentLikesByCommentId = new Map<string, Set<string>>();
  (commentLikes ?? []).forEach((like) => { if (!commentLikesByCommentId.has(like.comment_id)) commentLikesByCommentId.set(like.comment_id, new Set()); commentLikesByCommentId.get(like.comment_id)?.add(like.user_id); });
  const commentsByImageId = new Map<string, { id:string; imageId:string; userId:string; parentCommentId:string|null; body:string; createdAt:string; authorName:string; likeCount:number; isLikedByCurrentUser:boolean }[]>();
  (commentRows ?? []).forEach((comment) => { const likes = commentLikesByCommentId.get(comment.id) ?? new Set(); const comments = commentsByImageId.get(comment.image_id) ?? []; comments.push({ id:comment.id, imageId:comment.image_id, userId:comment.user_id, parentCommentId:comment.parent_comment_id, body:comment.body, createdAt:comment.created_at, authorName:authorNamesById.get(comment.user_id) ?? "LegacyLinks user", likeCount:likes.size, isLikedByCurrentUser:likes.has(user.id) }); commentsByImageId.set(comment.image_id, comments); });

  const galleryImages = await Promise.all((imageRows ?? []).map(async (image) => {
    const storage = supabase.storage.from("journal-images");
    const [full, thumb] = await Promise.all([storage.createSignedUrl(image.storage_path, 3600), storage.createSignedUrl(image.storage_path, 3600, { transform:{ width:500,height:500,resize:"cover",quality:70 } })]);
    const entry = Array.isArray(image.journal_entries) ? image.journal_entries[0] : image.journal_entries;
    return { id:image.id, signedUrl:full.data?.signedUrl ?? null, thumbnailUrl:thumb.data?.signedUrl ?? full.data?.signedUrl ?? null, fileName:image.file_name, dateAdded:image.created_at, entryId:entry?.id ?? null, entryTitle:entry?.title ?? "Untitled journal entry", entryCreatedAt:entry?.entry_date ?? entry?.created_at ?? null, likeCount:imageLikesByImageId.get(image.id)?.size ?? 0, isLikedByCurrentUser:imageLikesByImageId.get(image.id)?.has(user.id) ?? false, comments:commentsByImageId.get(image.id) ?? [] };
  }));

  const { data: trailRows, error: trailError } = await supabase.from("gallery_media").select("id, storage_bucket, storage_path, file_name, created_at, treasure_box_id, caches(title)").eq("user_id", user.id).eq("source_type", "trailhead_find").order("created_at", { ascending:false });
  if (trailError) console.error("Trailhead gallery query error:", trailError.message);

  const trailheadImages = await Promise.all((trailRows ?? []).map(async (image) => {
    const storage = supabase.storage.from(image.storage_bucket);
    const [full, thumb] = await Promise.all([storage.createSignedUrl(image.storage_path, 3600), storage.createSignedUrl(image.storage_path, 3600, { transform:{ width:500,height:500,resize:"cover",quality:70 } })]);
    const treasure = Array.isArray(image.caches) ? image.caches[0] : image.caches;
    return { id:image.id, signedUrl:full.data?.signedUrl ?? null, thumbnailUrl:thumb.data?.signedUrl ?? full.data?.signedUrl ?? null, fileName:image.file_name, dateAdded:image.created_at, treasureBoxId:image.treasure_box_id, treasureBoxTitle:treasure?.title ?? "Trailhead treasure box" };
  }));

  const currentUserName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user.email || "You";

  return <AppShell active="gallery" userEmail={user.email} profileHref={profileHref}>
    <GalleryPageTransition />
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div><p className="text-sm font-semibold uppercase tracking-wide text-night-sky/60">Gallery</p><h1 className="mt-2 text-4xl font-bold tracking-tight text-night-sky">Your photos</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-night-sky/70">The pictures you collect across LegacyLink, from journal entries to the adventures you find on Trailhead.</p></div>
      <div className="mt-10"><TrailheadGallery images={trailheadImages} /><ImageGallery images={galleryImages} currentUserId={user.id} currentUserName={currentUserName} /></div>
    </section>
  </AppShell>;
}
