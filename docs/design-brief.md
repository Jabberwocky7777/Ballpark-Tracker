# Ballpark Tracker — Design Brief
*Design brief.*

---

## What this is

A private-ish website tracking one couple's mission to see a game at every MLB ballpark. They have visited a handful so far, with a lot of photos at each. The site is public — family and friends follow along — but there are only two people putting anything into it.

This is a **scrapbook that keeps score**, not a sports app and not a SaaS dashboard. It should feel like something made by two people who care a lot about this, and it should still look good in fifteen years when it's finished. Nostalgia is fair game; nostalgia-as-costume is not.

**The single job of the home page:** show which parks are done, and get you into the photos.

---

## Audience and use

- Mostly read on phones, shared by text link. Design mobile-first and make sure a texted link previews well.
- Also gets pulled up on a laptop and browsed properly.
- Two very different modes: *browsing* (public, photo-forward, leisurely) and *filing* (private admin, dense, fast, one-handed on a phone at a hotel). These should feel related but not identical — the admin side can be much more utilitarian.

---

## Screens to design, in priority order

### 1. Map dashboard (home) — the whole product

A US map with every MLB ballpark pinned. This is the hero; don't bury it under a headline block.

Must communicate, at a glance:
- Which parks are **done** (visited, game attended) vs **not**
- Two separate counters, always together, teams reading as the headline:
  - `Teams 14 / 30`
  - `Ballparks 16 / 34`
- **Asterisked parks** — a team you've already checked off has moved into a new ballpark you haven't seen. The team stays checked. This indicator must be *quiet*: a small mark on the pin plus a line on the park page. It's "here's something new," not an error state or a nag.
- Clicking a done park goes to its photos. Clicking an undone park shows a small "not yet" state — which is a design opportunity, not a dead end.

The pins carry most of the informational load. Give them a real state system: done, not done, done-with-asterisk, temporary venue. Don't rely on color alone.

### 2. Park page

Photos are the point. Also on the page: the park's name **as it was called on the visit date**, city, date visited, the game (opponent, score, who won), seats, and separate notes from each of them — two voices side by side, not one merged block. Ticket stubs and scorecards render as their own strip, not mixed into the photo grid.

### 3. The repeated shot

At every park they take one standardized photo: both of them, field behind, same framing. All of these together as a grid is the emotional center of the site. Design this as its own page and give it real thought — it's the piece people will actually stop on.

### 4. Trip page

One road trip, several parks, in order. Dates, route, photos grouped by park.

### 5. Map time-lapse

Scrub a timeline and watch pins fill in chronologically with trip routes drawing between them. Needs a control that invites scrubbing without a lot of chrome.

### 6. Rankings

Head-to-head ranked lists, the two lists side by side, with disagreements highlighted. Plus the comparison prompt itself: two parks, pick one. That prompt should feel like a quick, pleasant tap — not a form.

### 7. Stats

Auto-computed superlatives: record when in attendance, hottest and coldest game, longest drive, biggest blowout, longest gap between parks.

### 8. Admin (private)

Upload with per-file status, and a **review queue** for photos whose location couldn't be determined — assign them to a park, in bulk, fast. Utilitarian and dense. This screen gets used with one thumb in a hotel bed; optimize for that.

---

## Aesthetic direction

Pick one and commit. My recommendation is A.

**A. Park fingerprints.** Every MLB outfield wall has a unique shape — Fenway's Monster corner, PNC's notch, Houston's angles. Use that outline as the recurring motif: it's the park card, the pin at zoom, the checked/unchecked state, the page header. It's a real artifact of the subject rather than applied decoration, it's instantly recognizable to anyone who knows the parks, and it gives you 30 distinct shapes for free. Field green, chalk-line white, dusk navy, with one warm accent used sparingly for the "done" state.

**B. Scorecard.** The vernacular of hand-kept scorekeeping — grid paper, pencil weight, the K/6-4-3 shorthand, dense small type. Suits the data-heavy pages beautifully. Risk: it can tip into precious, and it fights the photos.

**C. Night game.** Dark, the palette of a stadium after sunset, bulb-board or dot-matrix display type used for the counters only. High-impact for the photos. Risk: dark-plus-one-bright-accent is a well-worn default; it needs a specific, justified accent to escape that.

Whichever you pick, **the fingerprint outline is worth keeping as the signature element.**

### Typography

Give the counters and the park names real presence — those are the two things people look at. Pair a display face with genuine character against a workhorse body face, plus something tabular for scores and dates. Avoid the varsity-jersey/collegiate-block cliché and avoid generic sports-broadcast italics.

### Please avoid

- Team logos and team colors as the organizing system. It's 30 clashing palettes and a licensing mess. The site has its own identity.
- Cream background + high-contrast serif + terracotta accent. It's the current AI-design house style and it reads as a tell.
- Trophy/badge/achievement-unlocked gamification. The check itself is the reward.
- Progress bars and percentage rings for the counters. Find something better — this is 30 discrete places, not a loading state.
- Faux-vintage distress textures, sepia washes, torn-paper edges.

---

## Copy and voice

Plain, warm, specific, sentence case. Never breathless.

- Empty states are invitations: an unvisited park says something concrete about what goes there, not "No data available."
- The no-GPS review queue should explain what happened in one line and hand over the fix — this is the screen most likely to cause frustration, so give it care.
- Errors say what went wrong and what to do. They don't apologize.
- Use the couple's actual framing. "Not yet" beats "Incomplete."

---

## Constraints

- Works down to a phone; the map has to be genuinely usable at that size, including the pins.
- Photos are large and numerous — the layout must survive a park page with 200 photos and stay fast.
- Some photos and some parks are private and simply won't render. Don't design a layout that breaks with holes in it.
- Keyboard focus visible, reduced motion respected, and don't encode state in color alone.
- Guest-uploaded photos land in a review queue and are never shown publicly until approved. That queue needs a design too.

---

## Deliverables

Start with the map dashboard and the park page — those two carry the identity. Then the repeated-shot grid. Show the pin state system and the two-counter treatment explicitly; those are the details that make or break it.
