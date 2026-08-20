import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import * as schema from "./schema";

/**
 * One SQLite file, in DATA_DIR. Never on an SMB or NFS path -- SQLite's
 * locking is not safe there, and this file is the whole record.
 *
 * DATA_DIR is /config in the container. Locally it falls back to ./data, which
 * is gitignored.
 */
export function dbPath(): string {
  const dir = process.env.DATA_DIR ?? join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  return join(dir, "ballpark.db");
}

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!cached) {
    const sqlite = new Database(dbPath());
    // WAL keeps the background job worker from blocking reads mid-request.
    sqlite.pragma("journal_mode = WAL");
    // Referential integrity is off by default in SQLite. The whole point of
    // modelling franchises and venues separately is that the links hold.
    sqlite.pragma("foreign_keys = ON");
    cached = drizzle(sqlite, { schema });
  }
  return cached;
}

export { schema };
