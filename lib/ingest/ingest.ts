import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/index.ts";
import { homeGuardFromEnv, isNearHome, matchVenue, type GeoMatch } from "../geo.ts";
import { enqueue } from "../jobs/queue.ts";
import { resolveTimestamp, venueOffsetMinutes } from "../timestamp.ts";
import { chooseAssignment, type Assignment, type VisitRecord } from "./assign.ts";
import { readMetadata } from "./exif.ts";
import { sniffImage } from "./magic.ts";
import { originalsDir } from "../storage.ts";
import { originalRelativePath } from "./storage-path.ts";

/**
 * One photo, from bytes to a database row. The whole of Phase 2 in order:
 *
 *   sniff -> hash -> dedupe -> write the original once -> read EXIF ->
 *   geo-match -> resolve the timestamp -> assign or queue -> enqueue the
 *   derivatives job
 *
 * Two callers share it exactly: the upload route and the bulk CLI import. That
 * is the point -- the backlog and a phone upload must produce identical rows,
 * or the CLI quietly becomes a second, worse pipeline.
 *
 * Rules it enforces, all of them non-negotiable elsewhere in the codebase:
 *   - `is_public` is 0 for every photo regardless of who uploaded it
 *   - nothing is ever written into the photo file, and no original is modified
 *     or overwritten
 *   - the stored path is derived from the content hash, never from a filename
 *   - decoding does not happen here; it happens in the job worker
 */

/** 60MB. A 48MP ProRAW frame fits; a video does not. */
export const MAX_BYTES = 60 * 1024 * 1024;

type IngestOutcome = "stored" | "duplicate" | "rejected";

/**
 * Per-file, and deliberately detailed. Section 4.1 asks for GPS found / no GPS
 * / date only to be reported at upload time rather than discovered weeks later
 * when the map has a hole in it.
 */
export interface IngestReport {
  filename: string;
  outcome: IngestOutcome;
  photoId: string | null;
  /** Set on `rejected`, and on `duplicate` to name what it duplicates. */
  reason: string | null;
  gps: "found" | "none";
  date: "found" | "none";
  venueId: string | null;
  confidence: Assignment["confidence"];
  assignedVisit: boolean;
  homeGuardFlag: boolean;
  bytes: number;
}

interface IngestOptions {
  buffer: Buffer;
  /** For display and for the report only. Never used to build a path. */
  filename: string;
  /** user_a | user_b | guest:<link_id>. Never a real name. */
  uploadedBy: string;
  /** Guest uploads always land in the review queue. */
  needsReview?: boolean;
}

/**
 * Writes the original, atomically.
 *
 * A plain write with the `wx` flag looks like it enforces write-once, and it
 * does -- but it leaves a partial file behind if the process dies mid-write,
 * and the next run sees that file, believes the photo is already stored, and
 * writes a database row pointing at truncated bytes. Silently. For the one
 * category of data in this project that cannot be regenerated.
 *
 * So: write a temp file in the same directory, then rename it into place.
 * Rename is atomic, which means the destination either does not exist or holds
 * the complete file, never anything in between.
 *
 * The rename does replace an existing file, and that is deliberate rather than
 * a hole in the immutability rule. The path is the content hash, so the only
 * thing that can be at that path is either these exact bytes or the wreckage
 * of an interrupted write, and healing the second case costs nothing.
 */
async function storeOriginal(target: string, buffer: Buffer): Promise<void> {
  const temp = `${target}.${randomBytes(6).toString("hex")}.part`;
  try {
    await writeFile(temp, buffer, { flag: "wx" });
    await rename(temp, target);
  } catch (err) {
    // Never leave the scratch file behind, whatever went wrong.
    await rm(temp, { force: true }).catch(() => {});
    throw err;
  }
}

