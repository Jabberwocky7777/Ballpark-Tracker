import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { join } from "node:path";
import { getDb, dbPath } from "./lib/db";
import { seedReferenceData } from "./lib/db/seed-data";

/**
 * Migrations, reference-data seeding, and a one-line statement of how the admin
 * surface is protected, at boot.
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

/**
 * Say out loud which of the two admin postures is in force. Getting this wrong
 * silently is the failure worth preventing: an admin surface you believe is
 * hidden but is not.
 */
if (process.env.PUBLIC_HOSTNAME) {
  console.log(
    `[startup] admin is host-gated: requests arriving as ${process.env.PUBLIC_HOSTNAME} ` +
      `get 404 for /admin and /api/upload*`,
  );
} else {
  console.log(
    "[startup] admin is NOT host-gated (no PUBLIC_HOSTNAME set). " +
      "Your reverse proxy must block /admin, /api/upload and /api/admin, " +
      "or they are reachable wherever this app is. The login still applies.",
  );
}

if (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH) {
  console.warn(
    "[startup] no ADMIN_PASSWORD set -- nobody can sign in to the admin side. " +
      "Add it in the app's settings and restart.",
  );
}
