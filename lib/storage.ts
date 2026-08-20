import { mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The three directories this app writes to, resolved from env in one place.
 *
 * Never a hardcoded host path: the container sees /config and /photos/*, a
 * laptop sees ./data, and the real dataset paths live in the private deploy
 * doc. The container defaults come from the app wizard as runtime env.
 *
 * One module rather than a `process.env.DATA_DIR ?? join(cwd(), "data")` in
 * each caller, because that expression was in four files and a fifth would
 * eventually have disagreed with the other four.
 *
 * Deliberately not `server-only`: the migrate and seed CLIs need these paths
 * and do not run inside the React server bundle.
 */

export function dataDir(): string {
  return process.env.DATA_DIR ?? join(process.cwd(), "data");
}

export function originalsDir(): string {
  return process.env.ORIGINALS_DIR ?? join(dataDir(), "photos", "originals");
}

export function derivedDir(): string {
  return process.env.DERIVED_DIR ?? join(dataDir(), "photos", "derived");
}

/** Creates a directory if it is missing, and returns it. */
export function ensureDir(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return dir;
}
