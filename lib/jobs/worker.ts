import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/index.ts";
import { generateDerivatives } from "../ingest/derivatives.ts";
import { sniffImage, type ImageFormat } from "../ingest/magic.ts";
import { derivedDir, ensureDir, originalsDir } from "../ingest/paths.ts";
import { resolveWithinRoot } from "../photo-path.ts";
import { claimNext, markDone, markFailed, requeueStranded, type Job } from "./queue.ts";

/**
 * One in-process worker, polling. No Redis, no second container.
 *
 * Deliberately serial: decoding is CPU-bound and this runs on a NAS that is
 * also serving the site, so a burst of parallel HEIC decodes would make every
 * page slow while a batch imports. Slower and invisible beats faster and felt.
 */

const IDLE_POLL_MS = 2_000;

type Handler = (payload: unknown) => Promise<void>;

const HANDLERS: Record<string, Handler> = {
  derivatives: runDerivatives,
};

let running = false;

/** Starts the loop once per process. Safe to call again; it will not double up. */
export function startWorker(): void {
  if (running) return;
  running = true;

  const stranded = requeueStranded();
  if (stranded > 0) console.log(`[jobs] requeued ${stranded} job(s) stranded by a restart`);

  void loop();
}

async function loop(): Promise<void> {
  for (;;) {
    let worked = false;
    try {
      worked = await drainOne();
    } catch (err) {
      // The loop itself must never die -- a crash here silently stops every
      // future derivative, and nothing would say so.
      console.error("[jobs] worker loop error:", err);
    }
    // Straight on to the next job while there is work, then back to polling.
    if (!worked) await sleep(IDLE_POLL_MS);
  }
}

/** Runs at most one job. Returns whether there was one. Exported for the CLI. */
export async function drainOne(): Promise<boolean> {
  const job = claimNext();
  if (!job) return false;

  const handler = HANDLERS[job.kind];
  if (!handler) {
    markFailed(job.id, Number.MAX_SAFE_INTEGER, `unknown job kind: ${job.kind}`);
    return true;
  }

  try {
    await handler(job.payload);
    markDone(job.id);
  } catch (err) {
    markFailed(job.id, job.attempts, err);
    console.error(`[jobs] ${job.kind} #${job.id} attempt ${job.attempts} failed:`, err);
  }
  return true;
}

/** Drains the whole queue and stops. What the CLI import calls when it finishes. */
export async function drainAll(onProgress?: (done: number) => void): Promise<number> {
  let done = 0;
  while (await drainOne()) {
    // Incremented on its own line deliberately: `onProgress?.(++done)` never
    // runs the increment when no callback was passed, and the count silently
    // stays at zero.
    done += 1;
    onProgress?.(done);
  }
  return done;
}

// ------------------------------------------------------------- handlers ----

interface DerivativesPayload {
  photoId: string;
}

async function runDerivatives(payload: unknown): Promise<void> {
  const { photoId } = (payload ?? {}) as DerivativesPayload;
  if (!photoId) throw new Error("derivatives job with no photoId");

  const db = getDb();
  const photo = db.select().from(schema.photos).where(eq(schema.photos.id, photoId)).get();
  if (!photo) {
    // The photo was deleted between enqueue and now. Nothing to do, and not a
    // failure worth retrying twice more.
    console.warn(`[jobs] derivatives for a photo that no longer exists: ${photoId}`);
    return;
  }

  // The stored path came from our own database, but the same containment check
  // the serving route makes applies here -- a corrupted row must not be able to
  // read outside the originals root.
  const source = resolveWithinRoot(originalsDir(), photo.storedPath);
  if (!source) throw new Error(`stored path escapes the originals root: ${photo.storedPath}`);

  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(source);

  const sniffed = sniffImage(bytes);
  if (!sniffed) throw new Error(`stored original is not a readable image: ${photoId}`);

  const root = ensureDir(derivedDir());
  const result = await generateDerivatives(bytes, sniffed.format as ImageFormat, photoId, root);

  db.transaction((tx) => {
    // Regenerating replaces rather than accumulates: a requeued job must not
    // leave two rows claiming to be the thumb.
    tx.delete(schema.photoVariants).where(eq(schema.photoVariants.photoId, photoId)).run();
    for (const variant of result.variants) {
      tx.insert(schema.photoVariants).values({ photoId, ...variant }).run();
    }
    if (result.width && result.height) {
      tx.update(schema.photos)
        .set({ width: result.width, height: result.height })
        .where(eq(schema.photos.id, photoId))
        .run();
    }
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
