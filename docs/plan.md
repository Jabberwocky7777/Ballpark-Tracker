# Ballpark Tracker — Project Plan & Build Spec

> **Sanitized for a public repository.** Deployment specifics — real pool and dataset paths, the host port, hostnames, the reverse-proxy configuration, and the current backup posture — are replaced with placeholders here and live in `docs/private/deploy.md`, which is gitignored.

---

## 1. What we're building

A self-hosted web app that tracks one couple's progress visiting every MLB ballpark.

**Core loop:** upload iPhone photos → read embedded EXIF GPS + timestamp → auto-assign each photo to a ballpark and a visit date → render a public gallery + progress map.

**Deployment:** Docker image built in CI, deployed on TrueNAS SCALE via the **Custom App wizard** (no compose file on the NAS), public read-only at a subdomain through nginx-proxy-manager. Admin/upload surface stays private.

**Explicit non-goals (v1):** general photo management, video hosting, multi-user accounts, minor league tracking (see §8 for later).

---

## 2. Deployment constraints — read before writing code

| Constraint | Detail |
|---|---|
| **Install method** | Not in the TrueNAS Community App Store, so this is a **Custom App**. Build the image in GitHub Actions, push to GHCR, point the wizard at the tag. Never a Dockerfile/compose run directly on the NAS. |
| **Create the config dataset FIRST** | The wizard will not create it, and fixing paths afterward is miserable. |
| **PUID/PGID** | Do not set. TrueNAS assigns them. |
| **Timezone** | Use the wizard's TZ selector, not a `TZ` env var. |
| **ACLs on every host path mount** | Custom Apps do *not* handle permissions automatically. Each volume mount needs Enable ACL checked and a full-control entry for the apps user. |
| **ACL editing** | `chmod`/`setfacl` do nothing on ZFS NFSv4 ACLs. Use Storage → Datasets → Edit Permissions, with **Apply recursively** and **Apply to child datasets**. |
| **No SMB-created folders** | Anything created through an SMB share gets the wrong ownership and blocks the container. Create real datasets. |
| **Never write metadata into files on the pools** | No EXIF rewriting, no sidecar JSON, no auto-move-on-update. All derived data lives in the app database. |
| **Port** | `<APP_PORT>` — see the private deploy doc. Must not collide with existing apps. |

### Storage layout

All three are host-path mounts configured in the wizard. The app only ever knows the container paths, supplied as env.

| Purpose | Host path | Mount | Env |
|---|---|---|---|
| App config + SQLite DB | `<CONFIG_DATASET>` | `/config` | `DATA_DIR` |
| Original photos (immutable) | `<MEDIA_DATASET>/originals` | `/photos/originals` | `ORIGINALS_DIR` |
| Generated derivatives | `<MEDIA_DATASET>/derived` | `/photos/derived` | `DERIVED_DIR` |

The database and the photos deliberately live in the same pool, so the whole app is a single cheap unit to snapshot and replicate offsite.

---

## 3. ⚠️ Backups — solve this before uploading a single photo

Ballpark photos are the first genuinely **irreplaceable** thing here — media libraries can be re-downloaded, financial records can be re-entered from statements, but a photo of a specific evening at a specific park cannot be regenerated. A mirrored pool survives one dead drive; it does not survive a controller fault, a bad `zfs destroy`, ransomware, or a flooded basement.

Treat this as a hard prerequisite, not a phase 5 nice-to-have:

1. **ZFS periodic snapshots** on the config and media datasets — hourly retain 48, daily retain 30. Free, five minutes of work, covers the entire "oops" class of loss.
2. **Offsite cloud sync** (Backblaze B2 or Storj) of the originals dataset + a nightly DB dump. The originals dataset should stay in the low single-digit GB range, so this costs a few dollars a year.
3. **In-app export endpoint** — an admin button producing a zip of the SQLite DB + a JSON manifest mapping every photo hash to its stadium/date/caption. Makes the data portable even if the app dies.
4. Keep originals write-once. Derivatives are disposable and can be excluded from backup.

---

## 4. The hard problems

### 4.1 iPhone will fight you over EXIF

The single biggest risk to the whole premise. The GPS data the app depends on is stripped or mangled in several very common paths:

