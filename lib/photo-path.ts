import { isAbsolute, join, resolve, sep } from "node:path";

/**
 * Resolves a stored derivative path against the derivatives root, and refuses
 * anything that escapes it.
 *
 * Paths always come from our own database rather than from a request -- the
 * route only ever uses the photo id as a lookup key. This is the second line:
 * a corrupted or hand-edited row must not be able to turn into a read of
 * /etc/passwd or of the originals directory.
 *
 * Pure, so the traversal cases can be tested without touching a filesystem.
 */
export function resolveDerivativePath(root: string, storedPath: string): string | null {
  if (!storedPath) return null;

  // A NUL byte truncates the path in some syscalls; reject rather than clean.
  if (storedPath.includes("\0")) return null;

  const base = resolve(root);
  const target = isAbsolute(storedPath) ? resolve(storedPath) : resolve(join(base, storedPath));

  if (target !== base && !target.startsWith(base + sep)) return null;
  // The root itself is a directory, never a file to serve.
  if (target === base) return null;

  return target;
}
