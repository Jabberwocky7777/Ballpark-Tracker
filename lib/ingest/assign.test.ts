import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  chooseAssignment,
  clusterSessions,
  propagateSessionMatches,
  type Assignment,
  type SessionPhoto,
  type VisitRecord,
} from "./assign.ts";
import type { GeoMatch } from "../geo.ts";

const match = (venueId: string | null, metres: number | null, tier: GeoMatch["tier"]): GeoMatch => ({
  venueId,
  distanceMetres: metres,
  tier,
});

const VISITS: VisitRecord[] = [
  { id: "v-wrigley", venueId: "wrigley", visitDate: "2026-06-14" },
  { id: "v-comiskey", venueId: "guaranteed-rate", visitDate: "2026-06-15" },
];

describe("chooseAssignment", () => {
  test("a confident match assigns the park and links the visit for that day", () => {
    const a = chooseAssignment(match("wrigley", 120, "confident"), "2026-06-14", VISITS);
    assert.deepEqual(a, {
      venueId: "wrigley",
      visitId: "v-wrigley",
      confidence: "confident",
      reason: "gps-confident",
    });
  });

  test("a confident match with no visit on that date still assigns the park", () => {
    // The visit gets created afterwards; the photo is not held hostage to it.
    const a = chooseAssignment(match("wrigley", 120, "confident"), "2027-01-01", VISITS);
    assert.equal(a.venueId, "wrigley");
    assert.equal(a.visitId, null);
    assert.equal(a.confidence, "confident");
  });

  test("the parking lot is a suggestion, never an assignment", () => {
    const a = chooseAssignment(match("wrigley", 900, "suggested"), "2026-06-14", VISITS);
    assert.equal(a.venueId, "wrigley");
    assert.equal(a.visitId, null, "a suggestion never links a visit on its own");
    assert.equal(a.confidence, "suggested");
    assert.equal(a.reason, "gps-suggested");
  });

  test("no GPS but an unambiguous day proposes that park", () => {
    const a = chooseAssignment(null, "2026-06-15", VISITS);
    assert.equal(a.venueId, "guaranteed-rate");
    assert.equal(a.confidence, "suggested");
    assert.equal(a.reason, "date-only");
  });

  test("no GPS and a two-park day proposes nothing", () => {
    const doubleHeader: VisitRecord[] = [
      { id: "v-a", venueId: "wrigley", visitDate: "2026-06-14" },
      { id: "v-b", venueId: "guaranteed-rate", visitDate: "2026-06-14" },
    ];
    const a = chooseAssignment(null, "2026-06-14", doubleHeader);
    assert.equal(a.venueId, null);
    assert.equal(a.confidence, "unmatched");
  });

  test("two visits to the same park on one day still resolve to that park", () => {
    const twice: VisitRecord[] = [
      { id: "v-a", venueId: "wrigley", visitDate: "2026-06-14" },
      { id: "v-b", venueId: "wrigley", visitDate: "2026-06-14" },
    ];
    const a = chooseAssignment(null, "2026-06-14", twice);
    assert.equal(a.venueId, "wrigley");
    // Which of the two visits is genuinely ambiguous, so it stays unlinked.
    assert.equal(a.visitId, null);
  });

  test("nothing to go on at all lands in the queue", () => {
    assert.equal(chooseAssignment(null, null, VISITS).confidence, "unmatched");
    assert.equal(chooseAssignment(match("wrigley", 40_000, "unmatched"), null, VISITS).venueId, null);
  });
});

// ------------------------------------------------------------- sessions ----

const photo = (id: string, takenUtc: string | null, assignment: Assignment): SessionPhoto => ({
  id,
  takenUtc,
  assignment,
});

const CONFIDENT: Assignment = {
  venueId: "wrigley",
  visitId: null,
  confidence: "confident",
  reason: "gps-confident",
};
const NOTHING: Assignment = {
  venueId: null,
  visitId: null,
  confidence: "unmatched",
  reason: "unmatched",
};

