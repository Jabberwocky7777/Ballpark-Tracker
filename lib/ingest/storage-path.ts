/**
 * Where an original and its derivatives live on disk.
 *
 * No path component ever comes from user input -- not the filename, not the
 * extension the uploader claimed -- so both functions validate their inputs and
 * return null rather than building a path they are unsure of. The two-level
 * fan-out keeps directory listings usable; a few thousand photos in one flat
 * directory is slow on ZFS and miserable to inspect by hand.
 *
 * Pure, and relative to a root, with forward slashes so a value written on one
 * platform still resolves on another.
 */

const SHA256 = /^[0-9a-f]{64}$/;
const SAFE_EXT = /^[a-z0-9]{2,5}$/;
const SAFE_ID = /^[0-9a-f]{8,64}$/;
const SAFE_KIND = /^[a-z][a-z0-9_]{0,15}$/;

/** `ab/cd/<sha256>.<ext>`. Null on any input that is not what it claims. */
export function originalRelativePath(sha256: string, ext: string): string | null {
  const hash = sha256.toLowerCase();
  const extension = ext.toLowerCase().replace(/^\./, "");
  if (!SHA256.test(hash) || !SAFE_EXT.test(extension)) return null;
  return `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}.${extension}`;
}

/** `ab/cd/<photoId>-<kind>.<ext>`. Derivatives are disposable and regenerable. */
export function derivativeRelativePath(photoId: string, kind: string, ext: string): string | null {
  const id = photoId.toLowerCase();
  const extension = ext.toLowerCase().replace(/^\./, "");
  if (!SAFE_ID.test(id) || !SAFE_KIND.test(kind) || !SAFE_EXT.test(extension)) return null;
  return `${id.slice(0, 2)}/${id.slice(2, 4)}/${id}-${kind}.${extension}`;
}
