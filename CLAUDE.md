# CLAUDE.md

Project context for Claude Code. Read this before making changes.

---

## This repository is public

Assume anything committed here is permanent and indexed. A later `git rm` does not unpublish it. **The repo holds code and public reference data only.**

Never commit:

| Category | Examples | Where it lives instead |
|---|---|---|
| Secrets | `SESSION_SECRET`, `ADMIN_PASSWORD_HASH`, API keys | runtime env, set in the app wizard |
| Home location | `HOME_LAT`, `HOME_LNG` | env only — never a default, fixture, test constant, or comment |
| Infrastructure | the public hostname, tailnet names, LAN/NAS IPs, the app's host port, pool and dataset paths, proxy config | env + `docs/private/` |
| Personal data | photos, originals, derivatives, the database, exports, EXIF dumps, sample images | the storage datasets, mounted at runtime |
| Names | real first names as identifiers | `user_a` / `user_b` in the database; display names from `USER_A_NAME` / `USER_B_NAME` |

Deployment specifics that genuinely matter during a deploy live in `docs/private/deploy.md`, which is gitignored. `docs/deploy.example.md` is the committed, placeholder version.

Before any push: `git ls-files` must contain no `.env`, no `*.db`, no photos, and nothing under `docs/private/`. CI enforces this with `scripts/check-no-secrets.sh`, but check anyway.

**Never write a site-specific identifier into a committed file — not even as a search pattern, a test fixture, an example, or a comment.** The real domain, the pool names, the app port and the two first names live in `scripts/private-patterns.txt`, which is gitignored, and in the `EXTRA_SECRET_PATTERNS` repository secret for CI. The gate scans every tracked file including itself, so putting one back will fail the build. This rule exists because an earlier gate excluded itself from its own scan and therefore published the very identifiers it was written to catch.

Seed data for MLB franchises and venues **is** public reference data and belongs in the repo. It's the one dataset that does.

---

## Workflow — do not push without being asked

**Never `git push` unless Brendan explicitly asks for it in that message.** Commit freely; pushing is his call, every time.

The loop is: he brings a tweak, it gets fixed and checked locally, he looks at it, and only then does it go to GitHub. A push triggers CI, publishes a new image, and turns a local experiment into something he has to redeploy — so it is his decision, not a step to tidy up at the end of a task.

"Everything is committed and ready to push whenever you want it" is the correct way to finish. Asking "shall I push?" every time is not needed either; just stop at the commit.

---

## What this is

A self-hosted web app tracking one couple's mission to attend a game at every MLB ballpark. Two users. Public read-only site; private admin surface. Runs as a Docker container on TrueNAS SCALE, exposed at a subdomain via nginx-proxy-manager.

Photos are uploaded from iPhones. Embedded EXIF GPS and timestamps are used to auto-assign each photo to a ballpark and a visit date.

Full spec: `docs/plan.md`. Design: `docs/design-brief.md` and `docs/look-and-feel.md`. Decision log: `docs/decisions.md`.

---

## Decisions — settled, don't relitigate

- **Upload is Tailscale/LAN only.** The public site is served through the reverse proxy; upload and admin are not reachable from it.
- **Every photo is private until published.** `is_public = 0` at ingest, for every uploader. Publishing is always a deliberate act.
- **Team checked off only via a game attended at a permanent home park.** Temporary venues check off the ballpark, not the team.
- **Renames change nothing. Moved teams stay checked off**, with a quiet asterisk on the new park.
- **Two counters, teams as the headline.**
- **The map is the dashboard.**
- **Metadata lives in the database only** — nothing is ever written into files on the storage pools.
- **The map is an Albers USA SVG (`d3-geo`), not a tile map.** No MapLibre, no Google Maps, no tile provider. Thirty fixed points on a styled US outline is an SVG problem, and it keeps the dark map well in `docs/look-and-feel.md` achievable with no external network dependency at render time.

---

## The check-off rule

This is the core business logic. Every counter on the site depends on it.

**A team is checked off when a game has been attended at that franchise's current, permanent home ballpark.**

| Situation | Result |
|---|---|
| Attended a game at a permanent home park | Team ✅, ballpark ✅ |
| Saw the building, no game attended | Neither ✅ (still record the visit) |
| Attended a game at a **temporary** venue | Ballpark ✅, team ❌ |
| Team moves to a new permanent park, not yet visited | Team stays ✅, new park gets a quiet asterisk |
| Venue renamed | Nothing changes. Same building, same checks, no asterisk. |

