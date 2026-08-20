import "server-only";
import { verify } from "@node-rs/argon2";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./session";
import { clientAddress } from "./host-gate";

/** @node-rs/argon2 exports Algorithm as an ambient const enum, which cannot be
 *  referenced under isolatedModules. Argon2id is 2. */
const ARGON2ID = 2;

/**
 * Second lock. Tailscale keeps the surface off the internet; this stops anyone
 * already on the network from walking in.
 */

/** A deliberately slow, constant-ish failure path. */
export async function checkPassword(password: string): Promise<boolean> {
  const stored = process.env.ADMIN_PASSWORD_HASH;
  if (!stored) return false;
  try {
    return await verify(stored, password, { algorithm: ARGON2ID });
  } catch {
    // A malformed hash in env must read as "wrong password", never as a crash
    // that leaks a stack trace.
    return false;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value, secret);
}

/** Whether the current request arrived over TLS, for the cookie's Secure flag. */
export async function requestIsHttps(): Promise<boolean> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto");
  return proto === "https";
}

export async function currentClientAddress(): Promise<string> {
  const h = await headers();
  return clientAddress(
    h.get("x-forwarded-for"),
    h.get("x-real-ip") ?? h.get("x-forwarded-for"),
    process.env.TRUSTED_PROXY_IP,
  );
}

/**
 * In-memory login throttle. Deliberately not in the database: this is a
 * two-person app, the process is single, and a failed-login table would be one
 * more thing to back up. Resets on restart, which is acceptable for a lock
 * that already sits behind a private network.
 */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function throttleCheck(key: string, now = Date.now()): { allowed: boolean; retryInSeconds: number } {
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 0, first: now });
    return { allowed: true, retryInSeconds: 0 };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryInSeconds: Math.ceil((WINDOW_MS - (now - entry.first)) / 1000) };
  }
  return { allowed: true, retryInSeconds: 0 };
}

export function throttleRecordFailure(key: string, now = Date.now()): void {
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return;
  }
  entry.count += 1;
}

export function throttleReset(key: string): void {
  attempts.delete(key);
}
