# Decision log

Append-only. New decisions go at the bottom with a date. If a decision is reversed, strike it and add a new entry explaining why — don't delete history.

---

## 2026-08-19 — Upload path: Tailscale/LAN only

Uploading requires being on the tailnet. The public site is still served through nginx-proxy-manager at the public hostname.

**Why:** removes the entire "someone found my upload form" attack class, and sidesteps the reverse proxy's body-size and timeout problems for large photo batches. The cost is turning Tailscale on before uploading from a phone, which is a one-tap habit.

**Mechanism:** middleware compares the request `Host` to `PUBLIC_HOSTNAME`. Match → `/admin` and `/api/upload*` return 404. Spoofing the header requires already being on the tailnet or LAN, where the argon2id login is the second lock.

---

## 2026-08-19 — Every photo is private until published

`is_public = 0` at ingest for every uploader, not just guests.

**Why:** a public feed of geotagged, timestamped photos is a published record of when the house is empty. Publishing should be a deliberate act, and a mis-tagged photo should never be live before a human has seen it. The home-coordinate guard becomes an additional, louder flag rather than the only gate.

---

## 2026-08-19 — Public subdomain

The site is served at a subdomain of the personal domain. The actual hostname is set via `PUBLIC_HOSTNAME` and recorded in `docs/private/deploy.md`. Nothing in the code depends on the specific name.

---

## 2026-08-19 — The repo is public; nothing of value is committed

**Why:** the code is worth sharing and there's no reason to keep it private, but the specs as originally written were a map of the homelab — pool names, dataset paths, which ports are free and taken, and an explicit statement of the backup posture.

**Consequence:** the original specs live in the gitignored `docs/private/`. `docs/plan.md` is a sanitized copy. Secrets, home coordinates, hostnames, paths, and ports come from env. Personal names never appear as identifiers — the database stores `user_a` / `user_b`, and display names resolve from env at render time. CI enforces this with `gitleaks` plus a grep gate.

---

## 2026-08-19 — Map is an Albers USA SVG, not a tile map

`d3-geo`'s `geoAlbersUsa` projection over a bundled TopoJSON US outline. No MapLibre, no tile provider, no API key.

**Why:** the design calls for a dark `--ink-deep` well with park-fingerprint pins carrying the state system. A slippy tile map brings its own visual language, an external network dependency at render time, and basemap styling that fights the pins. Thirty fixed points on a styled outline is an SVG problem, and SVG server-renders cleanly for link previews.

**Revisit if:** the road-trip planner needs genuine pan/zoom geography. That's the only case where MapLibre earns its weight.

---

## 2026-08-19 — SQLite via Drizzle, migrations committed

`better-sqlite3` + `drizzle-orm`, both named in the stack section of the plan. Migrations are generated with `drizzle-kit` into `drizzle/` and **committed** — the schema history is part of the repo, and the container applies pending migrations on start.

**Why `NOT NULL` with no default on two columns:** `tenancies.is_temporary` and `visits.attended_game` decide every counter on the site. A default of 0 on either would silently produce wrong totals rather than an error, so the database refuses to guess. There are tests asserting the constraint at the SQL level, not just in application code.

`photos.is_public` does the opposite and defaults to 0 — private is the safe direction, and a photo that somehow skips the application path should still land private.

The seed script is idempotent: every row is upserted by primary key, so re-running it updates the public reference data without touching a single visit or photo, and it never deletes.

---

## 2026-08-19 — Two independent locks on the admin surface

**Lock one, the middleware.** Compares the request `Host` to `PUBLIC_HOSTNAME`. On a match, `/admin`, `/api/upload*` and `/api/admin*` return **404** — never 403, which would confirm the routes exist. The decision is a pure function in `lib/host-gate.ts` with tests covering ports, casing, IPv6 literals, missing headers, and near-miss hostnames like `evil-mlb.example.com`.

**Lock two, the session.** argon2id password check, then an HMAC-signed cookie. They are genuinely independent: a *valid* session presented over the public hostname still gets a 404. Verified end to end.

**Choices worth recording:**

