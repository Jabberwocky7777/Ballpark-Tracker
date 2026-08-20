import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { nearestPin, separatePins, type ProjectedVenue } from "./pins.ts";

const pin = (id: string, x: number, y: number): ProjectedVenue => ({
  id,
  x,
  y,
  anchorX: x,
  anchorY: y,
  nudged: false,
});

const minGap = (pins: ProjectedVenue[]) => {
  let min = Infinity;
  for (let i = 0; i < pins.length; i++) {
    for (let j = i + 1; j < pins.length; j++) {
      min = Math.min(min, Math.hypot(pins[i].x - pins[j].x, pins[i].y - pins[j].y));
    }
  }
  return min;
};

describe("separatePins", () => {
  test("leaves well-spaced pins exactly where they were", () => {
    const input = [pin("a", 100, 100), pin("b", 400, 300)];
    const out = separatePins(input);
    const a = out.find((p) => p.id === "a")!;
    assert.equal(a.x, 100);
    assert.equal(a.y, 100);
    assert.equal(a.nudged, false);
  });

  test("pushes near-coincident pins to the minimum distance", () => {
    // Two parks sharing a site, a tenth of a pixel apart at map scale. Real
    // pairs like this come and go from the seed; the arithmetic does not.
    const out = separatePins([pin("a", 300, 300), pin("b", 300.1, 300)], 16);
    assert.ok(minGap(out) >= 15.9, `expected >= 16, got ${minGap(out)}`);
    assert.ok(out.every((p) => p.nudged));
  });

  test("separates exactly coincident pins, which have no natural direction", () => {
    const out = separatePins([pin("a", 200, 200), pin("b", 200, 200)], 16);
    assert.ok(Number.isFinite(out[0].x) && Number.isFinite(out[1].x), "must not produce NaN");
    assert.ok(minGap(out) >= 15.9);
  });

  test("keeps the true position so the pin can be tethered back", () => {
    const out = separatePins([pin("a", 300, 300), pin("b", 302, 300)], 16);
    for (const p of out) {
      assert.equal(p.anchorX, p.id === "a" ? 300 : 302);
      assert.equal(p.anchorY, 300);
    }
  });

  test("is deterministic, so server and client agree", () => {
    const build = () => [pin("a", 100, 100), pin("b", 101, 100), pin("c", 100, 101)];
    const first = separatePins(build());
    const second = separatePins(build());
    assert.deepEqual(first, second);
  });

  test("input order does not change the result", () => {
    const a = separatePins([pin("a", 100, 100), pin("b", 101, 100)]);
    const b = separatePins([pin("b", 101, 100), pin("a", 100, 100)]);
    assert.deepEqual(a, b);
  });

  test("resolves a dense cluster when the drift cap allows it", () => {
    const cluster = Array.from({ length: 6 }, (_, i) => pin(`p${i}`, 250 + i * 0.5, 250 + i * 0.3));
    assert.ok(minGap(separatePins(cluster, 16, 60)) >= 15.9);
  });

  test("the drift cap wins over separation, so no pin lands somewhere false", () => {
    // Deliberate: a park nudged into the ocean to make room reads as a bug,
    // while two pins touching still reads as two parks.
    const cluster = Array.from({ length: 6 }, (_, i) => pin(`p${i}`, 250 + i * 0.5, 250 + i * 0.3));
    const cap = 10;
    const out = separatePins(cluster, 40, cap);
    for (const p of out) {
      const drift = Math.hypot(p.x - p.anchorX, p.y - p.anchorY);
      assert.ok(drift <= cap + 0.001, `${p.id} drifted ${drift.toFixed(1)}, cap is ${cap}`);
    }
  });

  test("cities a hundred-odd kilometres apart are left where they are", () => {
    // San Francisco and Sacramento are about seven units apart at map scale.
    // An aggressive separation distance pushed them to opposite sides of the
    // truth, which put Oracle Park in the Pacific.
    const out = separatePins([pin("sf", 100, 300), pin("sac", 107, 296)]);
    for (const p of out) {
      assert.ok(
        Math.hypot(p.x - p.anchorX, p.y - p.anchorY) < 5,
        `${p.id} moved too far for two genuinely distinct cities`,
      );
    }
  });

  test("does not mutate its input", () => {
    const input = [pin("a", 100, 100), pin("b", 101, 100)];
    separatePins(input);
    assert.equal(input[0].x, 100);
    assert.equal(input[0].nudged, false);
  });
});

describe("nearestPin", () => {
  const dodger = pin("dodger", 94, 289);
  const angel = pin("angel", 99.5, 297.3);
  const la = [dodger, angel];

  test("aiming at a pin selects that pin, not the one painted after it", () => {
    // The reported bug: both parks carried a 15-unit target while sitting 10
    // apart, so one of them could never be selected however carefully you
    // aimed at it.
    assert.equal(nearestPin(la, dodger.x, dodger.y, 26)?.id, "dodger");
    assert.equal(nearestPin(la, angel.x, angel.y, 26)?.id, "angel");
  });

  test("the boundary between two pins falls exactly halfway", () => {
    const midX = (dodger.x + angel.x) / 2;
    const midY = (dodger.y + angel.y) / 2;
    const towardsDodger = nearestPin(la, midX - 0.4, midY - 0.6, 26);
    const towardsAngel = nearestPin(la, midX + 0.4, midY + 0.6, 26);
    assert.equal(towardsDodger?.id, "dodger");
    assert.equal(towardsAngel?.id, "angel");
  });

  test("empty ground selects nothing", () => {
    assert.equal(nearestPin(la, 400, 150, 26), null);
  });

  test("the grab radius is a hard edge", () => {
    const single = [pin("a", 100, 100)];
    assert.equal(nearestPin(single, 100, 125.9, 26)?.id, "a");
    assert.equal(nearestPin(single, 100, 126.1, 26), null);
  });

  test("array order cannot change the answer", () => {
    const forwards = nearestPin([dodger, angel], 96.75, 293.15, 26);
    const backwards = nearestPin([angel, dodger], 96.75, 293.15, 26);
    assert.equal(forwards?.id, backwards?.id);
  });

  test("every pin on a crowded map selects itself", () => {
    const pins = separatePins([
      pin("a", 300, 300), pin("b", 300.4, 300.2), pin("c", 305, 302),
      pin("d", 500, 200), pin("e", 250, 400), pin("f", 252, 401),
    ]);
    for (const p of pins) {
      assert.equal(nearestPin(pins, p.x, p.y, 26)?.id, p.id, `${p.id} selected something else`);
    }
  });
});
