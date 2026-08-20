import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createSessionToken, verifySessionToken, sessionCookieOptions } from "./session.ts";

const SECRET = "test-secret-not-a-real-one";
const NOW = 1_700_000_000_000;

describe("session tokens", () => {
  test("a freshly issued token verifies", () => {
    const t = createSessionToken({ secret: SECRET }, NOW);
    assert.equal(verifySessionToken(t, SECRET, NOW), true);
  });

  test("a token signed with another secret is rejected", () => {
    const t = createSessionToken({ secret: "other-secret" }, NOW);
    assert.equal(verifySessionToken(t, SECRET, NOW), false);
  });

  test("a tampered payload is rejected", () => {
    const t = createSessionToken({ secret: SECRET }, NOW);
    const [issued, expires, nonce, sig] = t.split(".");
    // Push the expiry far into the future without re-signing.
    const forged = [issued, String(Number(expires) + 99999), nonce, sig].join(".");
    assert.equal(verifySessionToken(forged, SECRET, NOW), false);
  });

  test("an expired token is rejected", () => {
    const t = createSessionToken({ secret: SECRET, ttlSeconds: 60 }, NOW);
    assert.equal(verifySessionToken(t, SECRET, NOW + 61_000), false);
  });

  test("a token still inside its lifetime is accepted", () => {
    const t = createSessionToken({ secret: SECRET, ttlSeconds: 60 }, NOW);
    assert.equal(verifySessionToken(t, SECRET, NOW + 59_000), true);
  });

  test("a token issued in the future is rejected", () => {
    const t = createSessionToken({ secret: SECRET }, NOW + 600_000);
    assert.equal(verifySessionToken(t, SECRET, NOW), false);
  });

  test("malformed input is rejected rather than throwing", () => {
    for (const bad of ["", "a.b.c", "a.b.c.d.e", "....", "not-a-token", "1.2.3.4"]) {
      assert.equal(verifySessionToken(bad, SECRET, NOW), false, `should reject ${JSON.stringify(bad)}`);
    }
    assert.equal(verifySessionToken(undefined, SECRET, NOW), false);
    assert.equal(verifySessionToken(null, SECRET, NOW), false);
  });

  test("a signature of the wrong length is rejected without throwing", () => {
    // timingSafeEqual throws on mismatched lengths; this must be handled.
    const t = createSessionToken({ secret: SECRET }, NOW);
    const parts = t.split(".");
    parts[3] = "short";
    assert.doesNotThrow(() => verifySessionToken(parts.join("."), SECRET, NOW));
    assert.equal(verifySessionToken(parts.join("."), SECRET, NOW), false);
  });

  test("verification fails closed when no secret is configured", () => {
    const t = createSessionToken({ secret: SECRET }, NOW);
    assert.equal(verifySessionToken(t, "", NOW), false);
  });

  test("issuing without a secret throws rather than producing a forgeable token", () => {
    assert.throws(() => createSessionToken({ secret: "" }, NOW), /SESSION_SECRET/);
  });

  test("two tokens issued in the same second differ", () => {
    const a = createSessionToken({ secret: SECRET }, NOW);
    const b = createSessionToken({ secret: SECRET }, NOW);
    assert.notEqual(a, b, "the nonce must make each session distinct");
  });
});

describe("session cookie", () => {
  test("is always httpOnly and lax", () => {
    const o = sessionCookieOptions(true);
    assert.equal(o.httpOnly, true);
    assert.equal(o.sameSite, "lax");
  });

  test("is not Secure over plain HTTP, or Tailscale login would break", () => {
    assert.equal(sessionCookieOptions(false).secure, false);
    assert.equal(sessionCookieOptions(true).secure, true);
  });
});
