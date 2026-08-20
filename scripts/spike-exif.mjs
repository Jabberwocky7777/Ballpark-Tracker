#!/usr/bin/env node
/**
 * Phase 0 spike. Answers three questions before any UI exists:
 *
 *   1. Does EXIF GPS survive the path these photos actually take off the phones?
 *   2. Can this image decode HEIC, and with which of the three candidate paths?
 *   3. Is timestamp resolution (local wall-clock -> UTC instant) actually possible
 *      per-file, or does it fall back to the venue timezone more often than not?
 *
 * MUST be run inside the target container image. A pass on a dev machine proves
 * nothing: `sharp`'s prebuilt binaries frequently ship without libheif, and the
 * Windows and Linux builds differ.
 *
 *   docker run --rm -v /path/to/photos:/in:ro <image> node scripts/spike-exif.mjs /in
 *
 * Reads only. Writes nothing, moves nothing, and never touches the input files.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { performance } from "node:perf_hooks";
// The same resolver the ingest pipeline uses. Sharing it is the point: the
// spike is meant to predict what ingest will do, which it cannot do with its
// own second implementation.
import { resolveTimestamp } from "../lib/timestamp.ts";

const INPUT = process.argv[2];
if (!INPUT) {
  console.error("usage: node scripts/spike-exif.mjs <directory-of-photos>");
  process.exit(2);
}

const IMAGE_EXT = new Set([".heic", ".heif", ".jpg", ".jpeg", ".png", ".tif", ".tiff"]);

/** Candidate decoders, in the order the plan prefers them. */
const DECODERS = [
  {
    name: "sharp",
    async decode(buf) {
      const sharp = (await import("sharp")).default;
      return sharp(buf).jpeg({ quality: 82 }).toBuffer();
    },
  },
  {
    name: "heic-convert",
    async decode(buf) {
      const convert = (await import("heic-convert")).default;
      return convert({ buffer: buf, format: "JPEG", quality: 0.82 });
    },
  },
  {
    name: "pillow-heif (python sidecar)",
    async decode(buf) {
      const { spawn } = await import("node:child_process");
      return new Promise((resolve, reject) => {
        const py = spawn("python3", [join(import.meta.dirname, "heic_decode.py")]);
        const out = [];
        const err = [];
        py.stdout.on("data", (d) => out.push(d));
        py.stderr.on("data", (d) => err.push(d));
        py.on("error", reject);
        py.on("close", (code) =>
          code === 0
            ? resolve(Buffer.concat(out))
            : reject(new Error(Buffer.concat(err).toString().trim() || `exit ${code}`)),
        );
        py.stdin.on("error", reject);
        py.stdin.end(buf);
      });
    },
  },
];

const SOURCE_LABEL = {
  "exif-offset": "OffsetTimeOriginal",
  "gps-utc": "derived from GPS UTC",
  "venue-timezone": "matched venue timezone",
  none: "wall-clock only -> needs venue tz",
};

const exifr = (await import("exifr")).default;

const entries = (await readdir(INPUT, { withFileTypes: true }))
  .filter((e) => e.isFile() && IMAGE_EXT.has(extname(e.name).toLowerCase()))
  .map((e) => join(INPUT, e.name))
  .sort();

if (entries.length === 0) {
  console.error(`No images found in ${INPUT}`);
  process.exit(1);
}

console.log(`Scanning ${entries.length} file(s) in ${INPUT}\n`);

const tally = {
  total: 0,
  gps: 0,
  noGps: 0,
  dateOnly: 0,
  noDate: 0,
  offsetTag: 0,
  gpsUtcCrossCheck: 0,
  heic: 0,
  decoderWins: new Map(),
  decodeFailures: 0,
};

