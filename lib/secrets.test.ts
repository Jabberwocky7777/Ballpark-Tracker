import { test, describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { verify } from "@node-rs/argon2";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAdminPasswordHash, getSessionSecret, resetSecretCacheForTests } from "./secrets.ts";

const ARGON2ID = 2;
const original = { ...process.env };
const tempDirs: string[] = [];

function freshDataDir(): string {
  const d = mkdtempSync(join(tmpdir(), "ballpark-secrets-"));
  tempDirs.push(d);
  return d;
}

beforeEach(() => {
  resetSecretCacheForTests();
  delete process.env.SESSION_SECRET;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_PASSWORD_HASH;
  process.env.DATA_DIR = freshDataDir();
});

after(() => {
  Object.assign(process.env, original);
  for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
});

describe("session secret", () => {
  test("uses SESSION_SECRET when it is set", () => {
    process.env.SESSION_SECRET = "an-explicit-secret";
    assert.equal(getSessionSecret(), "an-explicit-secret");
  });

  test("generates and persists one when it is not", () => {
    const dir = process.env.DATA_DIR!;
    const secret = getSessionSecret();
    assert.ok(secret.length >= 40, "should be a real key, not a stub");
    assert.ok(existsSync(join(dir, "session.key")));
    assert.equal(readFileSync(join(dir, "session.key"), "utf8").trim(), secret);
  });

  test("reuses the persisted key across restarts, so nobody is signed out by a reboot", () => {
    const first = getSessionSecret();
    resetSecretCacheForTests(); // simulate a process restart, same DATA_DIR
    assert.equal(getSessionSecret(), first);
  });

  test("two installs do not share a key", () => {
    const a = getSessionSecret();
    resetSecretCacheForTests();
    process.env.DATA_DIR = freshDataDir();
    assert.notEqual(getSessionSecret(), a);
  });

  test("an explicit secret takes precedence over a persisted one", () => {
    const generated = getSessionSecret();
    resetSecretCacheForTests();
    process.env.SESSION_SECRET = "explicit-wins";
    assert.notEqual(getSessionSecret(), generated);
    assert.equal(getSessionSecret(), "explicit-wins");
  });
});

describe("admin password", () => {
  test("is null when neither variable is set, so nobody can sign in", async () => {
    assert.equal(await getAdminPasswordHash(), null);
  });

  test("uses ADMIN_PASSWORD_HASH verbatim when set", async () => {
    process.env.ADMIN_PASSWORD_HASH = "$argon2id$v=19$m=19456,t=2,p=1$abc$def";
    assert.equal(await getAdminPasswordHash(), "$argon2id$v=19$m=19456,t=2,p=1$abc$def");
  });

  test("derives an argon2id hash from ADMIN_PASSWORD", async () => {
    process.env.ADMIN_PASSWORD = "correcthorsebatterystaple";
    const h = await getAdminPasswordHash();
    assert.ok(h?.startsWith("$argon2id$"), `expected an argon2id digest, got ${h?.slice(0, 12)}`);
    assert.equal(await verify(h!, "correcthorsebatterystaple", { algorithm: ARGON2ID }), true);
    assert.equal(await verify(h!, "the wrong password", { algorithm: ARGON2ID }), false);
  });

  test("the explicit hash wins over the plaintext", async () => {
    process.env.ADMIN_PASSWORD = "plaintext-one";
    process.env.ADMIN_PASSWORD_HASH = "$argon2id$v=19$m=19456,t=2,p=1$abc$def";
    assert.equal(await getAdminPasswordHash(), "$argon2id$v=19$m=19456,t=2,p=1$abc$def");
  });

  test("hashes once and caches, since argon2 is deliberately slow", async () => {
    process.env.ADMIN_PASSWORD = "correcthorsebatterystaple";
    const a = await getAdminPasswordHash();
    const b = await getAdminPasswordHash();
    assert.equal(a, b, "a second call must not re-hash with a fresh salt");
  });

  test("an empty ADMIN_PASSWORD is treated as unset rather than as a blank password", async () => {
    process.env.ADMIN_PASSWORD = "";
    assert.equal(await getAdminPasswordHash(), null);
  });
});
