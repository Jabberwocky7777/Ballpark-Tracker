/**
 * Applies pending migrations.
 *
 *   npm run db:migrate
 *
 * The server also migrates on boot via lib/startup.ts, so this is not
 * needed in production. It exists because `npm run db:seed` needs tables to
 * exist, and on a fresh checkout you may want to seed before ever starting the
 * dev server.
 *
 * Safe to re-run: drizzle records what it has applied.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const dir = process.env.DATA_DIR ?? join(process.cwd(), "data");
mkdirSync(dir, { recursive: true });
const file = join(dir, "ballpark.db");

const sqlite = new Database(file);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

migrate(drizzle(sqlite), { migrationsFolder: join(process.cwd(), "drizzle") });
sqlite.close();

console.log(`Migrations applied to ${file}`);