for (const file of entries) {
  const name = basename(file);
  const buf = await readFile(file);
  const { size } = await stat(file);
  const isHeic = /^\.hei[cf]$/i.test(extname(file));
  tally.total++;
  if (isHeic) tally.heic++;

  console.log(`── ${name}  (${(size / 1_048_576).toFixed(1)} MB${isHeic ? ", HEIC" : ""})`);

  // --- metadata ---
  let tags = null;
  try {
    tags = await exifr.parse(buf, {
      tiff: true, exif: true, gps: true,
      pick: [
        "DateTimeOriginal", "CreateDate", "OffsetTimeOriginal", "OffsetTime",
        "GPSDateStamp", "GPSTimeStamp", "Make", "Model",
        "latitude", "longitude", "GPSLatitude", "GPSLongitude",
      ],
    });
  } catch (err) {
    console.log(`   exif        FAILED  ${err.message}`);
  }

  const gps = await exifr.gps(buf).catch(() => null);
  const hasGps = Number.isFinite(gps?.latitude) && Number.isFinite(gps?.longitude);
  const ts = resolveTimestamp({
    dateTimeOriginal: tags?.DateTimeOriginal ?? tags?.CreateDate ?? null,
    offsetTimeOriginal: tags?.OffsetTimeOriginal ?? tags?.OffsetTime ?? null,
    gpsDateStamp: tags?.GPSDateStamp ?? null,
    gpsTimeStamp: tags?.GPSTimeStamp ?? null,
  });

  if (hasGps) {
    tally.gps++;
    // Coordinates are printed to 4dp (~11m) deliberately. This output is a
    // diagnostic that may get pasted around; it is not a location log.
    console.log(`   gps         ${gps.latitude.toFixed(4)}, ${gps.longitude.toFixed(4)}`);
  } else {
    tally.noGps++;
    console.log(`   gps         NONE  ← lands in the manual assignment queue`);
  }

  if (ts.takenLocal) {
    if (!hasGps) tally.dateOnly++;
    if (ts.offsetSource === "exif-offset") tally.offsetTag++;
    if (ts.offsetSource === "gps-utc") tally.gpsUtcCrossCheck++;
    console.log(`   taken       ${ts.takenLocal.replace("T", " ")} local   offset ${ts.tzOffset ?? "unknown"}`);
    console.log(`   tz source   ${SOURCE_LABEL[ts.offsetSource]}`);
  } else {
    tally.noDate++;
    console.log(`   taken       NONE  ← no date at all, manual entry required`);
  }

  if (tags?.Make || tags?.Model) {
    console.log(`   camera      ${[tags.Make, tags.Model].filter(Boolean).join(" ")}`);
  }

  // --- decode ---
  if (isHeic) {
    let won = false;
    for (const d of DECODERS) {
      const t0 = performance.now();
      try {
        const out = await d.decode(buf);
        const ms = Math.round(performance.now() - t0);
        console.log(`   decode      OK via ${d.name}  ${(out.length / 1_048_576).toFixed(1)} MB in ${ms}ms`);
        tally.decoderWins.set(d.name, (tally.decoderWins.get(d.name) ?? 0) + 1);
        won = true;
        break;
      } catch (err) {
        const msg = String(err.message ?? err).split("\n")[0].slice(0, 120);
        console.log(`   decode      ${d.name} failed: ${msg}`);
      }
    }
    if (!won) {
      tally.decodeFailures++;
      console.log(`   decode      ALL DECODERS FAILED`);
    }
  }
  console.log();
}

// --- verdict ---------------------------------------------------------------
const pct = (n) => `${Math.round((n / tally.total) * 100)}%`;

console.log("═".repeat(60));
console.log(`Files                ${tally.total}  (${tally.heic} HEIC)`);
console.log(`GPS present          ${tally.gps}  (${pct(tally.gps)})`);
console.log(`No GPS               ${tally.noGps}  (${pct(tally.noGps)})  ← the manual queue`);
console.log(`No date at all       ${tally.noDate}`);
console.log(`OffsetTimeOriginal   ${tally.offsetTag}`);
console.log(`GPS UTC cross-check  ${tally.gpsUtcCrossCheck}`);
if (tally.heic > 0) {
  console.log(`\nHEIC decode:`);
  for (const [n, c] of tally.decoderWins) console.log(`  ${n.padEnd(28)} ${c}`);
  if (tally.decodeFailures) console.log(`  FAILED                       ${tally.decodeFailures}`);
}
console.log("═".repeat(60));

if (tally.heic > 0 && tally.decodeFailures === tally.heic) {
  console.log("\nSTOP. No decoder handled HEIC in this image. The stack changes.");
  console.log("Do not start the UI. Revisit docs/plan.md section 4.2 and record the");
  console.log("outcome in docs/decisions.md.");
  process.exit(1);
}
if (tally.noGps / tally.total > 0.4) {
  console.log("\nNote: over 40% of these files have no GPS. The manual assignment");
  console.log("queue and bulk-assign are the primary interface, not a fallback.");
}
console.log("\nRecord the winning decoder and these numbers in docs/decisions.md.");
