import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import {
  PROFILE_PHOTO_BUCKET,
  PROFILE_THUMBNAIL_QUALITY,
  PROFILE_THUMBNAIL_SIZE,
  profileThumbnailPath,
} from "../utils/images/profileThumbnail.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const apply = process.argv.includes("--apply");

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and a server-side Supabase key for the target project.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const bucket = supabase.storage.from(PROFILE_PHOTO_BUCKET);
const pageSize = 500;

async function selectedPaths(table, pathColumn, ownerColumn) {
  const paths = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from(table)
      .select(`id,${pathColumn},${ownerColumn}`).not(pathColumn, "is", null)
      .order("id").range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Could not list ${table}: ${error.message}`);

    for (const row of data) {
      const path = row[pathColumn];
      const owner = row[ownerColumn];
      if (typeof path === "string" && typeof owner === "string" && path.startsWith(`${owner}/`)) paths.push(path);
    }
    if (data.length < pageSize) return paths;
  }
}

const paths = new Set([
  ...await selectedPaths("people", "profile_photo_path", "created_by_user_id"),
  ...await selectedPaths("person_profile_photos", "storage_path", "uploaded_by_user_id"),
]);
const summary = { target: new URL(url).hostname, checked: paths.size, alreadyExists: 0, missing: 0, created: 0, failed: 0 };

for (const path of paths) {
  try {
    const thumbnailPath = profileThumbnailPath(path);
    const { data: exists, error: lookupError } = await bucket.exists(thumbnailPath);
    if (exists) {
      summary.alreadyExists++;
      continue;
    }
    if (exists !== false) throw lookupError ?? new Error("Could not check thumbnail");

    summary.missing++;
    if (!apply) continue;

    const { data: source, error: downloadError } = await bucket.download(path);
    if (downloadError) throw downloadError;
    const thumbnail = await sharp(Buffer.from(await source.arrayBuffer()), { limitInputPixels: 64_000_000 })
      .autoOrient()
      .resize(PROFILE_THUMBNAIL_SIZE, PROFILE_THUMBNAIL_SIZE, { fit: "cover" })
      .flatten({ background: "#fff" })
      .jpeg({ quality: PROFILE_THUMBNAIL_QUALITY, mozjpeg: true })
      .toBuffer();

    const { error: uploadError } = await bucket.upload(thumbnailPath, thumbnail, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: false,
    });
    if (!uploadError) summary.created++;
    else if ((await bucket.exists(thumbnailPath)).data === true) summary.alreadyExists++;
    else throw uploadError;
  } catch (error) {
    summary.failed++;
    console.error(`Photo ${path.split("/").pop()}: ${error instanceof Error ? error.message : "thumbnail failed"}`);
  }
}

console.log(summary);
if (summary.failed) process.exitCode = 1;
