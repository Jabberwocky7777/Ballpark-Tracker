import "server-only";
import { hash } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Where the two secrets come from.
 *
 * The person deploying this fills in a form in a NAS web UI. Asking them to run
 * a CLI to produce an argon2 digest and a base64 key is a bad trade: it is two
 * more chances to get it wrong, and it makes redeploying on a new machine a
 * research project. So both have a sane automatic path, and the explicit
 * variables still win when they are set.
 */

const ARGON2ID = 2;

// -------------------------------------------------------------- session ----

let cachedSessionSecret: string | null = null;

/**
 * `SESSION_SECRET` if set, otherwise a random key generated once and kept in
 * DATA_DIR.
 *
 * Persisting it matters: a secret regenerated on every boot would silently sign
 * everyone out on each restart and each update, which reads as a bug. The file
 * sits on the config dataset next to the database, so it is covered by the same
 * snapshots.
 */
export function getSessionSecret(): string {
  if (cachedSessionSecret) return cachedSessionSecret;

  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv) {
    cachedSessionSecret = fromEnv;
    return cachedSessionSecret;
  }

  const dataDir = process.env.DATA_DIR ?? join(process.cwd(), "data");
  const keyPath = join(dataDir, "session.key");

  try {
    if (existsSync(keyPath)) {
      const existing = readFileSync(keyPath, "utf8").trim();
      if (existing) {
        cachedSessionSecret = existing;
        return cachedSessionSecret;
      }
    }

    mkdirSync(dirname(keyPath), { recursive: true });
    const generated = randomBytes(32).toString("base64");
    writeFileSync(keyPath, generated, { mode: 0o600 });
    try {
      chmodSync(keyPath, 0o600);
    } catch {
      // Best effort. ZFS ACLs govern this path, and chmod is a no-op there.
    }
    console.log(`[startup] generated a session key at ${keyPath}`);
    cachedSessionSecret = generated;
    return cachedSessionSecret;
  } catch (err) {
    // If the config mount is not writable we cannot persist a key. Fall back to
    // an in-memory one so the app still runs, and say so plainly -- signing out
    // on restart is confusing enough to deserve a log line.
    console.error(
      `[startup] could not persist a session key at ${keyPath}; using a temporary one. ` +
        `Sessions will not survive a restart. Set SESSION_SECRET to fix this.`,
      err,
    );
    cachedSessionSecret = randomBytes(32).toString("base64");
    return cachedSessionSecret;
  }
}

// -------------------------------------------------------------- password ---

let cachedAdminHash: string | null | undefined;

/**
 * `ADMIN_PASSWORD_HASH` if set, otherwise an argon2id digest of
 * `ADMIN_PASSWORD`, computed once and held in memory.
 *
 * Hashing a plaintext that is already sitting in env buys nothing
 * cryptographically -- anyone who can read the environment has the password.
 * It is done anyway so there is exactly one verification path, and because
 * argon2's deliberate slowness still blunts online guessing, on top of the
 * login throttle.
 *
 * The trade is real and worth stating: with ADMIN_PASSWORD the password is
 * visible to anyone who can open the app's config in the NAS UI or run
 * `docker inspect`. For a two-person app that is already unreachable from the
 * internet, that is an acceptable price for not needing a terminal.
 */
export async function getAdminPasswordHash(): Promise<string | null> {
  if (cachedAdminHash !== undefined) return cachedAdminHash;

  const explicit = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (explicit) {
    cachedAdminHash = explicit;
    return cachedAdminHash;
  }

  const plain = process.env.ADMIN_PASSWORD;
  if (!plain) {
    cachedAdminHash = null;
    return cachedAdminHash;
  }

  cachedAdminHash = await hash(plain, {
    algorithm: ARGON2ID,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  return cachedAdminHash;
}

/** For tests, which need to change env between cases. */
export function resetSecretCacheForTests(): void {
  cachedSessionSecret = null;
  cachedAdminHash = undefined;
}
