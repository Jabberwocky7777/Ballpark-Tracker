import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "./index.ts";
import type { Franchise, Tenancy, Trip, Venue, Visit } from "../types";

/**
 * The boundary between the database and the pure domain logic.
 *
 * computeProgress takes plain objects and knows nothing about Drizzle or
 * SQLite. These functions do the row-to-domain mapping -- notably turning
 * SQLite's integer booleans back into real booleans -- so that stays true.
 */

const toBool = (n: number) => n === 1;

export function getFranchises(): Franchise[] {
  return getDb()
    .select()
    .from(schema.franchises)
    .orderBy(asc(schema.franchises.name))
    .all() as Franchise[];
}

export function getVenues(): Venue[] {
  return getDb().select().from(schema.venues).orderBy(asc(schema.venues.name)).all() as Venue[];
}

export function getTenancies(): Tenancy[] {
  return getDb()
    .select()
    .from(schema.tenancies)
    .all()
    .map((t) => ({ ...t, isTemporary: toBool(t.isTemporary), isCurrent: toBool(t.isCurrent) }));
}

/**
 * Every visit, published or not. Admin only.
 *
 * The public pages must use the `getPublic*` variants below. A visit is
 * private until deliberately published, exactly like a photo, and rendering an
 * unpublished one would leak the notes, the seats and the date.
 */
export function getAllVisits(): Visit[] {
  return getDb().select().from(schema.visits).orderBy(desc(schema.visits.visitDate)).all().map(mapVisit);
}

export function getPublicVisits(): Visit[] {
  return getDb()
    .select()
    .from(schema.visits)
    .where(eq(schema.visits.isPublic, 1))
    .orderBy(desc(schema.visits.visitDate))
    .all()
    .map(mapVisit);
}

export function getPublicVisitsForVenue(venueId: string): Visit[] {
  return getDb()
    .select()
    .from(schema.visits)
    .where(and(eq(schema.visits.venueId, venueId), eq(schema.visits.isPublic, 1)))
    .orderBy(desc(schema.visits.visitDate))
    .all()
    .map(mapVisit);
}

/** Published photos for a visit, in a stable order. */
export function getPublicPhotosForVisit(visitId: string): PhotoSummary[] {
  return getDb()
    .select({
      id: schema.photos.id,
      caption: schema.photos.caption,
      role: schema.photos.role,
      width: schema.photos.width,
      height: schema.photos.height,
    })
    .from(schema.photos)
    .where(and(eq(schema.photos.visitId, visitId), eq(schema.photos.isPublic, 1)))
    .orderBy(asc(schema.photos.createdAt))
    .all();
}

/**
 * One published photo per venue, for the map's hover preview.
 *
 * Prefers a photo explicitly marked as the hero. Returns a map of venue id to
 * photo id so the dashboard does one query rather than thirty-five.
 */
export function getPublicHeroPhotoByVenue(): Map<string, string> {
  const rows = getDb()
    .select({
      venueId: schema.photos.venueId,
      id: schema.photos.id,
      isHero: schema.photos.isHero,
    })
    .from(schema.photos)
    .where(eq(schema.photos.isPublic, 1))
    .orderBy(desc(schema.photos.isHero), asc(schema.photos.createdAt))
    .all();

  const out = new Map<string, string>();
  for (const r of rows) {
    if (r.venueId && !out.has(r.venueId)) out.set(r.venueId, r.id);
  }
  return out;
}

export interface PhotoSummary {
  id: string;
  caption: string | null;
  role: string;
  width: number | null;
  height: number | null;
}

export function getVenueBySlug(slug: string): Venue | undefined {
  return getDb().select().from(schema.venues).where(eq(schema.venues.slug, slug)).get() as
    | Venue
    | undefined;
}

export function getTrips(): Trip[] {
  return getDb().select().from(schema.trips).orderBy(desc(schema.trips.startDate)).all().map((t) => ({
    ...t,
    notes: t.notes ?? undefined,
  }));
}

/** The name that was on the building on a given date. Falls back to current. */
export function getVenueNameOn(venueId: string, date: string): string {
  const rows = getDb()
    .select()
    .from(schema.venueNames)
    .where(eq(schema.venueNames.venueId, venueId))
    .all();
  const match = rows.find((n) => n.validFrom <= date && (n.validTo === null || date < n.validTo));
  if (match) return match.name;
  return getDb().select().from(schema.venues).where(eq(schema.venues.id, venueId)).get()?.name ?? "Unknown venue";
}

type VisitRow = typeof schema.visits.$inferSelect;

function mapVisit(v: VisitRow): Visit {
  return {
    id: v.id,
    venueId: v.venueId,
    tripId: v.tripId,
    visitDate: v.visitDate,
    attendedGame: toBool(v.attendedGame),
    homeTeamId: v.homeTeamId ?? undefined,
    awayTeamId: v.awayTeamId ?? undefined,
    homeScore: v.homeScore ?? undefined,
    awayScore: v.awayScore ?? undefined,
    seatSection: v.seatSection ?? undefined,
    seatRow: v.seatRow ?? undefined,
    weatherTempF: v.weatherTempF ?? undefined,
    weatherDesc: v.weatherDesc ?? undefined,
    notesUserA: v.notesUserA ?? undefined,
    notesUserB: v.notesUserB ?? undefined,
    isPublic: toBool(v.isPublic),
  };
}
