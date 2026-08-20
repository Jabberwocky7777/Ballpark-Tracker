/**
 * Decides whether a request arrived over the public internet or over the
 * tailnet/LAN.
 *
 * The architecture: the reverse proxy serves the public hostname and only ever
 * needs the read-only routes. Tailscale and LAN clients reach the container
 * directly on its port, so their Host header is an IP or a MagicDNS name, never
 * the public hostname. If the Host matches PUBLIC_HOSTNAME, /admin and
 * /api/upload* return 404 -- not 403, which would confirm they exist.
 *
 * Spoofing the header requires already being on the tailnet or LAN, where the
 * argon2id login is the second lock. This is defence in depth, not the only
 * wall.
 *
 * Pure, so it can be tested without a server.
 */

/** Paths that must never be reachable from the public hostname. */
const PROTECTED = [/^\/admin(?:\/|$)/, /^\/api\/upload(?:\/|$)/, /^\/api\/admin(?:\/|$)/];

/**
 * The one deliberate exception. Guest upload links must work for someone who
 * came along on a trip and has no account and no tailnet access, so this route
 * stays public and carries its own token, rate limit and byte caps.
 */
const PUBLIC_EXCEPTIONS = [/^\/api\/guest(?:\/|$)/];

export function isProtectedPath(pathname: string): boolean {
  if (PUBLIC_EXCEPTIONS.some((re) => re.test(pathname))) return false;
  return PROTECTED.some((re) => re.test(pathname));
}

/**
 * Compare a request's Host header against the configured public hostname.
 *
 * The Host header carries a port when it is non-default, and is
 * case-insensitive per RFC 9110, so both are normalised. An IPv6 literal in
 * brackets is handled by only stripping a port that follows the final colon
 * when there is no bracket.
 */
export function normaliseHost(host: string | null | undefined): string {
  if (!host) return "";
  const trimmed = host.trim().toLowerCase();
  if (trimmed.startsWith("[")) {
    // [::1]:3000 -> [::1]
    const close = trimmed.indexOf("]");
    return close === -1 ? trimmed : trimmed.slice(0, close + 1);
  }
  const colon = trimmed.lastIndexOf(":");
  // Only strip if what follows is actually a port, so "::1" survives intact.
  if (colon !== -1 && /^\d+$/.test(trimmed.slice(colon + 1))) return trimmed.slice(0, colon);
  return trimmed;
}

export function isPublicRequest(host: string | null | undefined, publicHostname: string | undefined): boolean {
  // Unset means local development, where there is no public surface at all.
  // Deployment always sets it; the startup check below makes the gap loud.
  if (!publicHostname) return false;
  return normaliseHost(host) === normaliseHost(publicHostname);
}

/** True when this request must be answered with a 404. */
export function shouldHide(
  pathname: string,
  host: string | null | undefined,
  publicHostname: string | undefined,
): boolean {
  return isProtectedPath(pathname) && isPublicRequest(host, publicHostname);
}

/**
 * The client address to rate-limit on.
 *
 * X-Forwarded-For is attacker-controlled unless the immediate peer is the
 * proxy, so it is honoured only from TRUSTED_PROXY_IP and only the last hop is
 * taken -- earlier entries in the list can be forged by the client.
 */
export function clientAddress(
  forwardedFor: string | null | undefined,
  peerAddress: string | null | undefined,
  trustedProxyIp: string | undefined,
): string {
  const peer = (peerAddress ?? "").trim();
  if (!trustedProxyIp || peer !== trustedProxyIp.trim()) return peer || "unknown";
  const hops = (forwardedFor ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  return hops.length > 0 ? hops[hops.length - 1] : peer || "unknown";
}
