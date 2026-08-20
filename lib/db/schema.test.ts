import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * These assert the guarantees the counters depend on, at the database level
 * rather than in application code. `tenancies.is_temporary` and
 * `visits.attended_game` must never acquire a default: a silent 0 there would
 * quietly mis-count every team on the site.
 */

let dir: string;
let sqlite: InstanceType<typeof Database>;

before(() => {
  dir = mkdtempSync(join(tmpdir(), "ballpark-schema-"));
  sqlite = new Database(join(dir, "test.db"));
  sqlite.pragma("foreign_keys = ON");
  migrate(drizzle(sqlite), { migrationsFolder: join(process.cwd(), "drizzle") });
});

after(() => {
  sqlite.close();
  rmSync(dir, { recursive: true, force: true });
});

const seedVenue = () =>
  sqlite
    .prepare(
      "insert or ignore into venues (id,slug,name,city,state,lat,lng,timezone,opened_year,fingerprint) values ('v','v','V','C','ST',40,-80,'America/New_York',1990,0)",
    )
    .run();

const seedFranchise = () =>
  sqlite
    .prepare("insert or ignore into franchises (id,name,abbrev,league,division) values ('f','F','F','AL','East')")
    .run();

describe("schema guarantees", () => {
  test("tenancies.is_temporary has no default and cannot be omitted", () => {
    seedVenue();
    seedFranchise();
    assert.throws(
      () =>
        sqlite
          .prepare(
            "insert into tenancies (id,franchise_id,venue_id,start_year,is_current) values ('t1','f','v',2000,1)",
          )
          .run(),
      /NOT NULL constraint failed: tenancies.is_temporary/,
    );
  });

  test("visits.attended_game has no default and cannot be omitted", () => {
    seedVenue();
    assert.throws(
      () =>
        sqlite
          .prepare("insert into visits (id,venue_id,visit_date) values ('vi1','v','2024-07-14')")
          .run(),
      /NOT NULL constraint failed: visits.attended_game/,
    );
  });

  test("a photo is private by default", () => {
    sqlite
      .prepare(
        "insert into photos (id,sha256,original_filename,stored_path,uploaded_by) values ('p1','abc','a.heic','x','user_a')",
      )
      .run();
    const row = sqlite.prepare("select is_public, needs_review, home_guard_flag from photos where id='p1'").get() as {
      is_public: number;
    };
    assert.equal(row.is_public, 0, "every photo must land private, whoever uploaded it");
  });

  test("sha256 is unique, so the same photo cannot be stored twice", () => {
    assert.throws(
      () =>
        sqlite
          .prepare(
            "insert into photos (id,sha256,original_filename,stored_path,uploaded_by) values ('p2','abc','dup.heic','y','user_b')",
          )
          .run(),
      /UNIQUE constraint failed: photos.sha256/,
    );
  });

  test("foreign keys are enforced, so a visit cannot point at a missing venue", () => {
    assert.throws(
      () =>
        sqlite
          .prepare("insert into visits (id,venue_id,visit_date,attended_game) values ('vi2','nope','2024-07-14',1)")
          .run(),
      /FOREIGN KEY constraint failed/,
    );
  });

  test("venue slugs are unique, since they are the public URL", () => {
    assert.throws(
      () =>
        sqlite
          .prepare(
            "insert into venues (id,slug,name,city,state,lat,lng,timezone,opened_year,fingerprint) values ('v2','v','Other','C','ST',40,-80,'America/New_York',1990,0)",
          )
          .run(),
      /UNIQUE constraint failed: venues.slug/,
    );
  });
});
