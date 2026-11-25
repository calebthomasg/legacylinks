import type { SupabaseClient } from "@supabase/supabase-js";
import { PROFILE_PHOTO_BUCKET, PROFILE_THUMBNAIL_QUALITY, PROFILE_THUMBNAIL_SIZE, profileThumbnailPath } from "./profileThumbnail.mjs";

export const MAX_JOURNAL_ENTRY_IMAGES = 10;

const MAX_IMAGE_DIMENSION = 2000;
const WEBP_QUALITY = 0.82;

function getBaseName(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "") || "image";
}

function getSafeBaseName(fileName: string) {
  return getBaseName(fileName)
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "image";
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function loadImage(file: Blob) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = document.createElement("img");
    image.decoding = "async";
    image.src = objectUrl;

    await image.decode();

    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function optimizeJournalImage(file: File) {
  if (
    !file.type.startsWith("image/") ||
    file.type === "image/gif" ||
    file.type === "image/svg+xml"
  ) {
    return file;
  }

  try {
    const image = await loadImage(file);
    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight)
    );

    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", {
      alpha: false,
    });

    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, width, height);

    const optimizedBlob = await canvasToBlob(
      canvas,
      "image/webp",
      WEBP_QUALITY
    );

    if (!optimizedBlob || optimizedBlob.size >= file.size) {
      return file;
    }

    return new File([optimizedBlob], `${getSafeBaseName(file.name)}.webp`, {
      type: optimizedBlob.type || "image/webp",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

export function getJournalImageStoragePath(
  userId: string,
  entryId: string,
  file: File
) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "webp";

  return `${userId}/${entryId}/${crypto.randomUUID()}-${getSafeBaseName(
    file.name
  )}.${extension}`;
}

async function saveProfileThumbnail(client: SupabaseClient, path: string, photo: Blob) {
  try {
    const image = await loadImage(photo);
    const size = PROFILE_THUMBNAIL_SIZE;
    const edge = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context || !edge) return;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, size, size);
    context.drawImage(
      image, (image.naturalWidth - edge) / 2, (image.naturalHeight - edge) / 2,
      edge, edge, 0, 0, size, size,
    );
    const thumbnail = await canvasToBlob(canvas, "image/jpeg", PROFILE_THUMBNAIL_QUALITY / 100);
    if (thumbnail?.type === "image/jpeg") {
      await client.storage.from(PROFILE_PHOTO_BUCKET).upload(profileThumbnailPath(path), thumbnail, {
        cacheControl: "31536000",
        contentType: "image/jpeg",
        upsert: false,
      });
    }
  } catch {
    // The full photo remains usable if this browser cannot make a thumbnail.
  }
}

export async function uploadProfilePhotoFiles(client: SupabaseClient, path: string, photo: File) {
  const result = await client.storage.from(PROFILE_PHOTO_BUCKET).upload(path, photo, {
    cacheControl: "31536000",
    contentType: photo.type || undefined,
    upsert: false,
  });
  if (!result.error) await saveProfileThumbnail(client, path, photo);
  return result;
}

export async function ensureProfileThumbnail(client: SupabaseClient, path: string) {
  try {
    const bucket = client.storage.from(PROFILE_PHOTO_BUCKET);
    const { data: exists } = await bucket.exists(profileThumbnailPath(path));
    if (exists !== false) return;
    const { data: photo } = await bucket.download(path);
    if (photo) await saveProfileThumbnail(client, path, photo);
  } catch {
    // Restoring a full-size photo still works if thumbnail generation fails.
  }
}

export function removeProfilePhotoFiles(client: SupabaseClient, path: string) {
  return client.storage.from(PROFILE_PHOTO_BUCKET).remove([path, profileThumbnailPath(path)]);
}
