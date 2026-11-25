export const PROFILE_PHOTO_BUCKET = "person-photos";
export const PROFILE_THUMBNAIL_SIZE = 192;
export const PROFILE_THUMBNAIL_QUALITY = 80;

/** @param {string} originalPath */
export function profileThumbnailPath(originalPath) {
  return `${originalPath}.thumb-192.jpg`;
}