export async function ingestPhoto(options: IngestOptions): Promise<IngestReport> {
  const { buffer, filename, uploadedBy } = options;

  const base: IngestReport = {
    filename,
    outcome: "rejected",
    photoId: null,
    reason: null,
    gps: "none",
    date: "none",
    venueId: null,
    confidence: "unmatched",
    assignedVisit: false,
    homeGuardFlag: false,
    bytes: buffer.length,
  };

  if (buffer.length === 0) return { ...base, reason: "the file is empty" };
  if (buffer.length > MAX_BYTES) {
    return { ...base, reason: `larger than the ${Math.round(MAX_BYTES / 1024 / 1024)}MB limit` };
  }

  // Magic bytes, never the extension. A .jpg that is really something else
  // must not reach a decoder.
  const sniffed = sniffImage(buffer);
  if (!sniffed) return { ...base, reason: "not a photo we can read" };

  const sha256 = createHash("sha256").update(buffer).digest("hex");

  const db = getDb();
  const existing = db.select().from(schema.photos).where(eq(schema.photos.sha256, sha256)).get();
  if (existing) {
    // The same photo will be uploaded more than once -- this is expected, not
    // an error, and the original on disk is left exactly as it is.
    return {
      ...base,
      outcome: "duplicate",
      photoId: existing.id,
      reason: "already here",
      venueId: existing.venueId ?? null,
    };
  }

  const relative = originalRelativePath(sha256, sniffed.ext);
  if (!relative) return { ...base, reason: "could not derive a storage path" };

  // --- write once, never over -------------------------------------------
  const target = join(originalsDir(), relative);
  try {
    // Recursive, so this creates the root as well as the fan-out directory.
    await mkdir(dirname(target), { recursive: true });
    await storeOriginal(target, buffer);
  } catch (err) {
    return { ...base, reason: `could not store the original: ${(err as Error).message}` };
  }

  // --- what the file knows about itself ----------------------------------
  const metadata = await readMetadata(buffer);

  const venues = db
    .select({
      id: schema.venues.id,
      lat: schema.venues.lat,
      lng: schema.venues.lng,
      timezone: schema.venues.timezone,
    })
    .from(schema.venues)
    .all();

  const match: GeoMatch | null = metadata.coordinate
    ? matchVenue(metadata.coordinate, venues)
    : null;

  // The timezone of the park it was probably taken at is the last-resort
  // anchor for a wall-clock reading with no offset.
  const matchedVenue = match?.venueId ? venues.find((v) => v.id === match.venueId) : undefined;
  const wallClock = metadata.timestampTags.dateTimeOriginal ?? null;
  const fallbackOffset =
    matchedVenue && wallClock ? venueOffsetMinutes(matchedVenue.timezone, wallClock) : null;

  const timestamp = resolveTimestamp(metadata.timestampTags, fallbackOffset);
  const localDate = timestamp.takenLocal ? timestamp.takenLocal.slice(0, 10) : null;

  const visits = db
    .select({
      id: schema.visits.id,
      venueId: schema.visits.venueId,
      visitDate: schema.visits.visitDate,
    })
    .from(schema.visits)
    .all() as VisitRecord[];

  const assignment = chooseAssignment(match, localDate, visits);

  // --- the guard ----------------------------------------------------------
  const guard = homeGuardFromEnv();
  const nearHome = isNearHome(metadata.coordinate, guard.home, guard.radiusKm);

  // --- the row ------------------------------------------------------------
  const photoId = randomBytes(8).toString("hex");

  db.insert(schema.photos)
    .values({
      id: photoId,
      sha256,
      originalFilename: filename.slice(0, 255),
      storedPath: relative,
      takenUtc: timestamp.takenUtc,
      takenLocal: timestamp.takenLocal,
      tzOffset: timestamp.tzOffset,
      lat: metadata.coordinate?.lat ?? null,
      lng: metadata.coordinate?.lng ?? null,
      gpsSource: metadata.gpsSource,
      matchConfidence: assignment.confidence,
      venueId: assignment.venueId,
      visitId: assignment.visitId,
      // Private until deliberately published. Every uploader, every time.
      isPublic: 0,
      homeGuardFlag: nearHome ? 1 : 0,
      // A photo taken near home is looked at by a person before it goes
      // anywhere, on top of being private already.
      needsReview: options.needsReview || nearHome ? 1 : 0,
      uploadedBy,
    })
    .run();

  enqueue("derivatives", { photoId });

  return {
    filename,
    outcome: "stored",
    photoId,
    reason: null,
    gps: metadata.coordinate ? "found" : "none",
    date: timestamp.takenLocal ? "found" : "none",
    venueId: assignment.venueId,
    confidence: assignment.confidence,
    assignedVisit: assignment.visitId !== null,
    homeGuardFlag: nearHome,
    bytes: buffer.length,
  };
}
