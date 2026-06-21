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

async function loadImage(file: File) {
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