describe("clusterSessions", () => {
  test("groups an evening together and splits the next day off", () => {
    const sessions = clusterSessions([
      photo("a", "2026-06-14T23:10:00Z", NOTHING),
      photo("b", "2026-06-15T00:30:00Z", NOTHING),
      photo("c", "2026-06-16T18:00:00Z", NOTHING),
    ]);
    assert.deepEqual(
      sessions.map((s) => s.map((p) => p.id)),
      [["a", "b"], ["c"]],
    );
  });

  test("orders by time regardless of input order", () => {
    const sessions = clusterSessions([
      photo("late", "2026-06-14T23:00:00Z", NOTHING),
      photo("early", "2026-06-14T21:00:00Z", NOTHING),
    ]);
    assert.deepEqual(sessions[0].map((p) => p.id), ["early", "late"]);
  });

  test("a gap of exactly four hours is still one session", () => {
    const sessions = clusterSessions([
      photo("a", "2026-06-14T18:00:00Z", NOTHING),
      photo("b", "2026-06-14T22:00:00Z", NOTHING),
    ]);
    assert.equal(sessions.length, 1);
  });

  test("photos with no timestamp cluster with nobody", () => {
    const sessions = clusterSessions([
      photo("timed", "2026-06-14T18:00:00Z", NOTHING),
      photo("scan-1", null, NOTHING),
      photo("scan-2", null, NOTHING),
    ]);
    assert.deepEqual(
      sessions.map((s) => s.map((p) => p.id)),
      [["timed"], ["scan-1"], ["scan-2"]],
    );
  });
});

describe("propagateSessionMatches", () => {
  test("a confident photo pulls its session along, as suggestions", () => {
    const out = propagateSessionMatches([
      photo("outside", "2026-06-14T22:00:00Z", CONFIDENT),
      photo("concourse", "2026-06-14T23:00:00Z", NOTHING),
    ]);
    const concourse = out.find((p) => p.id === "concourse") as SessionPhoto;
    assert.equal(concourse.assignment.venueId, "wrigley");
    assert.equal(concourse.assignment.confidence, "suggested", "never promoted to confident");
    assert.equal(concourse.assignment.reason, "session");
  });

  test("never overwrites a photo that matched confidently on its own", () => {
    const elsewhere: Assignment = { ...CONFIDENT, venueId: "guaranteed-rate" };
    const out = propagateSessionMatches([
      photo("a", "2026-06-14T22:00:00Z", CONFIDENT),
      photo("b", "2026-06-14T23:00:00Z", elsewhere),
    ]);
    // Two anchors disagree, so the session is left entirely alone.
    assert.equal(out.find((p) => p.id === "b")?.assignment.venueId, "guaranteed-rate");
    assert.equal(out.find((p) => p.id === "a")?.assignment.venueId, "wrigley");
  });

  test("a session with no confident anchor is left alone", () => {
    const out = propagateSessionMatches([
      photo("a", "2026-06-14T22:00:00Z", NOTHING),
      photo("b", "2026-06-14T23:00:00Z", NOTHING),
    ]);
    assert.ok(out.every((p) => p.assignment.venueId === null));
  });

  test("does not reach across a gap into the next evening", () => {
    const out = propagateSessionMatches([
      photo("day-one", "2026-06-14T22:00:00Z", CONFIDENT),
      photo("day-two", "2026-06-16T22:00:00Z", NOTHING),
    ]);
    assert.equal(out.find((p) => p.id === "day-two")?.assignment.venueId, null);
  });

  test("leaves the input array untouched", () => {
    const input = [
      photo("a", "2026-06-14T22:00:00Z", CONFIDENT),
      photo("b", "2026-06-14T23:00:00Z", NOTHING),
    ];
    propagateSessionMatches(input);
    assert.equal(input[1].assignment.venueId, null);
  });
});
