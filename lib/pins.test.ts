import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { separatePins, type ProjectedVenue } from "./pins.ts";

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
    // Globe Life Field and the park it replaced, 0.1px apart in reality.
    const out = separatePins([pin("globelife", 300, 300), pin("globelifepark", 300.1, 300)], 16);
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

  test("resolves a dense cluster without leaving any pair overlapping", () => {
    const cluster = Array.from({ length: 6 }, (_, i) => pin(`p${i}`, 250 + i * 0.5, 250 + i * 0.3));
    assert.ok(minGap(separatePins(cluster, 16)) >= 15.9);
  });

  test("does not mutate its input", () => {
    const input = [pin("a", 100, 100), pin("b", 101, 100)];
    separatePins(input);
    assert.equal(input[0].x, 100);
    assert.equal(input[0].nudged, false);
  });
});