- **The share sheet strips location by default-ish.** Photos → share sheet → **Options → Location** toggle. If it's off, coordinates are gone before the file reaches the server, and the two phones will have different settings.
- **HEIC vs JPEG.** With Camera set to "High Efficiency," photos are HEIC. Safari's file picker sometimes hands over the original HEIC, sometimes an auto-transcoded JPEG, depending on iOS version and how it's invoked. Both paths need to work.
- **Anything routed through Messages, WhatsApp, Instagram, or most cloud shares is already stripped.** A photo arriving via text from a friend at the game has no GPS.
- **Camera location permission** must have been on at capture time. Older photos may predate that.
- **Screenshots, scans, AirDropped images, DSLR photos** have no GPS at all.

**Mitigations to build in:**
- A documented "upload the right way" flow — from Safari on the phone, share sheet with Location **on**, or upload from the Files app.
- On upload, immediately report per-file: `GPS found / no GPS / date only`. Fail loudly and visibly, not silently.
- A manual assignment queue is **mandatory**, not optional. Assume 20–40% of photos land there.
- Bulk-assign: select many photos → assign all to one stadium/visit. This is how the DSLR/screenshot/texted-photo pile gets handled.
- Import path for an Apple Photos album export (which preserves EXIF reliably) as the high-fidelity bulk route for the existing backlog.

### 4.2 HEIC decoding

`sharp`'s prebuilt binaries frequently ship **without** libheif due to HEVC licensing. Do not assume it works — this is a **Phase 0 spike**, before any UI is written. Options in order of preference:

1. Node + `sharp` with a libvips build that includes libheif (verify in the container, not on a laptop).
2. Node + `heic-convert` (pure JS, slower but dependable) as a fallback path.
3. Python sidecar with `pillow-heif` — the most reliable option if 1 and 2 disappoint.

Decode work goes in a **background job queue**, never in the HTTP request. A 50-photo batch of 12MP HEICs will otherwise time out through the proxy.

### 4.3 Timestamps and timezones

- `DateTimeOriginal` is **local wall-clock with no timezone**. Naively storing it as UTC will show a 7:05pm first pitch as a 2am photo.
- iPhones (Exif 2.31+) also write `OffsetTimeOriginal` — use it when present.
- `GPSDateStamp`/`GPSTimeStamp` are true UTC — an excellent cross-check when the offset is missing.
- Fallback: derive the timezone from the matched stadium's known timezone.
- **Store all three**: UTC instant, local wall-clock string, and the offset used. Display local.

### 4.4 Geo-matching photos to stadiums

Haversine distance against the venue coordinates, but with tiers rather than a single radius:

| Distance from venue center | Treatment |
|---|---|
| < 400 m | Auto-assign, confident |
| 400 m – 2 km | Suggest, require one-tap confirm (parking lots, the tailgate, the bar across the street) |
| > 2 km | Unassigned queue |

Improve the middle tier with two cheap signals:
- **Session clustering** — group photos with < 4h gaps into a single session; if any photo in the session is a confident match, propose the whole session.
- **Date matching** — if a photo's date already has a confirmed visit, weight that stadium heavily.

Store the raw coordinates and the confidence tier so decisions are auditable and re-runnable when the matcher improves.

### 4.5 Public exposure

The app is internet-facing. Each of these matters:

- **Never expose the upload endpoint publicly.** The proxy serves only the public read-only routes; `/admin` and `/api/upload*` are reachable **only over Tailscale/LAN**. Uploading happens from the phone with Tailscale on. This removes the entire class of "someone found my upload form" attacks.
- Still put a real login (single admin account, argon2id password hash, secure session cookie) on the admin surface. Tailscale is the wall; auth is the lock.
- Trust `X-Forwarded-For` **only** from the proxy upstream address, never from an arbitrary client, or the header is trivially spoofed.
- **Strip EXIF from every publicly served derivative.** Original coordinates and timestamps live in the DB only.
- **Privacy of the aggregate.** A public feed of geotagged, timestamped photos is a published record of when the house is empty. Publish stadium-level location only — never raw coordinates — and every photo stays private until deliberately published.
- **Home-coordinate guard:** flag on upload any photo whose GPS falls within ~2 km of home. Coordinates come from env and never appear in the repo.
- Validate uploads by **magic bytes**, not extension. Cap file size and count. Rate limit.
- Serve photos through app-generated opaque IDs — never build a filesystem path from user input.
- Image decoding libraries (libheif/ImageMagick) have a long CVE history. Admin-only upload keeps input trusted, which is another argument for the first bullet.

