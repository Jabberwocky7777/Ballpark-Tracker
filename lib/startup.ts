import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { join } from "node:path";
import { getDb, dbPath } from "./db/index.ts";
import { seedReferenceData } from "./db/seed-data.ts";
import { startWorker } from "./jobs/worker.ts";

/**
 * Migrations, reference-data seeding, and a one-line statement of how the admin
 * surface is protected, at boot.
 *
 * Here rather than in a container entrypoint script because Next traces the
 * root instrumentation.ts through to this file and into the standalone
 * output. A separate script would need its
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
 * The background worker that decodes photos and writes derivatives.
 *
 * In-process and serial. It starts after migrations because its first act is
 * to requeue anything a restart stranded mid-decode, which needs the tables to
 * exist. A failure to start is logged rather than thrown: derivatives are
 * regenerable, and a site that serves its existing pages is better than one
 * that refuses to boot because image processing is unhappy.
 */
try {
  startWorker();
} catch (err) {
  console.error("[startup] the photo job worker did not start:", err);
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
