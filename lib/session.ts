import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Session tokens: `<issuedAt>.<expiresAt>.<nonce>.<hmac>`.
 *
 * Signed, not encrypted -- there is nothing secret in a session that says
 * "somebody logged in", and a signature is enough to prove the server issued
 * it. No dependency: an HMAC over a fixed-shape payload is the whole job, and
 * a JWT library here would be more surface area for no benefit.
 *
 * Pure and dependency-free so it can be tested directly.
 */

const SEP = ".";

export interface SessionOptions {
  secret: string;
  /** Session lifetime in seconds. */
  ttlSeconds?: number;
}

export const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 14;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(
  { secret, ttlSeconds = DEFAULT_TTL_SECONDS }: SessionOptions,
  now = Date.now(),
): string {
  if (!secret) throw new Error("SESSION_SECRET is not set");
  const issued = Math.floor(now / 1000);
  const expires = issued + ttlSeconds;
  const nonce = randomBytes(16).toString("base64url");
  const payload = `${issued}${SEP}${expires}${SEP}${nonce}`;
  return `${payload}${SEP}${sign(payload, secret)}`;
}

export function verifySessionToken(
  token: string | undefined | null,
  secret: string,
  now = Date.now(),
): boolean {
  if (!token || !secret) return false;

  const parts = token.split(SEP);
  if (parts.length !== 4) return false;

  const [issuedRaw, expiresRaw, nonce, providedSig] = parts;
  if (!/^\d+$/.test(issuedRaw) || !/^\d+$/.test(expiresRaw) || !nonce) return false;

  const expected = sign(`${issuedRaw}${SEP}${expiresRaw}${SEP}${nonce}`, secret);

  // Length-check first: timingSafeEqual throws on a length mismatch, and the
  // length of a signature is not a secret.
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!timingSafeEqual(a, b)) return false;

  const nowSeconds = Math.floor(now / 1000);
  if (nowSeconds >= Number(expiresRaw)) return false;
  // A token issued in the future means a tampered or badly-clocked issuer.
  if (Number(issuedRaw) > nowSeconds + 60) return false;

  return true;
}

export const SESSION_COOKIE = "bp_session";

/**
 * `secure` is conditional on purpose: the admin surface is reached over
 * Tailscale on plain HTTP, and a Secure cookie would simply never be sent, so
 * login would fail in exactly the deployment this app targets.
 */
export function sessionCookieOptions(isHttps: boolean, ttlSeconds = DEFAULT_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isHttps,
    path: "/",
    maxAge: ttlSeconds,
  };
}
