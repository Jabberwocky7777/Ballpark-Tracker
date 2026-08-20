/**
 * Deciding which park and which visit a photo belongs to.
 *
 * Distance alone answers this for maybe two thirds of a batch. The plan
 * (section 4.4) names two cheap signals for the rest, and both are here:
 *
 *   session clustering -- photos taken within four hours of each other are one
 *     evening at one park. If any of them matched confidently, the whole
 *     session did, including the ones taken on the concourse with no sky and
 *     therefore no GPS lock.
 *
 *   date matching -- a photo with no coordinates at all, taken on a date that
 *     already has exactly one recorded visit, is very likely from that visit.
 *     Very likely is why it is a suggestion and not an assignment.
 *
 * Nothing here writes anything. A suggestion is stored as a venue with a
 * `suggested` confidence and no visit, which is what puts it in front of a
 * human with one tap to confirm. Only `confident` assigns on its own.
 *
 * Pure: no database, no clock, no env. Every decision is re-runnable against a
 * better matcher later, which is why the raw distance is stored alongside it.
 */

import type { GeoMatch, MatchTier } from "../geo.ts";

export interface VisitRecord {
  id: string;
  venueId: string;
  /** "YYYY-MM-DD". */
  visitDate: string;
}

export interface Assignment {
  venueId: string | null;
  visitId: string | null;
  confidence: MatchTier;
  /** Why it landed where it did. Shown in the queue, kept for auditing. */
  reason: "gps-confident" | "gps-suggested" | "session" | "date-only" | "unmatched";
}

/**
 * @param match nearest venue by distance, or null when the photo has no GPS.
 * @param localDate the photo's local calendar date, "YYYY-MM-DD", or null.
 * @param visits every recorded visit. Small enough to pass whole.
 */
export function chooseAssignment(
  match: GeoMatch | null,
  localDate: string | null,
  visits: VisitRecord[],
): Assignment {
  if (match?.venueId && match.tier === "confident") {
    return {
      venueId: match.venueId,
      visitId: visitFor(match.venueId, localDate, visits),
      confidence: "confident",
      reason: "gps-confident",
    };
  }

  if (match?.venueId && match.tier === "suggested") {
    return {
      venueId: match.venueId,
      visitId: null,
      confidence: "suggested",
      reason: "gps-suggested",
    };
  }

  // No usable coordinates, or nothing within 2km. If the day itself is
  // unambiguous, propose it -- this is the DSLR and texted-photo path.
  if (localDate) {
    const sameDay = distinctVenues(visits.filter((v) => v.visitDate === localDate));
    if (sameDay.length === 1) {
      return {
        venueId: sameDay[0],
        visitId: null,
        confidence: "suggested",
        reason: "date-only",
      };
    }
  }

  return { venueId: null, visitId: null, confidence: "unmatched", reason: "unmatched" };
}

/** The visit at this venue on this date, when there is exactly one. */
function visitFor(venueId: string, localDate: string | null, visits: VisitRecord[]): string | null {
  if (!localDate) return null;
  const hits = visits.filter((v) => v.venueId === venueId && v.visitDate === localDate);
  return hits.length === 1 ? hits[0].id : null;
}

function distinctVenues(visits: VisitRecord[]): string[] {
  return [...new Set(visits.map((v) => v.venueId))];
}

// ------------------------------------------------------------- sessions ----

export interface SessionPhoto {
  id: string;
  /** ISO instant. Photos without one cannot be clustered by time. */
  takenUtc: string | null;
  assignment: Assignment;
}

export const SESSION_GAP_HOURS = 4;

/**
 * Groups photos into sessions by time gap, oldest first.
 *
 * Photos with no timestamp form no session -- each is returned on its own,
 * because a photo with neither GPS nor a clock has nothing to cluster on and
 * belongs in the queue rather than in someone else's evening.
 */
export function clusterSessions(
  photos: SessionPhoto[],
  gapHours: number = SESSION_GAP_HOURS,
): SessionPhoto[][] {
  const timed = photos
    .filter((p) => p.takenUtc)
    .sort((a, b) => (a.takenUtc as string).localeCompare(b.takenUtc as string));
  const untimed = photos.filter((p) => !p.takenUtc);

  const gapMs = gapHours * 3_600_000;
  const sessions: SessionPhoto[][] = [];

  for (const photo of timed) {
    const current = sessions.at(-1);
    const previous = current?.at(-1);
    const withinGap =
      previous !== undefined &&
      Date.parse(photo.takenUtc as string) - Date.parse(previous.takenUtc as string) <= gapMs;

    if (withinGap) (current as SessionPhoto[]).push(photo);
    else sessions.push([photo]);
  }

  return [...sessions, ...untimed.map((p) => [p])];
}

/**
 * Spreads a confident match across the session that contains it.
 *
 * Deliberately conservative in three ways: a session holding confident matches
 * to two different parks is left entirely alone, an already-confident photo is
 * never overwritten, and everything this promotes lands as `suggested` rather
 * than assigned. Time proximity is strong evidence, not proof, and the cost of
 * being wrong is a photo filed silently under the wrong park.
 */
export function propagateSessionMatches(
  photos: SessionPhoto[],
  gapHours: number = SESSION_GAP_HOURS,
): SessionPhoto[] {
  const promoted = new Map<string, Assignment>();

  for (const session of clusterSessions(photos, gapHours)) {
    const anchors = new Set(
      session
        .filter((p) => p.assignment.confidence === "confident" && p.assignment.venueId)
        .map((p) => p.assignment.venueId as string),
    );
    if (anchors.size !== 1) continue;

    const venueId = [...anchors][0];
    for (const photo of session) {
      if (photo.assignment.confidence === "confident") continue;
      if (photo.assignment.venueId === venueId) continue;
      promoted.set(photo.id, {
        venueId,
        visitId: null,
        confidence: "suggested",
        reason: "session",
      });
    }
  }

  return photos.map((p) => (promoted.has(p.id) ? { ...p, assignment: promoted.get(p.id) as Assignment } : p));
}