- `@node-rs/argon2` rather than `argon2` — prebuilt bindings, so neither the Windows dev machine nor the image needs a node-gyp toolchain.
- Sessions are signed, not encrypted, and use `node:crypto` directly. There is nothing secret in "somebody logged in", and a JWT library would be more surface area for no gain.
- The session cookie is `Secure` **only** over HTTPS. Admin is reached over Tailscale on plain HTTP, and an unconditional `Secure` flag would mean the cookie is never sent — login would fail in exactly the deployment this app targets.
- `X-Forwarded-For` is honoured only when the peer is `TRUSTED_PROXY_IP`, and only the **last** hop is taken; earlier entries are client-supplied and forgeable.
- Login throttling is in-memory, not a table. Two users, one process, and a failed-login table is one more thing to back up. It resets on restart, which is acceptable behind a private network.
- Every login failure returns one identical message. Distinguishing "no password configured" from "wrong password" is free reconnaissance.

---

## 2026-08-19 — Review pass: what the audit changed

A full read-through against the plan, looking for bugs, dead code, and anything that existed without a reason.

**Bugs fixed:**

- The public pages rendered every visit regardless of `visits.is_public`, leaking the notes, seats and date of an unpublished visit. Public routes now read published visits only; admin reads everything. The counters follow the same rule: publishing is what puts a visit on the public site, including in the totals.
- The park page rendered a fixed number of grey tiles as stand-in photos. It now reads the `photos` table and says plainly when nothing is published, rather than implying photos exist.
- `/api/photo/[id]/[variant]` did not exist, so the photo grid pointed at a 404. It exists now, and it is where the opaque-id and path-containment rules live.

**Dead code removed:** `venueById`, `venueBySlug`, `venueNameOn` and `franchiseById` in `lib/data/`, all orphaned when the pages moved to the database.

**A comment that lied:** `lib/data/venues.ts` claimed coordinates were checked by `scripts/check-coords.mjs`, which did not exist. It does now — `npm run check:coords` projects all 35 venues and fails if one lands outside the state its record claims. Negative-tested against a transposed lat/lng and a wrong-state shift.

**Duplication removed:** the timestamp resolver lived inside the spike, where the ingest pipeline would have had to reimplement it. It is now `lib/timestamp.ts`, shared by both — a spike that predicts what ingest will do cannot do so with its own second implementation.

**Plan algorithms that existed only as prose,** now built as pure tested modules ahead of the pipeline that needs them: the geo-matching tiers (`lib/geo.ts`), timestamp resolution with its three-tier offset fallback (`lib/timestamp.ts`), and the home-coordinate guard, which no-ops when the coordinates are unset so they never need to appear in the repository.

---

## 2026-08-20 — Secrets you can type into a form

The admin surface originally required an argon2id digest and a base64 key, both produced by a CLI. That is a bad trade for someone configuring this through a NAS web UI: two more chances to get it wrong, and redeploying on a new machine becomes a research project.

- `ADMIN_PASSWORD` accepts a plaintext password and is hashed with argon2id once at startup, in memory. `ADMIN_PASSWORD_HASH` still wins when set.
- `SESSION_SECRET` is optional. Unset, the app generates 32 random bytes on first boot and persists them to `DATA_DIR/session.key`. Persisting matters: a per-boot secret would sign everyone out on every restart and update, which reads as a bug.

**The trade, stated plainly:** a plaintext password in env is readable by anyone who can open the app's config in the NAS UI or run `docker inspect`. For a two-person app already unreachable from the internet, behind a login throttle, that is an acceptable price for not needing a terminal. The hashed path remains for anyone who disagrees.

Hashing a plaintext that already sits in env buys nothing cryptographically -- whoever reads the environment has the password. It is done anyway so there is one verification path, and because argon2's slowness still blunts online guessing.

Tests for these run with `--conditions=react-server` so modules guarded by `server-only` are importable, the same way Next resolves them on the server.

---

## Open — HEIC decode path

To be resolved by the Phase 0 spike, run inside the built container image. Candidates in order: `sharp` with a libvips build including libheif → `heic-convert` → a Python `pillow-heif` sidecar. All three are present in the `spike` image target so one run evaluates all of them.

**How to run it.** CI publishes the spike image on every push to `main`. On any machine with Docker and a folder of real photos off both phones:

```bash
docker run --rm -v /path/to/photos:/in:ro ghcr.io/<owner>/ballpark-tracker:main-spike /in
```

It reads only — it writes nothing, moves nothing, and never modifies the input files. It prints per-file GPS, timestamp, and decode results, then a summary and a verdict.

**Record the winner here**, with the timing numbers and the no-GPS percentage, before writing any UI. If none of the three work in-container, the spike exits non-zero — the stack changes and the plan needs revisiting.

Note the spike is also the first real measurement of the 20–40% no-GPS estimate in `docs/plan.md` §4.1. If it comes back much worse, the manual assignment queue needs more design attention than Phase 3 currently budgets.