Test cases that must pass:
- A's at Sutter Health Park (temporary) → ballpark ✅, Athletics ❌
- A's at the new Las Vegas park, game attended → Athletics ✅
- Rays at Steinbrenner Field 2025 (temporary) → ballpark ✅, Rays ❌
- Rays at Tropicana Field, game attended → Rays ✅
- Rays open a new park in 2029 → Rays stay ✅, asterisk on the new park

Implementation rules:
- One pure function, `computeProgress(visits, tenancies, venues)` in `lib/progress.ts`. No DB access, no framework imports. Do **not** scatter this logic across views or components.
- `tenancies.is_temporary` and `visits.attended_game` are `NOT NULL` with no default. Never default either silently.
- Two counters, always shown together, teams as the headline: `Teams 14 / 30`, `Ballparks 16 / 34`.
- Display the venue name that was current on the visit date, via `venue_names`.
- Asterisk styling stays quiet. It reads as "here's something new," never as an error or a nag.

---

## Deployment

Docker container, built by GitHub Actions and pushed to GHCR. Installed on TrueNAS SCALE via the **Custom App wizard** — never from a Dockerfile or compose file executed on the NAS itself. The image carries zero secrets; all config arrives as runtime env, which is what makes a public image package safe.

Portable rules:

- All paths come from env (`DATA_DIR`, `ORIGINALS_DIR`, `DERIVED_DIR`). Never hardcode a host path.
- The config dataset must exist **before** install. The wizard will not create it.
- Do not set PUID/PGID — TrueNAS assigns them.
- Timezone comes from the wizard's TZ selector, not a `TZ` env var.
- Every host path mount needs an ACL entry granting the apps user full control, with Enable ACL checked.
- `chmod` and `setfacl` are no-ops on ZFS NFSv4 ACLs. ACLs are set in the TrueNAS UI only.
- Never use a folder created through an SMB share as a mount source. Create a real dataset.
- SQLite lives on a local dataset. Never on an SMB or NFS path.

**Real paths, ports, hostnames, ACL steps, and proxy config: `docs/private/deploy.md`. Not in this repo.**

---

## Hard rules

**Never write metadata into files on the storage pools.** No EXIF rewriting, no sidecar JSON, no auto-move on metadata update. All derived data lives in the database. This is unsupported on this storage and risks corruption.

**Originals are immutable.** Written once at ingest, never modified, never moved by the app. Derivatives are regenerable and disposable.

**Admin and upload routes are not public.** The reverse proxy is the primary gate: it serves only the public read-only routes and blocks `/admin`, `/api/upload*` and `/api/admin*`. A real login (argon2id, secure session cookie) sits behind that.

The app can *optionally* help. Set `PUBLIC_HOSTNAME` and middleware compares the request `Host` against it; on a match those paths return **404** — not 403, which would confirm they exist. Unset, the app does no host gating at all and says so at startup, leaving the proxy solely responsible. Both postures are supported; what is not supported is believing the app is gating when it isn't, which is why it logs which one is in force.

`X-Forwarded-For` is trusted only when the peer address is `TRUSTED_PROXY_IP`, which is also optional and only affects login rate-limit bucketing. The guest upload endpoint is the one deliberate public exception.

**Every photo is private until published.** `is_public = 0` at ingest regardless of uploader. The home-coordinate guard is an additional, louder flag on top of that — not the only gate.

**Strip EXIF from every publicly served image.** Coordinates and timestamps live in the database only. Never expose raw coordinates publicly — stadium-level location only.

**Home-coordinate guard.** Any photo whose GPS falls within `HOME_GUARD_KM` of `HOME_LAT`/`HOME_LNG` is flagged for review. The guard reads env and no-ops when unset; the coordinates never appear in the repo.

**Validate uploads by magic bytes, not extension.** Cap file size and count. Never build a filesystem path from user input — serve photos via opaque app-generated IDs.

**Guest uploads:** per-trip token, hashed at rest, hard caps on count and bytes, 14-day default expiry, strict independent rate limit. Guest photos always land in a review queue. Attribute via `photos.uploaded_by` so a bad batch can be removed in one query.

---

## Out of scope — do not build

Considered and explicitly cut. Do not reintroduce, even if they seem like a natural fit:

- Photo book / PDF export
- Home Assistant integration
- Game-day live mode
- Food or beer price tracking
- Team logos and team colors as the organizing visual system
- Achievement badges, trophies, gamification
- Progress bars and percentage rings for the counters
- Multi-user accounts, minor league parks (possible later, not now)

