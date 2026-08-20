import { inArray, notInArray } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.ts";
import { venues, venueNames } from "../data/venues.ts";
import { franchises, tenancies } from "../data/franchises.ts";

/**
 * Loads the public reference data. Importable rather than a script, so the
 * container can bring an empty database up to a working state on first boot
 * without a separate command.
 *
 * Idempotent: every row upserts on its primary key. Running it against a live
 * database refreshes the reference data and touches no visit and no photo.
 *
 * It does retire reference rows that have left the seed -- otherwise a park
 * removed from the list would linger in every existing database and keep
 * counting -- but never one that a visit or a photo points at.
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

    // Reconcile removals.
    //
    // Upsert alone cannot retire a park: dropping one from the seed would leave
    // its rows in every database that had already been seeded, still counting
    // toward the totals. So rows no longer in the seed are removed -- but only
    // when nothing points at them. A venue with a visit or a photo attached is
    // kept regardless, because a park somebody actually went to is their record
    // and is not the seed's to delete.
    const venueIds = venues.map((v) => v.id);
    const tenancyIds = tenancies.map((t) => t.id);

    tx.delete(schema.tenancies).where(notInArray(schema.tenancies.id, tenancyIds)).run();

    const referenced = new Set<string>();
    for (const r of tx.select({ id: schema.visits.venueId }).from(schema.visits).all()) {
      referenced.add(r.id);
    }
    for (const r of tx.select({ id: schema.photos.venueId }).from(schema.photos).all()) {
      if (r.id) referenced.add(r.id);
    }

    const stale = tx
      .select({ id: schema.venues.id })
      .from(schema.venues)
      .where(notInArray(schema.venues.id, venueIds))
      .all()
      .map((r) => r.id)
      .filter((id) => !referenced.has(id));

    if (stale.length > 0) {
      tx.delete(schema.venueNames).where(inArray(schema.venueNames.venueId, stale)).run();
      tx.delete(schema.venues).where(inArray(schema.venues.id, stale)).run();
      console.log(`[seed] retired ${stale.length} venue(s) no longer in the seed: ${stale.join(", ")}`);
    }
  });
}
