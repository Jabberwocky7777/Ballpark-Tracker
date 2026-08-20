import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  haversineMetres,
  homeGuardFromEnv,
  isNearHome,
  matchVenue,
  tierForDistance,
} from "./geo.ts";

// Real coordinates of public landmarks, so the numbers can be sanity-checked.
const WRIGLEY = { lat: 41.9484, lng: -87.6553 };
const RATE_FIELD = { lat: 41.8299, lng: -87.6338 };
const PNC = { lat: 40.4469, lng: -80.0057 };

describe("haversineMetres", () => {
  test("is zero for the same point", () => {
    assert.equal(haversineMetres(WRIGLEY, WRIGLEY), 0);
  });

  test("matches the known distance between the two Chicago parks", () => {
    // Roughly 13.3 km apart. Allow 300m of slack for the sphere approximation.
    const d = haversineMetres(WRIGLEY, RATE_FIELD);
    assert.ok(Math.abs(d - 13_300) < 300, `expected about 13.3km, got ${Math.round(d)}m`);
  });

  test("is symmetric", () => {
    assert.equal(haversineMetres(WRIGLEY, PNC), haversineMetres(PNC, WRIGLEY));
  });

  test("handles a small offset without losing precision", () => {
    // ~111m north.
    const d = haversineMetres(WRIGLEY, { lat: WRIGLEY.lat + 0.001, lng: WRIGLEY.lng });
    assert.ok(d > 100 && d < 120, `expected about 111m, got ${d}`);
  });
});

describe("tierForDistance", () => {
  test("under 400m is confident", () => {
    assert.equal(tierForDistance(0), "confident");
    assert.equal(tierForDistance(399), "confident");
  });

  test("400m to 2km is suggested -- the parking lot and the bar across the street", () => {
    assert.equal(tierForDistance(400), "suggested");
    assert.equal(tierForDistance(1_500), "suggested");
    assert.equal(tierForDistance(2_000), "suggested");
  });

  test("beyond 2km goes to the manual queue", () => {
    assert.equal(tierForDistance(2_001), "unmatched");
    assert.equal(tierForDistance(50_000), "unmatched");
  });
});

describe("matchVenue", () => {
  const candidates = [
    { id: "wrigley", ...WRIGLEY },
    { id: "rate", ...RATE_FIELD },
    { id: "pnc", ...PNC },
  ];

  test("a photo taken in the seats matches confidently", () => {
    const m = matchVenue({ lat: 41.9486, lng: -87.6556 }, candidates);
    assert.equal(m.venueId, "wrigley");
    assert.equal(m.tier, "confident");
  });

  test("a photo from the bar across the street is suggested, not assigned", () => {
    // ~700m from Wrigley.
    const m = matchVenue({ lat: 41.9548, lng: -87.6553 }, candidates);
    assert.equal(m.venueId, "wrigley");
    assert.equal(m.tier, "suggested");
  });

  test("a photo from the wrong side of the city goes to the queue", () => {
    const m = matchVenue({ lat: 41.8781, lng: -87.6298 }, candidates);
    assert.equal(m.tier, "unmatched");
  });

  test("still reports the nearest venue and distance when unmatched, so the decision can be re-run", () => {
    const m = matchVenue({ lat: 41.8781, lng: -87.6298 }, candidates);
    assert.equal(m.venueId, "rate", "the nearest is still recorded");
    assert.ok(m.distanceMetres && m.distanceMetres > 2_000);
  });

  test("picks the nearer of two parks in the same city", () => {
    assert.equal(matchVenue({ lat: 41.8302, lng: -87.634 }, candidates).venueId, "rate");
    assert.equal(matchVenue({ lat: 41.9482, lng: -87.6551 }, candidates).venueId, "wrigley");
  });

  test("no candidates yields a null match rather than throwing", () => {
    const m = matchVenue(WRIGLEY, []);
    assert.equal(m.venueId, null);
    assert.equal(m.distanceMetres, null);
    assert.equal(m.tier, "unmatched");
  });
});

describe("isNearHome", () => {
  const HOME = { lat: 44.9778, lng: -93.265 };

  test("flags a photo taken at home", () => {
    assert.equal(isNearHome({ lat: 44.9779, lng: -93.2651 }, HOME, 2), true);
  });

  test("does not flag a photo taken at a ballpark", () => {
    assert.equal(isNearHome(WRIGLEY, HOME, 2), false);
  });

  test("respects the radius", () => {
    // ~1.1km north of home.
    const nearby = { lat: HOME.lat + 0.01, lng: HOME.lng };
    assert.equal(isNearHome(nearby, HOME, 2), true);
    assert.equal(isNearHome(nearby, HOME, 0.5), false);
  });

  test("no-ops when home is not configured, rather than flagging everything", () => {
    assert.equal(isNearHome(WRIGLEY, null, 2), false);
    assert.equal(isNearHome(WRIGLEY, {}, 2), false);
    assert.equal(isNearHome(WRIGLEY, { lat: NaN, lng: NaN }, 2), false);
  });

  test("no-ops when the photo has no coordinates", () => {
    assert.equal(isNearHome(null, HOME, 2), false);
    assert.equal(isNearHome({ lat: NaN, lng: NaN }, HOME, 2), false);
  });

  test("a zero or negative radius disables the guard rather than matching everything", () => {
    assert.equal(isNearHome(HOME, HOME, 0), false);
    assert.equal(isNearHome(HOME, HOME, -1), false);
  });
});

describe("homeGuardFromEnv", () => {
  test("is disabled when the coordinates are unset", () => {
    assert.equal(homeGuardFromEnv({}).home, null);
    assert.equal(homeGuardFromEnv({ HOME_LAT: "", HOME_LNG: "" }).home, null);
  });

  test("is disabled when only one coordinate is set", () => {
    assert.equal(homeGuardFromEnv({ HOME_LAT: "44.9" }).home, null);
  });

  test("reads both coordinates and defaults the radius to 2km", () => {
    const g = homeGuardFromEnv({ HOME_LAT: "44.9778", HOME_LNG: "-93.265" });
    assert.deepEqual(g.home, { lat: 44.9778, lng: -93.265 });
    assert.equal(g.radiusKm, 2);
  });

  test("honours an explicit radius", () => {
    const g = homeGuardFromEnv({ HOME_LAT: "44.9778", HOME_LNG: "-93.265", HOME_GUARD_KM: "5" });
    assert.equal(g.radiusKm, 5);
  });
});
