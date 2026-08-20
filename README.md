# Ballpark Tracker

A self-hosted web app for tracking a couple's progress toward attending a game at every MLB ballpark.

Upload photos from a phone; the app reads the embedded EXIF GPS and timestamp, matches each photo to a ballpark and a visit date, and renders a map-first public gallery. A team counts as checked off only when a game has actually been attended at that franchise's current, permanent home park — which turns out to be the interesting part of the problem, since franchises move, play in temporary venues, and rename their buildings.

The public site is read-only. Upload and admin are reachable only over Tailscale/LAN.

## Status

Early, and honest about it. See `docs/plan.md` for the full spec and build phases.

**Working:** the check-off rule and its counters, the map dashboard, park and repeated-shot pages, a SQLite schema with migrations and seeded reference data, and the admin lock (host gate plus argon2id login).

**Not built yet:** photo upload and the whole ingest pipeline, the assignment queue beyond an empty shell, trips, stats, rankings, guest links. There are no photos in the app at all — the grey tiles are placeholders.

**Unanswered:** whether HEIC decodes inside the target image. `scripts/spike-exif.mjs` and the `spike` image target exist to settle it; they have not been run against real photos.

## Stack

Next.js (App Router) + TypeScript · SQLite · sharp + exifr · Tailwind · `d3-geo` Albers USA map · single Docker container built in CI and published to GHCR.

## Running locally

```bash
cp .env.example .env   # then fill it in
npm install
npm run db:migrate     # creates ./data/ballpark.db
npm run db:seed        # public reference data: franchises, venues, tenancies
npm run dev
```

To browse with invented visits instead of an empty database:

```bash
npm run db:seed -- --demo
```

`.env` is gitignored. It stays that way — see below.

```bash
npm test
```

## Deploying

Docker container on TrueNAS SCALE via the Custom App wizard. See `docs/deploy.example.md`.

The image contains no secrets. Every value arrives as runtime env. On boot the
container applies pending migrations and seeds the public reference data, both
idempotent, so a restart is always safe and a fresh install needs no manual
database step. `GET /api/health` reports whether the process is up and the
database answers.

## A note on this repository

It's public, and it holds code and public reference data only. No secrets, no photos, no database, no home coordinates, no hostnames, no infrastructure paths, no real names — those live in runtime env or in a gitignored `docs/private/`. CI enforces it with `gitleaks` and a grep gate, but the rule is written down in `CLAUDE.md` because it's the one that's easiest to break by accident.

If you're reading this as a stranger: the MLB franchise and venue seed data is genuinely useful on its own, including the tenancy modeling for temporary venues. Take it.
