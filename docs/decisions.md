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

## Open — HEIC decode path

To be resolved by the Phase 0 spike, run inside the built container image. Candidates in order: `sharp` with a libvips build including libheif → `heic-convert` → a Python `pillow-heif` sidecar. All three are present in the `spike` image target so one run evaluates all of them.

**How to run it.** CI publishes the spike image on every push to `main`. On any machine with Docker and a folder of real photos off both phones:

```bash
docker run --rm -v /path/to/photos:/in:ro ghcr.io/<owner>/ballpark-tracker:main-spike /in
```

It reads only — it writes nothing, moves nothing, and never modifies the input files. It prints per-file GPS, timestamp, and decode results, then a summary and a verdict.

**Record the winner here**, with the timing numbers and the no-GPS percentage, before writing any UI. If none of the three work in-container, the spike exits non-zero — the stack changes and the plan needs revisiting.

Note the spike is also the first real measurement of the 20–40% no-GPS estimate in `docs/plan.md` §4.1. If it comes back much worse, the manual assignment queue needs more design attention than Phase 3 currently budgets.
