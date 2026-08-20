import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { join } from "node:path";
import { getDb, dbPath } from "./lib/db";
import { seedReferenceData } from "./lib/db/seed-data";

/**
 * Migrations and reference-data seeding, at boot.
 *
 * Here rather than in a container entrypoint script because Next traces this
 * file's imports into the standalone output. A separate script would need its
 * dependencies shipped by hand -- exactly the mistake that left the atlas JSON
 * out of the image earlier, which built cleanly and died at runtime.
 *
 * Both steps are idempotent, so a restart is always safe.
 */
try {
  const db = getDb();
  migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
  seedReferenceData(db);
  console.log(`[startup] database ready at ${dbPath()}`);
} catch (err) {
  // Fail loudly. A half-migrated database serving wrong counters is worse than
  // a container that refuses to start.
  console.error("[startup] database initialisation failed:", err);
  throw err;
}
