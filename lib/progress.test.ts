import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeProgress } from "./progress.ts";
import type { Franchise, Tenancy, Venue, Visit } from "./types.ts";

/** Minimal fixtures. Deliberately not the real seed data -- these tests are
 *  about the rule, and should not break when a park is renamed. */

const venue = (id: string, over: Partial<Venue> = {}): Venue => ({
  id,
  slug: id,
  name: id,
  city: "City",
  state: "ST",
  lat: 40,
  lng: -80,
  timezone: "America/New_York",
  openedYear: 1990,
  closedYear: null,
  fingerprint: 0,
  ...over,
});

const franchise = (id: string): Franchise => ({
  id,
  name: id,
  abbrev: id.toUpperCase(),
  league: "AL",
  division: "East",
});

const tenancy = (over: Partial<Tenancy> & Pick<Tenancy, "franchiseId" | "venueId">): Tenancy => ({
  id: `${over.franchiseId}-${over.venueId}`,
  startYear: 2000,
  endYear: null,
  isTemporary: false,
  isCurrent: true,
  ...over,
});

const visit = (venueId: string, visitDate: string, attendedGame: boolean): Visit => ({
  id: `v-${venueId}-${visitDate}`,
  venueId,
  tripId: null,
  visitDate,
  attendedGame,
  isPublic: true,
});

const run = (
  visits: Visit[],
  tenancies: Tenancy[],
  venues: Venue[],
  franchises: Franchise[],
  currentYear = 2026,
) => computeProgress({ visits, tenancies, venues, franchises, currentYear });