### 4.6 The reverse proxy will silently break uploads

nginx-proxy-manager's default `client_max_body_size` rejects multi-megabyte photo uploads with a confusing 413. Proxy-host Advanced tab settings are recorded in the private deploy doc. Also enforce a real limit in the app itself. (Largely moot if uploads go over Tailscale rather than through the proxy — another point in favor of that design.)

Mobile uploads over cell drop constantly. Either upload one file at a time with per-file retry, or use resumable uploads (tus). A 40-photo batch that fails at photo 39 and restarts from zero will kill the habit of using the app.

### 4.7 Ballparks are not a stable list

This is a *lifetime* project, and the "30 stadiums" list churns. Modeling `team → stadium` as one thing means rewriting the schema in two years. Model **franchise** and **venue** separately, with dated tenancies:

- The Athletics are playing at Sutter Health Park in West Sacramento from 2025 through 2027, before a planned 2028 move to a new Las Vegas ballpark — so "the A's stadium" is three different buildings across this project's lifetime, and the club carries no city name at all during the Sacramento years.
- The Rays played their entire 2025 home schedule at Steinbrenner Field in Tampa after Hurricane Milton damaged Tropicana Field, returning to the Trop for 2026, with a lease running through at least 2028 and a new facility targeted for 2029.
- Naming rights change constantly — keep a `venue_names` table with date ranges so old photos display the name that was on the building that day.

### 4.8 The check-off rule (DECIDED — implement exactly this)

The core business logic. Get it wrong and every count on the dashboard is wrong.

**A team is checked off when you have attended a game at that franchise's current, permanent home ballpark.**

| Situation | Behavior |
|---|---|
| Attended a game at a permanent home park | ✅ Team checked off, ballpark checked off |
| Saw the building, no game attended | ❌ Neither checked off (record the visit anyway, flag it) |
| Attended a game at a **temporary** venue | ❌ Team **not** checked off — but the ballpark **is**, and counts toward the ballpark total |
| Team moves to a new permanent park not yet seen | ✅ Team **stays** checked off, with an asterisk indicator pointing at the new unvisited park |
| Venue is renamed | No change at all — same building, same checks, no asterisk. Display the name current on the visit date via `venue_names`. |

Worked examples to use as test cases:
- A's at Sutter Health Park (temporary) → ballpark ✅, Athletics still ❌. When Vegas opens in 2028 and you go, Athletics ✅.
- Rays at Steinbrenner Field in 2025 (temporary) → ballpark ✅, Rays still ❌. Rays at Tropicana Field → Rays ✅.
- Rays open a new park in 2029 → Rays stay ✅, asterisk appears on the new park.

**Two counters, always shown together:**

```
Teams        14 / 30        ← the headline achievement
Ballparks    16 / 34        ← the ongoing count (2 asterisked)
```

Because ballparks keep getting built, **this quest never technically ends.** Teams can hit 30/30 while ballparks sits at 28/33 forever. That's why the team counter is the headline — the asterisks should read as "here's what's new," not as the app nagging about something already finished. Keep asterisk styling quiet: a small superscript on the map pin and a subtle "New park since your visit" line on the park page.

Implement as a single pure function — `computeProgress(visits, tenancies, venues)` — with the examples above as unit tests. Do not scatter the logic across views.

---

## 5. Data model

```
franchises      id, name, abbrev, league, division, logo_ref
venues          id, name, city, state, lat, lng, timezone,
                opened_year, closed_year, capacity
venue_names     id, venue_id, name, valid_from, valid_to
tenancies       id, franchise_id, venue_id, start_year, end_year,
                is_temporary, is_current

trips           id, title, start_date, end_date, notes
visits          id, venue_id, trip_id, visit_date, attended_game,
                home_team_id, away_team_id, home_score, away_score,
                seat_section, seat_row, weather_temp_f, weather_desc,
                notes_user_a, notes_user_b, is_public
photos          id, sha256, original_filename, stored_path,
                taken_utc, taken_local, tz_offset, lat, lng,
                gps_source, match_confidence, visit_id, venue_id,
                caption, role, is_public, is_hero, home_guard_flag,
                width, height, bytes, uploaded_by
photo_variants  id, photo_id, kind(thumb|web|full), path, format, width

rankings        id, venue_id, ranker(user_a|user_b), elo, comparisons_count
comparisons     id, ranker, venue_a, venue_b, winner_venue_id, created_at

guest_links     id, trip_id, token_hash, label, expires_at,
                max_uploads, uploads_used, created_at, revoked_at
jobs            id, kind, payload_json, status, attempts, error, created_at
```

