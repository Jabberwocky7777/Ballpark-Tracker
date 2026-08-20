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
- **The ingest pipeline** — see below. Photos can now get into the app.

163 tests, typecheck clean, `npm run check:coords` verifies every venue lands in
the state its record claims.

---

## The ingest pipeline

Built and verified end to end against the running dev server.

| Piece | Where |
|---|---|
| Magic-byte sniffing | `lib/ingest/magic.ts` — extension is never trusted |
| Content-addressed storage | `lib/ingest/storage-path.ts`, temp file + atomic rename |
| EXIF read | `lib/ingest/exif.ts` — never throws; no metadata is ordinary |
| Decoder chain | `lib/ingest/decode.ts` — sharp → heic-convert → pillow-heif |
| Derivatives | `lib/ingest/derivatives.ts` — 640/1800 WebP, EXIF stripped |
| Orchestration | `lib/ingest/ingest.ts` — the whole sequence, one function |
| Assignment logic | `lib/ingest/assign.ts` — tiers, session clustering, date matching |
| Job queue and worker | `lib/jobs/` — in-process, serial, starts at boot |
| Storage roots | `lib/storage.ts` — `DATA_DIR`/`ORIGINALS_DIR`/`DERIVED_DIR`, read in one place |
| Upload route | `app/api/upload/route.ts` — per-file report |
| Upload page | `/admin/upload` — with the "send them the right way" copy |
| Bulk CLI import | `scripts/import-photos.ts` — resumable, for the backlog |

What was verified, in the real app rather than in tests: a confident GPS match
assigns the park and links the visit for that date; a photo from the same
evening with no GPS becomes a *suggestion*; a photo with neither GPS nor a date
lands in the queue; a photo taken near home is flagged and held for review;
duplicates are recognised by hash; a zip renamed to `.jpg` is refused; every
derivative comes out with no EXIF; every photo is `is_public = 0`; and
`/api/upload` returns 404, not 401, without a session.

**Resumability is a property of the hash, not of a progress file.** A CLI import
that dies at photo 900 can simply be re-run.

---

## Not built

| Missing | Notes |
|---|---|
| Assignment queue UI | `/admin` counts what is waiting but cannot yet assign. **Bulk select is the missing piece** — expect 20–40% of photos to land here. |
| Publish controls | Nothing can be made public through the UI yet, which is why the map still shows only the seeded reference photos. |
| StatsAPI autofill | Date + venue → opponent, score, result. Highest value per line of code in the project. |
| Visit editor | Captions, photo roles, the two-voice notes. |
| Trips, stats, rankings, guest links, map time-lapse | All later phases. |
| Export endpoint | DB + JSON manifest. The portability guarantee. |

---

## Do these first, in this order

**1. The Phase 0 HEIC spike. It has still never been run.**

The ingest pipeline no longer *blocks* on it — the decoder is chosen at runtime
from all three candidates, so it works with whichever is available. But the
spike is still the only thing that will tell you which one wins in the
container, how slow it is on a real 12MP HEIC, and what the true no-GPS
percentage is off these two phones.

```bash
docker run --rm -v /path/to/sample/photos:/in:ro \
  ghcr.io/jabberwocky7777/ballpark-tracker:main-spike /in
```

It reads only — writes nothing, moves nothing. Record the winner and the no-GPS
percentage in `docs/decisions.md`.

**Know this before you run it:** the runner image has no Python and no
`pillow-heif` — only the `spike` target does. If the sidecar turns out to be
the only decoder that works, the runner stage of the `Dockerfile` needs the
packages the spike stage installs.

**2. Backups, before any real photo goes in.**

Unchanged and still the most important item here. Snapshots on the config and
media datasets, then an offsite copy of the originals. Now that photos can
actually be uploaded, the window where this is merely urgent is closing.
Details in `docs/private/deploy.md`.

**3. The assignment queue UI.** The pipeline fills it; nothing empties it. Bulk
select and assign, then the publish toggle — without which nothing that gets
uploaded can ever be seen.

---

## Open questions

- **The reason a photo was matched is not stored**, only the tier. `assign.ts`
  computes it (`gps-confident`, `session`, `date-only`) and the upload report
  shows it, but the column does not exist. Worth adding when the queue UI needs
  to explain itself.
- **Session clustering runs only in the CLI import**, not on upload. A batch
  uploaded through the browser gets tier matching but not the second pass. It
  belongs in the queue UI as a "match the rest of this evening" action.
- **Oakland Coliseum** is still in the seed. It closed in 2024, so it survived
  the "nothing before 2020" cut, but it may not be wanted either.
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
  `EINVAL: readlink` and `EBUSY` errors that need `rm -rf .next`. It bit again
  this session. Moving the project out of OneDrive is the real fix and has not
  been done.
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
- **`npm run check` is not the whole hygiene gate.** CI also runs `gitleaks`,
  which is not installed locally, so a push can fail on something that passed
  every local check. It caught a *test fixture* once: a plausible-looking hex
  photo id scored high enough on entropy to read as a leaked key. Keep
  fixtures obviously fake — repeated characters rather than random-looking
  ones — and that whole class stops happening.
- **`node` needs explicit `.ts` extensions** on relative imports; webpack does
  not care, which hides the breakage until a CLI runs. Every relative import
  inside `lib/` now carries one, so match that rather than reintroducing the
  mixture — the CLI shares the ingest module with the upload route, which drags
  the database layer along with it.
- **`app/` imports through the `@/` alias and never with an extension.** Two
  conventions, one per directory, and they do not meet.
- **CLI scripts that touch `lib/` need `--conditions=react-server`**, or the
  `server-only` import throws. The npm scripts already pass it.

---

## Useful commands

```bash
npm run dev              # dev server
npm test                 # 163 tests
npm run check:coords     # every venue lands in its own state
npm run check            # nothing of value is tracked
npm run db:reset         # migrate + seed with demo visits
npm run import:photos -- <dir> --as user_a   # bulk import, resumable
npm run jobs:drain       # run the photo job queue to empty
npm run harvest:photos   # find freely-licensed park photos (slow, resumable)
npm run fetch:photos     # download the reviewed picks
```
