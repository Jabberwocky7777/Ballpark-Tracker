/**
 * Distance maths and the geo-matching tiers from docs/plan.md section 4.4.
 *
 * Pure and dependency-free: no database, no env read, no framework. The ingest
 * pipeline and the home-coordinate guard both sit on top of this, and both are
 * decisions that have to be re-runnable and auditable later.
 */

export interface Coordinate {
  lat: number;
  lng: number;
}

/** Distance in metres between two coordinates. */
export function haversineMetres(a: Coordinate, b: Coordinate): number {
  const R = 6_371_008.8; // mean Earth radius, metres
  const toRad = (d: number) => (d * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * How much a match can be trusted.
 *
 *   confident  under 400m  — assign it, no human involved
 *   suggested  400m to 2km — the parking lot, the tailgate, the bar across the
 *                            street. Propose it and require one tap.
 *   unmatched  beyond 2km  — the manual assignment queue
 */
export type MatchTier = "confident" | "suggested" | "unmatched";

export const CONFIDENT_METRES = 400;
export const SUGGESTED_METRES = 2_000;

export function tierForDistance(metres: number): MatchTier {
  if (metres < CONFIDENT_METRES) return "confident";
  if (metres <= SUGGESTED_METRES) return "suggested";
  return "unmatched";
}

export interface MatchCandidate extends Coordinate {
  id: string;
}

export interface GeoMatch {
  venueId: string | null;
  distanceMetres: number | null;
  tier: MatchTier;
}

/**
 * Nearest venue to a photo's coordinate, with its tier.
 *
 * Returns the venue even when the tier is `unmatched`, so the distance can be
 * stored and the decision re-run later against a better matcher. A null
 * venueId means there were no candidates at all.
 */
export function matchVenue(point: Coordinate, candidates: MatchCandidate[]): GeoMatch {
  let best: MatchCandidate | null = null;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    const d = haversineMetres(point, candidate);
    if (d < bestDistance) {
      bestDistance = d;
      best = candidate;
    }
  }

  if (!best) return { venueId: null, distanceMetres: null, tier: "unmatched" };
  return { venueId: best.id, distanceMetres: bestDistance, tier: tierForDistance(bestDistance) };
}

/**
 * The home-coordinate guard.
 *
 * A public feed of geotagged, timestamped photos is a published record of when
 * the house is empty. Anything taken within the radius is flagged for review.
 *
 * Returns false when home is not configured -- the guard reads env, and the
 * coordinates never appear in the repository. That is a deliberate no-op, not
 * a silent failure: every photo is private at ingest regardless, so the guard
 * is an additional louder flag rather than the only gate.
 */
export function isNearHome(
  point: Coordinate | null | undefined,
  home: Partial<Coordinate> | null | undefined,
  radiusKm: number,
): boolean {
  if (!point || !home) return false;
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return false;
  if (!Number.isFinite(home.lat) || !Number.isFinite(home.lng)) return false;
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) return false;

  return haversineMetres(point, home as Coordinate) <= radiusKm * 1000;
}

/**
 * Reads the guard's configuration from env. Absent values disable it.
 *
 * Takes a plain record rather than NodeJS.ProcessEnv so the tests can pass a
 * bare object, and so this module stays free of Node's type surface.
 */
export function homeGuardFromEnv(
  env: Record<string, string | undefined> = process.env,
): {
  home: Coordinate | null;
  radiusKm: number;
} {
  const lat = Number.parseFloat(env.HOME_LAT ?? "");
  const lng = Number.parseFloat(env.HOME_LNG ?? "");
  const radiusKm = Number.parseFloat(env.HOME_GUARD_KM ?? "2");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { home: null, radiusKm };
  return { home: { lat, lng }, radiusKm: Number.isFinite(radiusKm) ? radiusKm : 2 };
}
