# Ballpark Tracker — Look & Feel Spec

For implementing the visual design in the real codebase. The attached HTML (`Ballpark Tracker.dc.html`) is a **design reference**, not production code — recreate this look using your stack's existing components/patterns. One known issue: the US map in the prototype is a hand-drawn placeholder outline, not real geography — replace it with an accurate US base map (real projection, e.g. Albers USA) and plot the 30 MLB ballpark coordinates precisely by lat/long.

## Direction
"Park fingerprints" — each MLB ballpark's outfield wall has a distinctive outline shape (Fenway's Monster corner, PNC's notch, etc). That silhouette is the recurring motif: used in the map pins, the park card/header accent, and it should generalize into a `checked`/`unchecked` visual state anywhere a park is represented. Not decoration — a real artifact of the subject.

Tone: scrapbook kept by two people, not a sports app or SaaS dashboard. Plain, warm, specific copy, sentence case. No trophy/badge gamification, no progress bars/rings. **Do not use actual team logos or wordmarks anywhere** — they're trademarked regardless of personal/non-commercial use. The pin shapes are original stylized outlines, not traced from any single real park or logo.

## Color palette (single source of truth — the whole product is cream/paper now, no dark surfaces)
- `--ink`: `#0f1b2e` — all headings, pin outlines/fills-on-light, primary dark text. (Single ink token — don't reintroduce a second near-black.)
- `--ink-body`: `#33372a` — body copy/notes (softer than heading ink)
- `--paper`: `#f3efe4` — main page/card background
- `--paper-inset`: `#ece4d0` — the map's inset well (a shade darker than page paper, to read as a distinct panel)
- `--paper-line`: `#d9d2b8` — borders, dividers, card outlines
- `--muted`: `#8a7a52` — secondary text, labels, links (single muted-brown token — don't reintroduce `#5a5e4c`/`#7b8060` variants)
- `--not-done-stroke`: `#a89a6e` — hollow pin stroke (not-yet-visited)
- `--accent`: `#e0713f` — the ONE accent color, marks "done." Used as: solid pin fill, card top-bar (2px), nothing else.
- `--accent-hover`: `#c65a2a`
- `--gold`: `#d9a441` — secondary accent, used ONLY for the small "asterisk" dot (team checked off, ballpark since replaced)
- White (`#ffffff`) for elevated cards (counters, stat panel) sitting on `--paper`.

Only two accents total (orange = done, gold = asterisk caveat) — never more.

## Typography
Three-font system:
- **Oswald** (600/700, uppercase, tracked) — wordmark, park names, page titles, section labels. This replaced an earlier italic-serif direction — bold condensed sans reads more "ballpark scoreboard," less generic app.
- **Public Sans** — all running body text/notes.
- **Space Grotesk** with `font-variant-numeric: tabular-nums` — the two counters, dates, scores, seat numbers. Gives numbers presence without a progress bar.

Avoid: Inter, Roboto, Arial, Fraunces, varsity/collegiate block letters, official MLB branding (navy/red trademarked palette, team wordmarks).

## The two counters
Always together, never merged into one stat or a bar/ring:
```
14/30   Teams
16/34   Ballparks
```
White card, thin `--paper-line` border, 2px `--accent` top bar, big tabular number + dim "/NN" + small uppercase Oswald label. Same card treatment now reused for the park detail's Opponent/Score/Seats block — keep that consistent (it was a dark-navy holdout before and has been unified to match).

## Pin / park state system (shape-coded, not color-only)
1. **Done** — outline shape filled solid `--accent`, `--ink` stroke.
2. **Done + asterisk** (team checked off, has since moved to a new ballpark not yet seen) — same filled shape + small solid `--gold` dot at the top-right corner.
3. **Not done** — outline only, `--not-done-stroke`, transparent fill, ~2px stroke.
4. **Temporary venue** (team currently playing in a stand-in park) — same hollow outline, dashed stroke.

Compact legend near the map uses these exact mini-icons, not just a text key.

## Pin shapes — implementation note
Current build cycles 4 original stylized outline shapes (asymmetric wall notches, evoking real ballpark quirks without tracing any specific park) across all 30 pins. **Not** literal team logos — never substitute actual team marks. If pursuing true 1-to-1 uniqueness, commission/trace simplified outfield-wall footprints per park (architectural silhouette, not logo), normalized to one bounding box and stroke weight.

## Hover preview (new)
Hovering a map pin shows a small floating card above it: an image slot (aerial/overhead shot of the park) + park name in Oswald. Positioned via the pin's map-relative percentage coordinates. **The image is a user-fillable placeholder** — do not scrape or embed photos from third-party sites (e.g. ballpark aerial-photo directories); those images are copyrighted. Users should supply their own photos or licensed images.

## Interaction patterns
- Tapping a **done** pin navigates to that park's page.
- Tapping a **not-done** pin opens a bottom sheet (mobile) / popover (desktop) with a short, specific, concrete line about that park — never "No data available."
- Hovering any pin (desktop) shows the aerial-photo preview card described above.
- Two-voice content (the two of them) always renders as two side-by-side columns with a small uppercase label + underline, never merged into one paragraph.
- Ticket stubs/scorecards render as their own horizontally-scrolling strip, separate from the photo grid.

## Layout scale
Mobile-first, 520px-max content column centered on wider viewports — the whole product feels like one continuous scrollable surface, not a boxed dashboard with chrome. The dashboard/map screen and the park/grid screens now share the same cream (`--paper`) surface — there is no more light/dark screen split; the map's inset well (`--paper-inset`) is the only surface variation, reading as "a panel within the page" rather than a mode switch.

## Accessibility constraints (non-negotiable)
- Never encode state in color alone — shape/pattern differences (solid vs. hollow vs. dashed) must remain even in grayscale.
- Visible keyboard focus states on all interactive elements (pins, links, buttons).
- Respect `prefers-reduced-motion` — bottom-sheet slide-up and pin transitions need a no-motion fallback.
- Layout must not break with missing/private photos — never assume every slot renders.

## Change log (this round)
1. Repainted from a cool navy/grey-blue palette to the warm cream/ink palette above (less generic "app," more scrapbook).
2. Explored an MLB-scoreboard-inspired direction (bold condensed Oswald type, navy ink, scoreboard-style stat cards) — kept the typography, moved the surface to cream per follow-up.
3. Replaced the abstract "fingerprint" pin shapes with an abbreviation-badge idea, then reverted per feedback — team logos were requested but declined (trademarked); abbreviation badges were tried and also reverted in favor of refined outline shapes, since the direction settled on original stylized park-outline pins, not text badges.
4. Flipped the map's dark inset to the same cream family as the rest of the app.
5. Consistency pass: unified two near-duplicate "ink" darks into one token, two near-duplicate muted-brown/border colors into one, and converted the last dark-navy leftover (Opponent/Score/Seats block) to the light card style used elsewhere.
6. Added pin hover preview (aerial photo placeholder + park name).

## Files
- `Ballpark Tracker.dc.html` — the original clickable prototype. Not in this repo; it is a design reference, not production code. The tokens and rules above are the source of truth.