---

## Technical notes

- **HEIC decoding is a known risk.** `sharp`'s prebuilt binaries often ship without libheif. Verify decoding inside the target container image, not on a dev machine. Fallbacks: `heic-convert`, or a Python `pillow-heif` sidecar. Resolved choice is recorded in `docs/decisions.md`.
- **Timestamps:** `DateTimeOriginal` is local wall-clock with no timezone. Use `OffsetTimeOriginal` when present, cross-check against `GPSDateStamp`/`GPSTimeStamp` (true UTC), fall back to the matched venue's timezone. Store UTC instant, local wall-clock, and the offset used. Display local.
- **Geo-matching tiers:** <400m auto-assign; 400m–2km suggest and require confirmation; >2km unassigned queue. Store raw coordinates and the confidence tier so matching can be re-run later.
- **Expect 20–40% of photos to have no usable GPS.** The manual assignment queue is a primary interface, not a fallback. Bulk assignment is required.
- **Decode and derivative generation go in a background job queue**, never in an HTTP request.
- **Dedupe on SHA-256 of original bytes.** The same photo will be uploaded more than once.
- **StatsAPI** (`statsapi.mlb.com/api/v1/schedule`) auto-fills the game from date + venue. Unofficial — cache locally, never a render-time dependency.
- **SQLite**, single file in `DATA_DIR`. No Redis.

---

## Conventions

- TypeScript, Next.js App Router, Tailwind, `d3-geo` for the map.
- Business logic in pure functions with unit tests, not in components.
- Ask before adding a dependency.

### Design tokens

Full rationale in `docs/look-and-feel.md`. One warm cream surface throughout — there is no dark screen any more, and no light/dark split between the map and the park pages. The map's inset well is the only surface variation.

```
--ink             #0f1b2e   headings, pin outlines, primary dark text
--ink-body        #33372a   body copy and notes
--paper           #f3efe4   page and card background
--paper-inset     #ece4d0   the map's inset well
--paper-line      #d9d2b8   borders, dividers, card outlines
--muted           #8a7a52   secondary text, labels, links
--not-done-stroke #a89a6e   hollow pin stroke
--accent          #e0713f   "done" — solid pin fill and the 2px card top bar, nothing else
--accent-hover    #c65a2a
--gold            #d9a441   ONLY the asterisk dot
white             #ffffff   elevated cards on paper
```

**Two accents total.** Orange means done, gold means the asterisk caveat. Never a third. Do not reintroduce a second near-black or a second muted brown — those were deliberately collapsed into one token each.

Three fonts: **Oswald** 600/700, uppercase and tracked (wordmark, park names, page titles, section labels — it reads as scoreboard rather than generic app), **Public Sans** (body), **Space Grotesk** with `tabular-nums` (counters, dates, scores, seats).

Avoid Inter, Roboto, Arial, Fraunces, collegiate block letters, and MLB's trademarked navy/red palette.

**Never use team logos or wordmarks anywhere.** They are trademarked regardless of personal or non-commercial use. The pin shapes are original stylized outlines, not traced from any single real park and not text badges — both of those were tried and reverted.

**Pin states are shape-coded, never colour-only** — they must stay distinguishable in greyscale:

1. Done — outline filled `--accent`, `--ink` stroke
2. Done + asterisk — same, plus a small solid `--gold` dot at top-right
3. Not done — outline only, `--not-done-stroke`, transparent fill, ~2px
4. Temporary venue — hollow outline, dashed stroke

**Hover preview:** hovering a pin shows a small card with an image slot and the park name. The image comes from the couple's own published photos. **Never scrape or hot-link third-party ballpark photos** — aerial-photo directories are copyrighted. The slot stays empty until they upload something.

Accessibility is non-negotiable: visible keyboard focus on every interactive element, `prefers-reduced-motion` respected, and layouts that survive missing or private photos without holes.

### Copy voice

Plain, warm, specific, sentence case. Never breathless. Empty states are invitations — an unvisited park says something concrete about what goes there. "Not yet," never "No data available." Errors say what happened and what to do; they don't apologize. Two-voice content renders as two side-by-side columns, never merged into one paragraph.

---

## Backups

The photos are irreplaceable — a media library can be re-downloaded, a photo of a specific evening at a specific park cannot. Any change touching originals or the database must be safe to re-run and must never delete originals. Keep the admin export endpoint (DB + JSON manifest of photo hash → stadium/date/caption) working; it's the portability guarantee.
