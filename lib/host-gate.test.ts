import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { clientAddress, isProtectedPath, isPublicRequest, normaliseHost, shouldHide } from "./host-gate.ts";

const PUBLIC = "mlb.example.com";

describe("protected paths", () => {
  for (const p of ["/admin", "/admin/", "/admin/queue", "/api/upload", "/api/upload/batch", "/api/admin/export"]) {
    test(`${p} is protected`, () => assert.equal(isProtectedPath(p), true));
  }

  for (const p of ["/", "/park/wrigley-field", "/repeated", "/api/health"]) {
    test(`${p} is public`, () => assert.equal(isProtectedPath(p), false));
  }

  test("a path that merely starts with the same letters is not protected", () => {
    // /administrator and /api/uploads-info must not be swept up by a loose prefix match.
    assert.equal(isProtectedPath("/administrator"), false);
    assert.equal(isProtectedPath("/api/uploads-info"), false);
  });

  test("the guest upload route stays public -- it is the one deliberate exception", () => {
    assert.equal(isProtectedPath("/api/guest/abc123"), false);
  });
});

describe("public request detection", () => {
  test("matches the configured hostname", () => {
    assert.equal(isPublicRequest(PUBLIC, PUBLIC), true);
  });

  test("ignores case, since Host is case-insensitive", () => {
    assert.equal(isPublicRequest("MLB.Example.COM", PUBLIC), true);
  });

  test("ignores a port on the Host header", () => {
    assert.equal(isPublicRequest(`${PUBLIC}:443`, PUBLIC), true);
  });

  test("a tailnet or LAN host is not public", () => {
    assert.equal(isPublicRequest("100.64.0.1:8080", PUBLIC), false);
    assert.equal(isPublicRequest("nas.tailnet-example.internal:8080", PUBLIC), false);
    assert.equal(isPublicRequest("localhost:3000", PUBLIC), false);
  });

  test("a different subdomain is not the public host", () => {
    assert.equal(isPublicRequest("other.example.com", PUBLIC), false);
    // Guard against a suffix match: evil-mlb.example.com must not count.
    assert.equal(isPublicRequest("evil-mlb.example.com", PUBLIC), false);
  });

  test("a missing Host header is not treated as public", () => {
    assert.equal(isPublicRequest(null, PUBLIC), false);
    assert.equal(isPublicRequest(undefined, PUBLIC), false);
  });

  test("with PUBLIC_HOSTNAME unset nothing is public, which is local development", () => {
    assert.equal(isPublicRequest(PUBLIC, undefined), false);
  });
});

describe("normaliseHost", () => {
  test("keeps an IPv6 literal intact", () => {
    assert.equal(normaliseHost("[::1]:3000"), "[::1]");
    assert.equal(normaliseHost("[::1]"), "[::1]");
  });

  test("strips only a numeric port", () => {
    assert.equal(normaliseHost("host:8080"), "host");
    assert.equal(normaliseHost("host"), "host");
  });
});

describe("shouldHide", () => {
  test("hides admin from the public hostname", () => {
    assert.equal(shouldHide("/admin/queue", PUBLIC, PUBLIC), true);
  });

  test("lets admin through over the tailnet", () => {
    assert.equal(shouldHide("/admin/queue", "100.64.0.1:8080", PUBLIC), false);
  });

  test("never hides the public site itself", () => {
    assert.equal(shouldHide("/park/wrigley-field", PUBLIC, PUBLIC), false);
  });

  test("never hides the guest upload route", () => {
    assert.equal(shouldHide("/api/guest/abc", PUBLIC, PUBLIC), false);
  });
});

describe("clientAddress", () => {
  const PROXY = "172.18.0.5";

  test("ignores X-Forwarded-For from an untrusted peer", () => {
    // The header is trivially forged; only the real peer counts here.
    assert.equal(clientAddress("1.2.3.4", "9.9.9.9", PROXY), "9.9.9.9");
  });

  test("honours X-Forwarded-For only from the proxy", () => {
    assert.equal(clientAddress("1.2.3.4", PROXY, PROXY), "1.2.3.4");
  });

  test("takes the last hop, since earlier entries can be forged by the client", () => {
    assert.equal(clientAddress("evil, 1.2.3.4", PROXY, PROXY), "1.2.3.4");
  });

  test("falls back to the peer when no proxy is configured", () => {
    assert.equal(clientAddress("1.2.3.4", "9.9.9.9", undefined), "9.9.9.9");
  });

  test("never returns empty, so a rate-limit bucket always exists", () => {
    assert.equal(clientAddress(null, null, undefined), "unknown");
  });
});
