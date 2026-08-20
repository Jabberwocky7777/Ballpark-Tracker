#!/usr/bin/env node
/**
 * Runs the photo job queue to empty and stops.
 *
 * The app runs the same worker in-process, so this is not needed in normal
 * operation. It is for the two moments when it is: after a `--no-derivatives`
 * import, and after a batch of jobs failed for a reason since fixed -- a
 * missing decoder, a full disk -- when you want to watch them go through
 * rather than trust that a background loop got to them.
 *
 *   npm run jobs:drain
 */

import { drainAll } from "../lib/jobs/worker.ts";
import { pendingCount } from "../lib/jobs/queue.ts";

const waiting = pendingCount();
if (waiting === 0) {
  console.log("Nothing pending.");
  process.exit(0);
}

console.log(`${waiting} job(s) pending. Working through them.`);
const done = await drainAll((n) => process.stdout.write(`  ${n}\r`));
console.log(`\n${done} job(s) processed. ${pendingCount()} still pending.`);
