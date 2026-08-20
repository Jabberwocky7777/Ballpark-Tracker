/**
 * Loads the public reference data -- franchises, venues, historical names and
 * tenancies -- into the database.
 *
 *   npm run db:seed          reference data only
 *   npm run db:seed -- --demo  also loads the invented visits, for development
 *
 * Idempotent by design. Every row is upserted on its primary key, so running
 * this against a live database updates the reference data without touching a
 * single visit or photo. It never deletes anything.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { join } from "node:path";
import * as schema from "../lib/db/schema.ts";
import { venues, venueNames } from "../lib/data/venues.ts";
import { franchises, tenancies } from "../lib/data/franchises.ts";
import { demoTrips, demoVisits } from "../lib/data/demo-visits.ts";

const withDemo = process.argv.includes("--demo");

const dir = process.env.DATA_DIR ?? join(process.cwd(), "data");
const sqlite = new Database(join(dir, "ballpark.db"));
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

const bool = (b: boolean) => (b ? 1 : 0);

db.transaction((tx) => {
  for (const f of franchises) {
    tx.insert(schema.franchises).values(f).onConflictDoUpdate({ target: schema.franchises.id, set: f }).run();
  }

  for (const v of venues) {
    const row = {
      id: v.id,
      slug: v.slug,
      name: v.name,
      city: v.city,
      state: v.state,
      lat: v.lat,
      lng: v.lng,
      timezone: v.timezone,
      openedYear: v.openedYear,
      closedYear: v.closedYear,
      fingerprint: v.fingerprint,
    };
    tx.insert(schema.venues).values(row).onConflictDoUpdate({ target: schema.venues.id, set: row }).run();
  }

  // venue_names has a synthetic id, so it can't be upserted by key. Replace the
  // whole set: it is reference data, and nothing else points at these rows.
  tx.delete(schema.venueNames).run();
  for (const n of venueNames) {
    tx.insert(schema.venueNames).values({
      venueId: n.venueId,
      name: n.name,
      validFrom: n.validFrom,
      validTo: n.validTo,
    }).run();
  }

  for (const t of tenancies) {
    const row = {
      id: t.id,
      franchiseId: t.franchiseId,
      venueId: t.venueId,
      startYear: t.startYear,
      endYear: t.endYear,
      isTemporary: bool(t.isTemporary),
      isCurrent: bool(t.isCurrent),
    };
    tx.insert(schema.tenancies).values(row).onConflictDoUpdate({ target: schema.tenancies.id, set: row }).run();
  }

  if (withDemo) {
    for (const t of demoTrips) {
      tx.insert(schema.trips).values(t).onConflictDoUpdate({ target: schema.trips.id, set: t }).run();
    }
    for (const v of demoVisits) {
      const row = {
        id: v.id,
        venueId: v.venueId,
        tripId: v.tripId,
        visitDate: v.visitDate,
        attendedGame: bool(v.attendedGame),
        homeTeamId: v.homeTeamId ?? null,
        awayTeamId: v.awayTeamId ?? null,
        homeScore: v.homeScore ?? null,
        awayScore: v.awayScore ?? null,
        seatSection: v.seatSection ?? null,
        seatRow: v.seatRow ?? null,
        weatherTempF: v.weatherTempF ?? null,
        weatherDesc: v.weatherDesc ?? null,
        notesUserA: v.notesUserA ?? null,
        notesUserB: v.notesUserB ?? null,
        isPublic: bool(v.isPublic),
      };
      tx.insert(schema.visits).values(row).onConflictDoUpdate({ target: schema.visits.id, set: row }).run();
    }
  }
});

const count = (t: string) => (sqlite.prepare(`select count(*) as n from ${t}`).get() as { n: number }).n;
console.log(
  `Seeded: ${count("franchises")} franchises, ${count("venues")} venues, ` +
    `${count("venue_names")} historical names, ${count("tenancies")} tenancies, ` +
    `${count("visits")} visits, ${count("trips")} trips`,
);
if (!withDemo) console.log("Reference data only. Pass --demo for the invented visits.");
sqlite.close();
