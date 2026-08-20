/**
 * Runs once when the server boots, before it serves anything.
 *
 * The real work is in lib/startup.ts, imported only inside this branch.
 * NEXT_RUNTIME is replaced with a literal at build time, so for the edge
 * bundle the whole branch is dead code and the import is never resolved. An
 * early `return` instead of this shape does not work: webpack still walks the
 * imports and fails trying to bundle better-sqlite3's `fs` for edge.
 *
 * This file has to sit in the project root -- it is where Next looks for it --
 * which is why it is a four-line shim rather than the boot sequence itself.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/startup");
  }
}
