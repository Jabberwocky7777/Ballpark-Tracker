# Ballpark Tracker — Look & Feel Spec

Look and feel spec. For implementing the visual design in the real codebase. The attached HTML (`Ballpark Tracker.dc.html`) is a **design reference**, not production code — recreate this look using your stack's existing components/patterns. One known issue: the US map in the prototype is a hand-drawn placeholder outline, not real geography — replace it with an accurate US base map (real projection, e.g. Albers USA) and plot the 30 MLB ballpark coordinates precisely by lat/long.

## Direction
"Park fingerprints" — each MLB ballpark's outfield wall has a distinctive outline shape (Fenway's Monster corner, PNC's notch, etc). That silhouette is the recurring motif: used in the map pins, the park card/header accent, and it should generalize into a `checked`/`unchecked` visual state anywhere a park is represented. Not decoration — a real artifact of the subject.

Tone: scrapbook kept by two people, not a sports app or SaaS dashboard. Plain, warm, specific copy, sentence case. No trophy/badge gamification, no progress bars/rings, no team logos or team colors as an organizing system.

## Color palette
- `--ink` (dusk navy, primary dark surface): `#16213a`
- `--ink-deep` (map background well): `#101a30`
- `--ink-panel` (cards on ink surface): `#1c2947`
- `--ink-line` (hairlines/strokes on ink): `#26324f`
- `--chalk` (near-white text/fill on dark): `#f4f5f2`
- `--chalk-muted` (secondary text on dark): `#9aa2b8`
- `--chalk-dim` (tertiary/divider on dark): `#5b647c` / `#7b8399`
- `--paper` (light surface for park/grid pages): `#f4f5f2`
- `--paper-ink` (primary text on paper): `#16213a` / `#2c3040`
- `--paper-muted` (secondary text on paper): `#7b8060`
- `--accent` (warm "done" color, used sparingly): `#e0713f`
- `--accent-hover`: `#c65a2a`
- `--not-done-stroke` (hollow pin stroke): `#aeb4c2`

Only one accent color in the whole system. It marks "done" — nowhere else.

## Typography
Three-font system, no more:
- **Display** — Instrument Serif (italic for wordmark, roman for headings/park names). Used for: site wordmark, park names, page titles. Large sizes (22–32px+), never for body copy.
- **Body** — Public Sans. Used for: all running text, notes, copy, labels. 12–15px.
- **Tabular/numeric** — Space Grotesk, with `font-variant-numeric: tabular-nums`. Used for: the two counters, dates, scores, seats, any stat. This is what gives numbers "presence" without a progress bar.

Avoid: Inter, Roboto, Arial, Fraunces, varsity/collegiate block letters, sports-broadcast italics.

## The two counters
Always shown together, never as a single merged stat, never as a bar or ring:
```
14/30   Teams
16/34   Ballparks
```
Big tabular number (28–32px, weight 700) + smaller "/NN" in a dimmer tone + small uppercase label beneath. Live in a two-up row of flat cards (`--ink-panel` background, 4px radius), never floating text over the map.

## Pin / park state system (shape-coded, not color-only)
Every state must be distinguishable by **shape**, color is secondary:
1. **Done** — fingerprint outline filled solid `--accent`, thin `--chalk` stroke.
2. **Done + asterisk** (team checked off, has since moved to a new ballpark not yet seen) — same filled fingerprint, plus a small solid `--chalk` dot/ring at the top-right corner of the pin. Quiet — not a badge, not a warning triangle.
3. **Not done** — fingerprint outline only, `--not-done-stroke`, transparent fill, ~2.5px stroke.
4. **Temporary venue** (team currently playing in a stand-in park) — same hollow outline, dashed stroke (`stroke-dasharray`).

Provide a compact legend near the map using these exact mini-icons rather than a text key alone.

## Fingerprint motif — implementation note
The prototype uses 4 abstract placeholder notch-shapes cycled across pins as a stand-in. For production, source or trace the actual 30 ballpark outfield-wall outlines (simplified to a clean single-weight silhouette, consistent stroke width, normalized to a common bounding box) — this is the signature asset of the whole product and is worth real illustration effort, not procedural generation.

## Interaction patterns
- Tapping a **done** pin navigates to that park's page.
- Tapping a **not-done** pin opens a bottom sheet (mobile) / popover (desktop) with a short, specific, concrete line about that park — never "No data available." Dismiss via scrim tap or close button.
- Two-voice content (the two of them) always renders as two side-by-side columns with a small uppercase label + underline, never merged into one paragraph.
- Ticket stubs/scorecards render as their own horizontally-scrolling strip, visually separate from the photo grid.

## Layout scale
Mobile-first, designed at a 520px-max content column that centers on wider viewports (the whole product should feel like one continuous scrollable "card," not a boxed dashboard with chrome). Dark (`--ink`) surface for the map/dashboard screen; light (`--paper`) surface for park detail and the repeated-shot grid — the two surfaces are the "browsing" (light, photo-forward) vs. the map/home (dark, data-forward) split called for in the brief.

## Accessibility constraints (from brief, non-negotiable)
- Never encode state in color alone — shape/pattern differences (solid vs. hollow vs. dashed) must remain even in grayscale.
- Visible keyboard focus states on all interactive elements (pins, links, buttons).
- Respect `prefers-reduced-motion` — the bottom-sheet slide-up and any pin transitions should have a no-motion fallback.
- Layout must not break with missing/private photos — never assume every slot renders.

## Files
- `Ballpark Tracker.dc.html` — the original clickable prototype (map dashboard, park page, repeated-shot grid). Not in this repo; it is a design reference, not production code. The tokens and rules above are the source of truth.
