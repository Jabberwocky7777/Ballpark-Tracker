import "server-only";
import type { Coordinate } from "../geo.ts";
import type { RawTimestampTags } from "../timestamp.ts";

/**
 * Reading what the phone left in the file, and never trusting that it did.
 *
 * Section 4.1 of the plan is blunt about this: GPS is stripped or mangled on
 * most of the paths a photo actually travels, and 20-40% of a real batch will
 * arrive with nothing. So every field here is optional, a parse failure is a
 * result rather than an exception, and the caller is expected to carry on with
 * whatever survived.
 *
 * exifr is the only metadata dependency, and it reads -- nothing in this file
 * or below it ever writes to the input. Originals are immutable.
 */

export interface PhotoMetadata {
  coordinate: Coordinate | null;
  /** How the coordinate was obtained, stored so a later re-match can weigh it. */
  gpsSource: "exif" | null;
  timestampTags: RawTimestampTags;
  camera: string | null;
}

const EMPTY: PhotoMetadata = {
  coordinate: null,
  gpsSource: null,
  timestampTags: {},
  camera: null,
};

const PICK = [
  "DateTimeOriginal",
  "CreateDate",
  "OffsetTimeOriginal",
  "OffsetTime",
  "GPSDateStamp",
  "GPSTimeStamp",
  "Make",
  "Model",
  "latitude",
  "longitude",
];

/** Never throws. A file with no metadata is ordinary, not an error. */
export async function readMetadata(input: Buffer): Promise<PhotoMetadata> {
  const exifr = (await import("exifr")).default;

  let tags: Record<string, unknown> | null = null;
  try {
    tags = (await exifr.parse(input, {
      tiff: true,
      exif: true,
      gps: true,
      pick: PICK,
    })) as Record<string, unknown> | null;
  } catch {
    // Truncated, unusual, or simply metadata-free. Carry on with nothing.
    return { ...EMPTY };
  }

  if (!tags) return { ...EMPTY };

  const gps = await readGps(exifr, input);

  return {
    coordinate: gps,
    gpsSource: gps ? "exif" : null,
    timestampTags: {
      // CreateDate is the fallback for files where DateTimeOriginal was lost in
      // a transcode -- an auto-converted JPEG out of the share sheet often has
      // only the one.
      dateTimeOriginal: asDate(tags.DateTimeOriginal) ?? asDate(tags.CreateDate),
      offsetTimeOriginal: asString(tags.OffsetTimeOriginal) ?? asString(tags.OffsetTime),
      gpsDateStamp: asString(tags.GPSDateStamp),
      gpsTimeStamp: (tags.GPSTimeStamp as number[] | string | undefined) ?? null,
    },
    camera: [asString(tags.Make), asString(tags.Model)].filter(Boolean).join(" ") || null,
  };
}

async function readGps(
  exifr: { gps: (input: Buffer) => Promise<{ latitude?: number; longitude?: number } | undefined> },
  input: Buffer,
): Promise<Coordinate | null> {
  const gps = await exifr.gps(input).catch(() => null);
  const lat = gps?.latitude;
  const lng = gps?.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // 0,0 is Null Island: what a cleared or zeroed GPS block reads as, and a
  // place no ballpark is. Treating it as a real fix would match every such
  // photo to whichever park is nearest the Atlantic.
  if (lat === 0 && lng === 0) return null;
  if ((lat as number) < -90 || (lat as number) > 90) return null;
  if ((lng as number) < -180 || (lng as number) > 180) return null;

  return { lat: lat as number, lng: lng as number };
}

/**
 * exifr revives date tags into Date objects, but not for every file -- a
 * malformed or unusual block comes back as the raw "YYYY:MM:DD hh:mm:ss"
 * string. Dropping those would silently cost the photo its date, and a photo
 * with no date cannot be matched to a visit by any of the later signals.
 */
function asDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === "string") {
    const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value.trim());
    if (!m) return null;
    const [, y, mo, d, h, mi, s] = m.map(Number);
    // Local-time constructor on purpose: this is a wall-clock reading with no
    // zone, and resolveTimestamp is what decides which zone it belongs to.
    const parsed = new Date(y, mo - 1, d, h, mi, s);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