Key columns:
- `tenancies.is_temporary` — drives the check-off rule in §4.8. This one boolean is load-bearing. `NOT NULL`, no default.
- `visits.attended_game` — required for team check-off; seeing the building doesn't count. `NOT NULL`, no default.
- `photos.role` — `general | repeated_shot | ticket_stub | scorecard | food`. Drives the repeated-shot grid and keeps stubs out of the main gallery.
- `photos.uploaded_by` — `user_a | user_b | guest:<link_id>`. Needed for attribution and for moderating a bad guest batch in one query. Display names come from env; the database never stores real names.
- `photos.is_public` — `0` at ingest, always. Publishing is a deliberate act.
- `sha256` gives free dedupe — the same scoreboard gets shot twice, and the same album gets uploaded twice.
- `visit_id` nullable on photos → that's the manual-assignment queue.

SQLite is right here: two users, tens of thousands of rows at most, one file to back up. Keep it on the local dataset, never an SMB/NFS path.

---

## 6. Stack

- **Next.js (App Router) + TypeScript** — one container, SSR for good link previews when a park page gets texted to family, API routes for upload.
- **SQLite** via better-sqlite3 or Drizzle.
- **sharp** for derivatives; **exifr** for metadata; HEIC decode path per §4.2.
- **Tailwind** for UI.
- **`d3-geo` (`geoAlbersUsa`) + a bundled TopoJSON US outline** for the map. Not a tile map: the design calls for a dark styled well with fingerprint pins, thirty points are fixed, and this keeps the render free of any external network dependency or API key. MapLibre stays in reserve only if the road-trip planner later needs real pan/zoom geography.
- Background jobs: a `jobs` table plus an in-process worker. No Redis.
- Ticket stub OCR: a vision model call at upload time for photos tagged `ticket_stub`, behind a feature flag so the app works without an API key.
- Single container, multi-stage Dockerfile, built by GitHub Actions → GHCR.

---

## 7. Build phases

**Phase 0 — De-risk (an afternoon, do it first).** Multi-stage Dockerfile + CI. Then a standalone script, run **inside the target container image**: read a real HEIC and a real JPEG off both iPhones, extract GPS + `DateTimeOriginal` + `OffsetTimeOriginal`, decode to JPEG, print results. If HEIC decode fails here the stack changes — learn it now, not after the UI exists.

**Phase 1 — Data + seed + progress logic.** Schema and migrations. Seed all current MLB venues with hand-verified coordinates and timezones, plus temporary and historical venues, with correct `tenancies` rows. Then write `computeProgress()` and its unit tests against the §4.8 examples before any UI exists.

**Phase 2 — Ingest pipeline.** Upload → hash → dedupe → store original write-once → extract EXIF → resolve timestamp → geo-match with tiers → generate variants → queue unmatched. Includes a CLI ingest command for bulk-importing the existing backlog from an album export without touching a browser. Resumable.

**Phase 3 — Admin UI (Tailscale-only).** Upload with per-file status, manual assignment queue with map and bulk select, visit editor, captions, photo roles, publish toggles.

**Phase 4 — Public dashboard.** Map-first: every ballpark as a pin, checked pins visually distinct, asterisk indicator on superseded parks, click through to that park's photos. Two counters in the header. Park pages, trip pages, lightbox gallery, OG tags.

**Phase 5 — Deploy.** Create dataset → build/push image → Custom App wizard → ACLs on mounts → proxy host + LE cert → verify EXIF stripping on public images → verify `/admin` is unreachable from the public URL.

**Phase 6 — Backups.** Snapshots, offsite sync, export endpoint. **Move this ahead of the backlog import** — do not import thousands of irreplaceable photos onto storage with no backup.

