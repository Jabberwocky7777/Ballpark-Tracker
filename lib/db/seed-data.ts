import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { venues, venueNames } from "../data/venues";
import { franchises, tenancies } from "../data/franchises";

/**
 * Loads the public reference data. Importable rather than a script, so the
 * container can bring an empty database up to a working state on first boot
 * without a separate command.
 *
 * Idempotent: every row upserts on its primary key. Running it against a live
 * database refreshes the reference data and touches no visit and no photo. It
 * never deletes anything except the venue-name rows, which have synthetic ids,
 * are pure reference data, and are pointed at by nothing.
 */
export function seedReferenceData(db: BetterSQLite3Database<typeof schema>): void {
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

    tx.delete(schema.venueNames).run();
    for (const n of venueNames) {
      tx.insert(schema.venueNames)
        .values({ venueId: n.venueId, name: n.name, validFrom: n.validFrom, validTo: n.validTo })
        .run();
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
  });
}
