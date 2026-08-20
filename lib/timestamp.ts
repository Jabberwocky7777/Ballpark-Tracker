/**
 * Resolving when a photo was actually taken. docs/plan.md section 4.3.
 *
 * `DateTimeOriginal` is local wall-clock with no timezone attached. Storing it
 * as UTC turns a 7:05pm first pitch into a 2am photo, so the offset has to come
 * from somewhere. In order of trust:
 *
 *   1. `OffsetTimeOriginal`   — Exif 2.31+, what modern iPhones write
 *   2. `GPSDateStamp`/`GPSTimeStamp` — true UTC, so the offset is the
 *      difference between it and the wall-clock reading
 *   3. the matched venue's timezone — a guess, but a well-founded one
 *
 * All three of UTC instant, local wall-clock and the offset used are returned,
 * because the plan requires storing all three: display is local, sorting is
 * UTC, and the offset records how much we trusted it.
 *
 * Pure: no exif library, no database, no clock read. The spike and the ingest
 * pipeline share it so there is one implementation of this, not two.
 */

export type OffsetSource = "exif-offset" | "gps-utc" | "venue-timezone" | "none";

export interface RawTimestampTags {
  /** Local wall-clock, no zone. Usually a Date built from "YYYY:MM:DD hh:mm:ss". */
  dateTimeOriginal?: Date | null;
  /** e.g. "-05:00". */
  offsetTimeOriginal?: string | null;
  /** "YYYY:MM:DD", true UTC. */
  gpsDateStamp?: string | null;
  /** [h, m, s] or "h:m:s", true UTC. exifr returns either. */
  gpsTimeStamp?: number[] | string | null;
}

export interface ResolvedTimestamp {
  /** ISO instant, or null when the photo carries no date at all. */
  takenUtc: string | null;
  /** "YYYY-MM-DDTHH:mm:ss" as it read on the camera. */
  takenLocal: string | null;
  /** e.g. "-05:00", or null when nothing could establish it. */
  tzOffset: string | null;
  offsetSource: OffsetSource;
}

/** "+HH:MM" / "-HH:MM" to minutes. Returns null on anything unparseable. */
export function parseOffsetMinutes(offset: string | null | undefined): number | null {
  if (!offset) return null;
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(offset.trim());
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const hours = Number(m[2]);
  const minutes = Number(m[3]);
  if (hours > 14 || minutes > 59) return null;
  return sign * (hours * 60 + minutes);
}

export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/**
 * GPSDateStamp + GPSTimeStamp as a true UTC instant.
 *
 * exifr hands GPSTimeStamp back as either [h, m, s] or the string "h:m:s"
 * depending on the file. Destructuring the string silently yields "0", ":",
 * "5" and produces an invalid date, which is how this cross-check quietly
 * stopped working once already.
 */
export function gpsUtcFromTags(
  gpsDateStamp: string | null | undefined,
  gpsTimeStamp: number[] | string | null | undefined,
): Date | null {
  if (!gpsDateStamp || gpsTimeStamp === null || gpsTimeStamp === undefined) return null;

  const parts = Array.isArray(gpsTimeStamp)
    ? gpsTimeStamp.map(Number)
    : String(gpsTimeStamp).split(":").map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null;

  const [h, m, s] = parts;
  const date = String(gpsDateStamp).replaceAll(":", "-");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const iso = `${date}T${pad(h)}:${pad(m)}:${pad(Math.floor(s))}Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");

function localString(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** The wall-clock reading interpreted as if it were in the given offset. */
function instantFor(local: Date, offsetMinutes: number): Date {
  const naiveUtc = Date.UTC(
    local.getFullYear(),
    local.getMonth(),
    local.getDate(),
    local.getHours(),
    local.getMinutes(),
    local.getSeconds(),
  );
  return new Date(naiveUtc - offsetMinutes * 60_000);
}

/**
 * @param venueOffsetMinutes last-resort offset, derived from the matched
 *        venue's timezone for that date by the caller. Null when the photo is
 *        not matched to a venue yet.
 */
export function resolveTimestamp(
  tags: RawTimestampTags,
  venueOffsetMinutes: number | null = null,
): ResolvedTimestamp {
  const local = tags.dateTimeOriginal ?? null;

  if (!local || Number.isNaN(local.getTime())) {
    return { takenUtc: null, takenLocal: null, tzOffset: null, offsetSource: "none" };
  }

  const takenLocal = localString(local);

  // 1. The camera told us outright.
  const exifOffset = parseOffsetMinutes(tags.offsetTimeOriginal);
  if (exifOffset !== null) {
    return {
      takenUtc: instantFor(local, exifOffset).toISOString(),
      takenLocal,
      tzOffset: formatOffset(exifOffset),
      offsetSource: "exif-offset",
    };
  }

  // 2. Derive it from the GPS clock, which is true UTC.
  const gpsUtc = gpsUtcFromTags(tags.gpsDateStamp, tags.gpsTimeStamp);
  if (gpsUtc) {
    const naiveUtc = Date.UTC(
      local.getFullYear(),
      local.getMonth(),
      local.getDate(),
      local.getHours(),
      local.getMinutes(),
      local.getSeconds(),
    );
    const diffMinutes = (naiveUtc - gpsUtc.getTime()) / 60_000;
    // Real offsets live within +/-14h. Anything else means one of the two tags
    // is garbage, so fall through rather than inventing a timezone.
    if (Math.abs(diffMinutes) <= 14 * 60) {
      // Round to the quarter hour: every real zone is a multiple of 15 minutes,
      // and the two clocks can drift by a second or two.
      const rounded = Math.round(diffMinutes / 15) * 15;
      return {
        takenUtc: instantFor(local, rounded).toISOString(),
        takenLocal,
        tzOffset: formatOffset(rounded),
        offsetSource: "gps-utc",
      };
    }
  }

  // 3. Fall back to where the photo was taken.
  if (venueOffsetMinutes !== null && Number.isFinite(venueOffsetMinutes)) {
    return {
      takenUtc: instantFor(local, venueOffsetMinutes).toISOString(),
      takenLocal,
      tzOffset: formatOffset(venueOffsetMinutes),
      offsetSource: "venue-timezone",
    };
  }

  // A wall-clock reading and nothing to anchor it. Keep it, flag it, do not
  // guess -- storing it as UTC is what produces 2am photos of night games.
  return { takenUtc: null, takenLocal, tzOffset: null, offsetSource: "none" };
}

/**
 * The UTC offset a timezone was actually in on a given date, in minutes.
 * Handles daylight saving, which is why it takes the date rather than assuming
 * a fixed offset per zone.
 */
export function venueOffsetMinutes(timeZone: string, on: Date): number | null {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = Object.fromEntries(dtf.formatToParts(on).map((p) => [p.type, p.value]));
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour === "24" ? "0" : parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    return Math.round((asUtc - on.getTime()) / 60_000);
  } catch {
    return null;
  }
}
