#!/usr/bin/env node
/**
 * Validates every seeded venue coordinate.
 *
 *   npm run check:coords
 *
 * A transposed lat/lng, a dropped minus sign, or a digit typo produces a park
 * that sits in the wrong state -- or in the Atlantic -- and nothing else in the
 * system notices. The map just looks slightly wrong, and only if you happen to
 * know where PNC Park is.
 *
 * Three checks, cheapest first:
 *   1. the coordinate is inside a plausible North American box
 *   2. it projects to a finite point, so it will actually render
 *   3. it falls inside the state polygon its record claims
 *
 * The third is the one that catches real mistakes.
 */
import { geoAlbers, geoContains } from "d3-geo";
import { feature } from "topojson-client";
import { createRequire } from "node:module";
import { venues } from "../lib/data/venues.ts";

const require = createRequire(import.meta.url);
const statesTopo = require("us-atlas/states-10m.json");
const states = feature(statesTopo, statesTopo.objects.states);

/** us-atlas carries state names, not postal codes. */
const STATE_NAMES = {
  AZ: "Arizona", CA: "California", CO: "Colorado", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", IL: "Illinois", MA: "Massachusetts",
  MD: "Maryland", MI: "Michigan", MN: "Minnesota", MO: "Missouri",
  NV: "Nevada", NY: "New York", OH: "Ohio", PA: "Pennsylvania",
  TX: "Texas", WA: "Washington", WI: "Wisconsin",
};

const projection = geoAlbers().rotate([96, 0]).center([-0.6, 38.7]).parallels([29.5, 45.5]);

let failures = 0;
const fail = (venue, why) => {
  failures++;
  console.error(`  FAIL  ${venue.name} (${venue.city}, ${venue.state}) — ${why}`);
};

console.log(`Checking ${venues.length} venue coordinates\n`);

for (const v of venues) {
  // 1. plausible box for North American ballparks
  if (!(v.lat > 24 && v.lat < 50)) {
    fail(v, `latitude ${v.lat} is outside 24..50 — transposed with longitude?`);
    continue;
  }
  if (!(v.lng > -125 && v.lng < -66)) {
    fail(v, `longitude ${v.lng} is outside -125..-66 — missing minus sign?`);
    continue;
  }

  // 2. projects to something renderable
  const point = projection([v.lng, v.lat]);
  if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
    fail(v, "does not project to a finite point, so its pin would not render");
    continue;
  }

  // 3. inside the state it claims. Toronto is outside the US atlas by
  //    definition, so it is checked by the box only.
  if (v.state === "ON") continue;

  const wanted = STATE_NAMES[v.state];
  if (!wanted) {
    fail(v, `state "${v.state}" is not in the lookup — add it or fix the record`);
    continue;
  }

  const polygon = states.features.find((f) => f.properties.name === wanted);
  if (!polygon) {
    fail(v, `no state polygon named "${wanted}"`);
    continue;
  }

  if (!geoContains(polygon, [v.lng, v.lat])) {
    const actual = states.features.find((f) => geoContains(f, [v.lng, v.lat]));
    fail(v, `lands in ${actual ? actual.properties.name : "no US state"}, not ${wanted}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} coordinate${failures === 1 ? "" : "s"} wrong.`);
  process.exit(1);
}
console.log("All coordinates land in the state their record claims.");
