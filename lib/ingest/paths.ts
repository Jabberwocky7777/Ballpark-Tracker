import "server-only";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The two storage roots, from env only.
 *
 * Never a hardcoded host path: the container sees /photos/originals, a laptop
 * sees ./data/photos, and the real dataset paths live in the private deploy
 * doc. The container defaults are what the app wizard mounts.
 */

const inRepo = (...parts: string[]) => join(process.cwd(), "data", ...parts);

export function originalsDir(): string {
  return process.env.ORIGINALS_DIR ?? inRepo("photos", "originals");
}

export function derivedDir(): string {
  return process.env.DERIVED_DIR ?? inRepo("photos", "derived");
}

/** Creates a root if it is missing. Originals are never deleted, only added to. */
export function ensureDir(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return dir;
}
