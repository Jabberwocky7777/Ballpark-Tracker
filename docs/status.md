# Where this stands — 20 August 2026

A handoff note. Read `CLAUDE.md` first for the rules; this is what is built, what
isn't, and what to do next.

---

## Working today

Deployed on TrueNAS as a Custom App, public repo, CI builds and publishes the
image on every push to `main`.

- **The check-off rule** — `lib/progress.ts`, one pure function, all five spec
  cases tested. Teams and ballparks counters.
- **Map dashboard** — Albers USA SVG, four shape-coded pin states, gentle pin
  separation with a drift cap, hover preview cards with photos and credits.
- **Park pages** — visit details, two-voice notes, historical venue names.
- **The repeated-shot grid** and a **photo credits** page.
- **SQLite** — schema, migrations, seeded reference data, all applied on boot.
- **The admin lock** — argon2id login, signed session cookie, login throttle,
  and an optional host gate.
- **Supporting pure logic, built and tested ahead of the pipeline that needs it:**
  geo-matching tiers, timestamp resolution, the home-coordinate guard,
  path-containment for photo serving.

132 tests, typecheck clean, `npm run check:coords` verifies every venue lands in
the state its record claims.

---

## Not built

**There is no way to get a photo into the app.** That is the whole next phase and
everything else is downstream of it.

| Missing | Notes |
|---|---|
| Upload | The route is gated but does not exist. Tailscale/LAN only. |
| Ingest pipeline | Hash, dedupe on sha256, write-once original, EXIF read, timestamp resolve, geo-match, queue unmatched. The pure pieces exist; nothing calls them. |
| Derivative generation | Including **EXIF stripping**, which is a hard rule. `photo_variants` table is empty and unused. |
| Background job queue | `jobs` table exists, no worker. Decode must never run in a request. |
| Assignment queue | `/admin` has an empty shell. Expect 20–40% of photos to land here — it is a primary interface, not a fallback. Bulk assign required. |
| CLI bulk import | For the ~200–2000 photo backlog. Resumable. |
| StatsAPI autofill | Date + venue → opponent, score, result. Highest value per line of code in the project. |
| Trips, stats, rankings, guest links, map time-lapse | All later phases. |
| Export endpoint | DB + JSON manifest. The portability guarantee. |

---

## Do these first, in this order

**1. The Phase 0 HEIC spike. It has never been run.**

The plan makes this a gate before ingest work, and it is still open. `sharp`'s
prebuilt binaries often ship without libheif, and if none of the three decoders
work in the container then the stack changes. Everything below assumes it passes.

```bash
docker run --rm -v /path/to/sample/photos:/in:ro \
  ghcr.io/jabberwocky7777/ballpark-tracker:main-spike /in
```

It reads only — writes nothing, moves nothing. Use real photos off both phones,
including HEICs shared the way they normally would be. Record the winning decoder
and the no-GPS percentage in `docs/decisions.md`.

**2. Backups, before any real photo goes in.**

Snapshots on the config and media datasets, then an offsite copy of the originals.
The photos are the one thing here that cannot be regenerated, and nothing on that
server is backed up today. Details in `docs/private/deploy.md`.

**3. Then the ingest pipeline.** Upload route, hash and dedupe, EXIF, the job
queue, derivatives with EXIF stripped, and the assignment queue.

---

## Open questions

- **Oakland Coliseum** is still in the seed. It closed in 2024, so it survived the
  "nothing before 2020" cut, but it may not be wanted either.
- **The 520px column** grows to 660px then 880px on wider screens. The
  look-and-feel spec still says a flat 520px; this deviates deliberately because
  a fixed narrow ribbon looked wrong on a desktop monitor.
- **Five parks have no hover photo** — Progressive Field, Citi Field, Citizens
  Bank Park, Las Vegas, Oakland Coliseum. No freely-licensed shot from behind
  home plate exists for the first three. Their own photos will fix this.
- **The asterisk state is no longer visible in demo data**, since it needed a
  visit to a park a franchise has since left and those parks left the seed. The
  rule is unchanged and still tested.

---

## Things that will bite a fresh session

- **Do not `git push` unless asked.** Commit freely; pushing is Brendan's call.
- **The project lives in OneDrive.** It syncs ~566 MB across ~13,000 files, and
  `.next` is rewritten on every compile. This makes dev slow and causes
  `EINVAL: readlink` errors that need `rm -rf .next`. Moving the project out of
  OneDrive is the real fix and has not been done.
- **Never run `next build` while `next dev` is running.** They share `.next` and
  corrupt each other.
- **Do not blanket-kill node processes** to free `.next` — it also kills
  background jobs. Kill the specific server by port.
- **Wikimedia rate-limits hard and fails silently**, returning empty results that
  read as "nothing found". Both photo scripts back off and resume; keep it that
  way.
- **Site identifiers never go in a committed file**, not even as a test fixture or
  a search pattern. They live in `scripts/private-patterns.txt`, which is
  gitignored. The gate scans every tracked file including itself.
- **`node` needs explicit `.ts` extensions** in files that scripts import
  directly; webpack does not care, which hides the breakage until a CLI runs.

---

## Useful commands

```bash
npm run dev              # dev server
npm test                 # 132 tests
npm run check:coords     # every venue lands in its own state
npm run check            # nothing of value is tracked
npm run db:reset         # migrate + seed with demo visits
npm run harvest:photos   # find freely-licensed park photos (slow, resumable)
npm run fetch:photos     # download the reviewed picks
```
