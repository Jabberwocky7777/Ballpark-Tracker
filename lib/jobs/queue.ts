import "server-only";
import { and, asc, eq, lt } from "drizzle-orm";
import { getDb, schema } from "../db/index.ts";

/**
 * A job queue in the database, because the alternative is Redis and this app
 * has one process and one SQLite file.
 *
 * It exists for one reason: decoding a 12MP HEIC and writing two derivatives
 * takes seconds, and a 50-photo batch would time out through the proxy long
 * before it finished. Ingest writes the original and the row, enqueues, and
 * returns. Everything slow happens after the response.
 */

export type JobKind = "derivatives";
export type JobStatus = "pending" | "running" | "done" | "failed";

export interface Job {
  id: number;
  kind: string;
  payload: unknown;
  attempts: number;
}

/** Three tries, then it stops and waits for a human. */
export const MAX_ATTEMPTS = 3;

export function enqueue(kind: JobKind, payload: unknown): number {
  const row = getDb()
    .insert(schema.jobs)
    .values({ kind, payloadJson: JSON.stringify(payload) })
    .returning({ id: schema.jobs.id })
    .get();
  return row.id;
}

/**
 * Takes the oldest pending job and marks it running, in one transaction.
 *
 * The transaction is what makes a second worker safe -- two of them cannot
 * claim the same row and generate the same derivative twice.
 */
export function claimNext(): Job | null {
  return getDb().transaction((tx) => {
    const row = tx
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.status, "pending"))
      .orderBy(asc(schema.jobs.createdAt), asc(schema.jobs.id))
      .limit(1)
      .get();

    if (!row) return null;

    tx.update(schema.jobs)
      .set({ status: "running", attempts: row.attempts + 1 })
      .where(eq(schema.jobs.id, row.id))
      .run();

    let payload: unknown = null;
    try {
      payload = JSON.parse(row.payloadJson);
    } catch {
      // A row we cannot even read is not worth retrying twice more.
      payload = null;
    }

    return { id: row.id, kind: row.kind, payload, attempts: row.attempts + 1 };
  });
}

export function markDone(id: number): void {
  getDb()
    .update(schema.jobs)
    .set({ status: "done", error: null })
    .where(eq(schema.jobs.id, id))
    .run();
}

/**
 * Back to pending for another try, or parked as failed once the attempts are
 * spent. A failed job keeps its error text: derivatives are regenerable, so
 * the recovery is to fix the cause and requeue, and that needs the reason.
 */
export function markFailed(id: number, attempts: number, error: unknown): void {
  const message = String((error as Error)?.message ?? error).slice(0, 2000);
  const status: JobStatus = attempts >= MAX_ATTEMPTS ? "failed" : "pending";

  getDb().update(schema.jobs).set({ status, error: message }).where(eq(schema.jobs.id, id)).run();
}

/**
 * Anything left `running` when the process died gets another go.
 *
 * Called once at boot. Without it a container restart mid-decode leaves a
 * photo with no derivatives and nothing that will ever produce them --
 * silently, which is the worst version of this bug.
 */
export function requeueStranded(): number {
  const stranded = getDb()
    .update(schema.jobs)
    .set({ status: "pending" })
    .where(and(eq(schema.jobs.status, "running"), lt(schema.jobs.attempts, MAX_ATTEMPTS)))
    .returning({ id: schema.jobs.id })
    .all();

  return stranded.length;
}

export function pendingCount(): number {
  return getDb().select().from(schema.jobs).where(eq(schema.jobs.status, "pending")).all().length;
}