describe("the check-off rule", () => {
  test("attending a game at a permanent home park checks off both", () => {
    const p = run(
      [visit("wrigley", "2024-07-14", true)],
      [tenancy({ franchiseId: "chc", venueId: "wrigley" })],
      [venue("wrigley")],
      [franchise("chc")],
    );
    assert.equal(p.teamsChecked, 1);
    assert.equal(p.ballparksChecked, 1);
    assert.equal(p.byVenue.get("wrigley")?.state, "done");
  });

  test("seeing the building without a game checks off neither", () => {
    const p = run(
      [visit("wrigley", "2024-07-14", false)],
      [tenancy({ franchiseId: "chc", venueId: "wrigley" })],
      [venue("wrigley")],
      [franchise("chc")],
    );
    assert.equal(p.teamsChecked, 0);
    assert.equal(p.ballparksChecked, 0);
    assert.equal(p.byVenue.get("wrigley")?.state, "not-done");
  });

  test("A's at Sutter Health Park: ballpark yes, Athletics no", () => {
    const p = run(
      [visit("sutter", "2025-06-01", true)],
      [
        tenancy({ franchiseId: "ath", venueId: "sutter", startYear: 2025, endYear: 2027, isTemporary: true }),
        tenancy({ franchiseId: "ath", venueId: "vegas", startYear: 2028, isCurrent: false }),
      ],
      [venue("sutter"), venue("vegas")],
      [franchise("ath")],
    );
    assert.equal(p.teamsChecked, 0, "a temporary venue never checks off the team");
    assert.equal(p.ballparksChecked, 1, "but the ballpark counts");
    assert.equal(p.byVenue.get("sutter")?.state, "done");
    // Vegas must NOT be asterisked -- the franchise isn't checked off yet, so
    // there is nothing "new since your visit" to point at.
    assert.equal(p.byVenue.get("vegas")?.state, "not-done");
    assert.equal(p.asteriskCount, 0);
  });

  test("A's at the new Las Vegas park: Athletics checked off", () => {
    const p = run(
      [visit("sutter", "2025-06-01", true), visit("vegas", "2028-05-02", true)],
      [
        tenancy({ franchiseId: "ath", venueId: "sutter", startYear: 2025, endYear: 2027, isTemporary: true, isCurrent: false }),
        tenancy({ franchiseId: "ath", venueId: "vegas", startYear: 2028 }),
      ],
      [venue("sutter"), venue("vegas")],
      [franchise("ath")],
      2028,
    );
    assert.equal(p.teamsChecked, 1);
    assert.equal(p.ballparksChecked, 2);
  });

  test("Rays at Steinbrenner Field 2025: ballpark yes, Rays no", () => {
    const p = run(
      [visit("steinbrenner", "2025-08-01", true)],
      [
        tenancy({ franchiseId: "tbr", venueId: "tropicana", startYear: 1998, endYear: 2024, isCurrent: false }),
        tenancy({ franchiseId: "tbr", venueId: "steinbrenner", startYear: 2025, endYear: 2025, isTemporary: true, isCurrent: false }),
        tenancy({ franchiseId: "tbr", venueId: "tropicana", startYear: 2026 }),
      ],
      [venue("steinbrenner"), venue("tropicana")],
      [franchise("tbr")],
    );
    assert.equal(p.teamsChecked, 0);
    assert.equal(p.ballparksChecked, 1);
    assert.equal(p.byVenue.get("steinbrenner")?.state, "done");
  });

  test("Rays at Tropicana Field: Rays checked off", () => {
    const p = run(
      [visit("tropicana", "2026-04-10", true)],
      [
        tenancy({ franchiseId: "tbr", venueId: "tropicana", startYear: 1998, endYear: 2024, isCurrent: false }),
        tenancy({ franchiseId: "tbr", venueId: "steinbrenner", startYear: 2025, endYear: 2025, isTemporary: true, isCurrent: false }),
        tenancy({ franchiseId: "tbr", venueId: "tropicana", startYear: 2026 }),
      ],
      [venue("tropicana"), venue("steinbrenner")],
      [franchise("tbr")],
    );
    assert.equal(p.teamsChecked, 1);
  });

  test("a team that moves stays checked off, and the new park is asterisked", () => {
    const p = run(
      [visit("tropicana", "2026-04-10", true)],
      [
        tenancy({ franchiseId: "tbr", venueId: "tropicana", startYear: 1998, endYear: 2028, isCurrent: false }),
        tenancy({ franchiseId: "tbr", venueId: "newpark", startYear: 2029 }),
      ],
      [venue("tropicana"), venue("newpark")],
      [franchise("tbr")],
      2029,
    );
    assert.equal(p.teamsChecked, 1, "the check is not revoked by a move");
    assert.equal(p.byVenue.get("newpark")?.state, "done-asterisk");
    assert.equal(p.byVenue.get("newpark")?.newParkFor?.id, "tbr");
    assert.equal(p.asteriskCount, 1);
    assert.equal(p.ballparksChecked, 1, "the new park is not visited, so it isn't counted");
    assert.equal(p.ballparksTotal, 2);
  });

  test("a rename changes nothing at all", () => {
    // Same venue id, different display name. No tenancy change, no new venue.
    const before = run(
      [visit("rate", "2015-06-01", true)],
      [tenancy({ franchiseId: "cws", venueId: "rate", startYear: 1991 })],
      [venue("rate", { name: "U.S. Cellular Field" })],
      [franchise("cws")],
    );
    const after = run(
      [visit("rate", "2015-06-01", true)],
      [tenancy({ franchiseId: "cws", venueId: "rate", startYear: 1991 })],
      [venue("rate", { name: "Rate Field" })],
      [franchise("cws")],
    );
    assert.equal(before.teamsChecked, after.teamsChecked);
    assert.equal(before.ballparksChecked, after.ballparksChecked);
    assert.equal(before.asteriskCount, 0);
    assert.equal(after.asteriskCount, 0);
    assert.equal(after.byVenue.get("rate")?.state, "done");
  });

  test("a temporary venue nobody has visited reads as temporary, not not-done", () => {
    const p = run(
      [],
      [tenancy({ franchiseId: "ath", venueId: "sutter", startYear: 2025, endYear: 2027, isTemporary: true })],
      [venue("sutter")],
      [franchise("ath")],
    );
    assert.equal(p.byVenue.get("sutter")?.state, "temporary");
    assert.equal(p.ballparksChecked, 0);
    assert.equal(p.ballparksTotal, 1);
  });

  test("counts are stable when the same park is visited twice", () => {
    const p = run(
      [visit("wrigley", "2023-05-01", true), visit("wrigley", "2024-07-14", true)],
      [tenancy({ franchiseId: "chc", venueId: "wrigley" })],
      [venue("wrigley")],
      [franchise("chc")],
    );
    assert.equal(p.teamsChecked, 1);
    assert.equal(p.ballparksChecked, 1);
  });
});
