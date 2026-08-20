#!/usr/bin/env node
/**
 * Bulk import for the existing backlog -- the 200 to 2000 photos that predate
 * this app and are not going to be dragged into a browser sixty at a time.
 *
 * Resumable by construction rather than by bookkeeping: dedupe is on the
 * sha256 of the bytes, so a run that dies at photo 900 can simply be run
 * again, and the first 900 come back as duplicates in seconds. There is no
 * progress file to get out of sync with reality.
 *
 * Reads only. It never modifies, moves, or deletes anything in the source
 * directory -- point it straight at an Apple Photos album export, which is the
 * one path that reliably preserves EXIF.
 *
 *   npm run import:photos -- <directory> --as user_a
 *   npm run import:photos -- <directory> --as user_b --dry-run
 *   npm run import:photos -- <directory> --as user_a --no-derivatives
 *
 * The `--conditions=react-server` in the npm script is what lets a CLI import
 * the same `server-only` ingest module the upload route uses. Sharing it is
 * deliberate: two pipelines would drift, and this one handles the irreplaceable
 * photos.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { ingestPhoto, type IngestReport } from "../lib/ingest/ingest.ts";
import {
  propagateSessionMatches,
  type Assignment,
  type SessionPhoto,
} from "../lib/ingest/assign.ts";
import { drainAll } from "../lib/jobs/worker.ts";
import { getDb, schema } from "../lib/db/index.ts";
import { eq } from "drizzle-orm";

const IMAGE_EXT = new Set([".heic", ".heif", ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"]);

const args = process.argv.slice(2).filter((a) => a !== "--");
const dir = args.find((a) => !a.startsWith("--"));
const uploadedBy = valueOf("--as") ?? "user_a";
const dryRun = args.includes("--dry-run");
const withDerivatives = !args.includes("--no-derivatives");

function valueOf(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

if (!dir) {
  console.error("usage: npm run import:photos -- <directory> [--as user_a|user_b] [--dry-run]");
  process.exit(2);
}

if (uploadedBy !== "user_a" && uploadedBy !== "user_b") {
  console.error(`--as must be user_a or user_b, not ${uploadedBy}. Never a real name.`);
  process.exit(2);
}

/** Every image under the directory, recursively, oldest path first. */
async function walk(root: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(root, { withFileTypes: true });

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(root, entry.name);
    // Skip the noise an album export leaves behind.
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else if (entry.isFile() && IMAGE_EXT.has(extname(entry.name).toLowerCase())) out.push(path);
  }
  return out;
}

const files = await walk(dir);
if (files.length === 0) {
  console.error(`No images found under ${dir}`);
  process.exit(1);
}

console.log(`${files.length} image(s) under ${dir}`);
if (dryRun) console.log("Dry run: nothing will be stored.\n");
else console.log(`Importing as ${uploadedBy}. Every photo lands private.\n`);

const tally = { stored: 0, duplicate: 0, rejected: 0, noGps: 0, noDate: 0, queued: 0, guarded: 0 };
const stored: IngestReport[] = [];

for (const [index, file] of files.entries()) {
  const name = relative(dir, file);
  const position = `${String(index + 1).padStart(String(files.length).length)}/${files.length}`;

  if (dryRun) {
    const { size } = await stat(file);
    console.log(`${position}  ${name}  (${(size / 1_048_576).toFixed(1)} MB)`);
    continue;
  }

  let report: IngestReport;
  try {
    report = await ingestPhoto({ buffer: await readFile(file), filename: name, uploadedBy });
  } catch (err) {
    // One unreadable file must not end a 2000-photo run.
    tally.rejected++;
    console.log(`${position}  ${name}\n        error   ${(err as Error).message}`);
    continue;
  }

  tally[report.outcome]++;
  if (report.outcome === "stored") {
    stored.push(report);
    if (report.gps === "none") tally.noGps++;
    if (report.date === "none") tally.noDate++;
    if (report.confidence !== "confident") tally.queued++;
    if (report.homeGuardFlag) tally.guarded++;
  }

  console.log(`${position}  ${name}  ${describe(report)}`);
}

function describe(r: IngestReport): string {
  if (r.outcome === "duplicate") return "already here";
  if (r.outcome === "rejected") return `rejected -- ${r.reason}`;

  const parts = [r.gps === "found" ? "gps" : "no gps", r.date === "found" ? "date" : "no date"];
  if (r.venueId) parts.push(`${r.venueId} (${r.confidence})`);
  else parts.push("queue");
  if (r.homeGuardFlag) parts.push("NEAR HOME -- flagged");
  return parts.join(", ");
}

if (dryRun) process.exit(0);

// --- session clustering ------------------------------------------------------
// The second pass, and the reason this is a batch tool rather than a loop over
// the upload endpoint: a photo taken on the concourse with no GPS lock is
// unmatchable on its own but obvious in the company of the twenty around it.
if (stored.length > 1) {
  const photos: SessionPhoto[] = stored.map((r) => ({
    id: r.photoId as string,
    takenUtc: takenUtcOf(r.photoId as string),
    assignment: {
      venueId: r.venueId,
      visitId: null,
      confidence: r.confidence,
      reason: r.venueId ? "gps-confident" : "unmatched",
    } as Assignment,
  }));

  const promoted = propagateSessionMatches(photos).filter((p, i) => {
    const before = photos[i];
    return p.assignment.venueId !== before.assignment.venueId;
  });

  const db = getDb();
  for (const photo of promoted) {
    db.update(schema.photos)
      .set({ venueId: photo.assignment.venueId, matchConfidence: "suggested" })
      .where(eq(schema.photos.id, photo.id))
      .run();
  }

  if (promoted.length > 0) {
    console.log(`\n${promoted.length} photo(s) matched by the company they were taken in.`);
    console.log("All of them are suggestions -- confirm them in the queue.");
  }
}

function takenUtcOf(photoId: string): string | null {
  const row = getDb()
    .select({ takenUtc: schema.photos.takenUtc })
    .from(schema.photos)
    .where(eq(schema.photos.id, photoId))
    .get();
  return row?.takenUtc ?? null;
}

// --- derivatives -------------------------------------------------------------
if (withDerivatives && tally.stored > 0) {
  console.log("\nGenerating derivatives. This is the slow part; it is safe to stop and re-run.");
  const done = await drainAll((n) => {
    if (n % 25 === 0) process.stdout.write(`  ${n} done\n`);
  });
  console.log(`  ${done} job(s) processed.`);
}

// --- verdict -----------------------------------------------------------------
console.log("\n" + "=".repeat(60));
console.log(`Stored          ${tally.stored}`);
console.log(`Already here    ${tally.duplicate}`);
console.log(`Rejected        ${tally.rejected}`);
console.log(`No GPS          ${tally.noGps}`);
console.log(`No date at all  ${tally.noDate}`);
console.log(`Needs a park    ${tally.queued}  <- the assignment queue at /admin`);
if (tally.guarded > 0) console.log(`Near home       ${tally.guarded}  <- flagged for review`);
console.log("\nEvery photo is private. Publishing is a separate, deliberate act.");