**Phase 7+ — The big features in §8.**

---

## 8. Feature set

### Core

**Map dashboard.** The home page *is* the map. Every ballpark pinned, checked ones filled and clickable through to photos, unvisited ones outlined, asterisked ones marked quietly. Two counters — Teams and Ballparks — in the header.

**Auto-fill the game from date + venue.** MLB's StatsAPI (`statsapi.mlb.com/api/v1/schedule?sportId=1&date=YYYY-MM-DD`) is free and unauthenticated. Given a photo's date and matched stadium, look up the game and auto-populate opponent, score, and result. Highest value-per-line-of-code in the project — it turns a photo dump into a game log with zero typing. Cache locally; it's unofficial and shouldn't be a render-time dependency.

**The repeated shot.** One standard framing at every park — both of them, field behind, same composition. Tag via `photos.role = repeated_shot` and render the whole set as a grid. One boolean's worth of work, and it becomes the thing people actually stop and look at.

**Trips, not just visits.** A Midwest swing hitting three parks in five days is one story, not three.

**Ticket stub / scorecard uploads** as a distinct role so they render as a strip rather than mixed into the gallery.

**Two-voice notes** per visit — separate fields, not a shared box.

**Export button.** Zip of the DB plus a JSON manifest mapping every photo hash to stadium/date/caption. Portability and backup insurance in one.

### Major features

**Road trip planner.** Given remaining parks and a date window, pull the schedule and solve for feasible multi-park trips. Constrain on travel time between venues, game times, and rest. Biggest lift on this list and the only feature that changes behavior rather than recording it. Start dumb: brute-force all park triples within the window, filter by drive time, rank by total miles.

**Pairwise park ranker.** The app occasionally asks "Wrigley or Camden?" and builds an Elo ranking from the answers — separately for each of them. Absolute 1–10 scores drift and compress; head-to-head doesn't. The divergence between the two lists is the payoff, so render them side by side and highlight the biggest disagreements. Only compare parks both have visited.

**Ticket stub OCR → auto-created visit.** Photograph the stub, run a vision model, extract date/section/seat/teams, create the visit record. Pairs directly with StatsAPI: the stub supplies the date, StatsAPI fills in the box score. Always show the extraction for confirmation before writing — never silently trust OCR.

**Guest upload links.** Per-trip expiring token URL, no account needed, so whoever came along can add their photos. Solves the "the best picture is on someone else's phone" problem, which otherwise never gets solved. Token is single-purpose and scoped to one trip, hashed at rest, hard-capped on upload count and total bytes, expiring in 14 days by default; guest uploads land in a **review queue** and are never auto-published; attribution via `uploaded_by` so one bad batch can be removed in a single query. This is the one route that must be reachable publicly — so it gets its own strict rate limit and size cap independent of the admin path.

**Map time-lapse.** Scrub a timeline and watch pins fill in chronologically, trip routes drawing between them. Cheap to build and the natural companion to a map-first dashboard.

**Auto-computed superlatives.** Record when in attendance, hottest and coldest game, longest single drive, biggest blowout, most-photographed park, longest gap between parks. Zero data entry — it all falls out of what's already stored. Own stats page, two or three surfaced on the dashboard.

### Later / if it grows

- Minor league and spring training parks as a separate collection.
- Former or demolished parks visited.
- Multi-user, if friends want their own maps.
- **iOS Shortcut posting straight to the API** — bypasses the share-sheet EXIF problem entirely and is the most elegant fix if the browser upload path proves annoying in practice.

### Explicitly out of scope

Photo book / PDF export, Home Assistant integration, game-day live mode, food price tracking. Decided against — don't build them.

---

## 9. Decisions locked (don't relitigate)

- Team checked off only via a game attended at a **permanent** home park. Temporary venues check off the ballpark but not the team.
- Renames change nothing.
- Moved teams stay checked off; the new park gets an asterisk.
- Two counters: Teams and Ballparks.
- Map is the dashboard, rendered as an Albers USA SVG.
- Metadata lives in the database only — nothing is ever written into files on the pools.
- Upload and admin are Tailscale/LAN only. The public site is served through the reverse proxy.
- Every photo is private until deliberately published.
- The repo is public; nothing of value is committed. See `CLAUDE.md`.
