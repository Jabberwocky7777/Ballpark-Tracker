/**
 * CLI wrapper around the reference-data seed.
 *
 *   npm run db:seed            reference data only
 *   npm run db:seed -- --demo  also loads the invented visits, for development
 *
 * The container does not need this: it seeds reference data on boot via
 * instrumentation.ts. This exists for local development and for loading the
 * demo visits, which never run in production.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { join } from "node:path";
import * as schema from "../lib/db/schema.ts";
import { seedReferenceData } from "../lib/db/seed-data.ts";
import { demoTrips, demoVisits } from "../lib/data/demo-visits.ts";

const withDemo = process.argv.includes("--demo");
const dir = process.env.DATA_DIR ?? join(process.cwd(), "data");
const sqlite = new Database(join(dir, "ballpark.db"));
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

seedReferenceData(db);

if (withDemo) {
  const bool = (b: boolean) => (b ? 1 : 0);
  db.transaction((tx) => {
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
  });
}

const count = (t: string) => (sqlite.prepare(`select count(*) as n from ${t}`).get() as { n: number }).n;
console.log(
  `Seeded: ${count("franchises")} franchises, ${count("venues")} venues, ` +
    `${count("venue_names")} historical names, ${count("tenancies")} tenancies, ` +
    `${count("visits")} visits, ${count("trips")} trips`,
);
if (!withDemo) console.log("Reference data only. Pass --demo for the invented visits.");
sqlite.close();
