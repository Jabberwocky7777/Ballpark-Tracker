import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  formatOffset,
  gpsUtcFromTags,
  parseOffsetMinutes,
  resolveTimestamp,
  venueOffsetMinutes,
} from "./timestamp.ts";

/** A 7:05pm first pitch at Wrigley on 14 July 2024. CDT is -05:00. */
const firstPitch = () => new Date(2024, 6, 14, 19, 5, 33);

describe("parseOffsetMinutes", () => {
  test("parses both signs and both separators", () => {
    assert.equal(parseOffsetMinutes("-05:00"), -300);
    assert.equal(parseOffsetMinutes("+09:30"), 570);
    assert.equal(parseOffsetMinutes("-0500"), -300);
    assert.equal(parseOffsetMinutes("+00:00"), 0);
  });

  test("rejects nonsense rather than returning zero", () => {
    for (const bad of ["", "05:00", "-5:00", "-99:00", "-05:99", "abc", null, undefined]) {
      assert.equal(parseOffsetMinutes(bad as string), null, `should reject ${bad}`);
    }
  });
});

describe("formatOffset", () => {
  test("round-trips through parseOffsetMinutes", () => {
    for (const m of [-300, 0, 330, -210, 840]) {
      assert.equal(parseOffsetMinutes(formatOffset(m)), m);
    }
  });

  test("pads correctly", () => {
    assert.equal(formatOffset(-300), "-05:00");
    assert.equal(formatOffset(330), "+05:30");
    assert.equal(formatOffset(0), "+00:00");
  });
});

describe("gpsUtcFromTags", () => {
  test("accepts the array form", () => {
    const d = gpsUtcFromTags("2024:07:15", [0, 5, 33]);
    assert.equal(d?.toISOString(), "2024-07-15T00:05:33.000Z");
  });

  test("accepts the string form, which is what broke this once before", () => {
    const d = gpsUtcFromTags("2024:07:15", "0:5:33");
    assert.equal(d?.toISOString(), "2024-07-15T00:05:33.000Z");
  });

  test("returns null on missing or malformed input rather than an invalid date", () => {
    assert.equal(gpsUtcFromTags(null, [0, 5, 33]), null);
    assert.equal(gpsUtcFromTags("2024:07:15", null), null);
    assert.equal(gpsUtcFromTags("nonsense", [0, 5, 33]), null);
    assert.equal(gpsUtcFromTags("2024:07:15", "0:5"), null);
    assert.equal(gpsUtcFromTags("2024:07:15", "a:b:c"), null);
  });
});

describe("resolveTimestamp", () => {
  test("uses OffsetTimeOriginal when the camera wrote it", () => {
    const r = resolveTimestamp({ dateTimeOriginal: firstPitch(), offsetTimeOriginal: "-05:00" });
    assert.equal(r.offsetSource, "exif-offset");
    assert.equal(r.tzOffset, "-05:00");
    assert.equal(r.takenLocal, "2024-07-14T19:05:33");
    // 19:05 CDT is 00:05 UTC the next day -- the whole point of the exercise.
    assert.equal(r.takenUtc, "2024-07-15T00:05:33.000Z");
  });

  test("derives the offset from the GPS clock when the tag is absent", () => {
    const r = resolveTimestamp({
      dateTimeOriginal: firstPitch(),
      gpsDateStamp: "2024:07:15",
      gpsTimeStamp: "0:5:33",
    });
    assert.equal(r.offsetSource, "gps-utc");
    assert.equal(r.tzOffset, "-05:00");
    assert.equal(r.takenUtc, "2024-07-15T00:05:33.000Z");
  });

  test("rounds a slightly drifted GPS clock to the quarter hour", () => {
    const r = resolveTimestamp({
      dateTimeOriginal: firstPitch(),
      // Two seconds of drift must not produce a -04:59:58 offset.
      gpsDateStamp: "2024:07:15",
      gpsTimeStamp: "0:5:35",
    });
    assert.equal(r.tzOffset, "-05:00");
  });

  test("handles a half-hour zone", () => {
    const r = resolveTimestamp({ dateTimeOriginal: firstPitch(), offsetTimeOriginal: "+05:30" });
    assert.equal(r.tzOffset, "+05:30");
  });

  test("falls back to the venue timezone when nothing else is available", () => {
    const r = resolveTimestamp({ dateTimeOriginal: firstPitch() }, -300);
    assert.equal(r.offsetSource, "venue-timezone");
    assert.equal(r.takenUtc, "2024-07-15T00:05:33.000Z");
  });

  test("prefers the exif offset over the venue guess", () => {
    const r = resolveTimestamp(
      { dateTimeOriginal: firstPitch(), offsetTimeOriginal: "-07:00" },
      -300,
    );
    assert.equal(r.offsetSource, "exif-offset");
    assert.equal(r.tzOffset, "-07:00");
  });

  test("ignores a GPS clock that disagrees by more than any real timezone", () => {
    const r = resolveTimestamp({
      dateTimeOriginal: firstPitch(),
      gpsDateStamp: "2020:01:01",
      gpsTimeStamp: "0:0:0",
    });
    assert.equal(r.offsetSource, "none", "garbage must not become a timezone");
    assert.equal(r.takenUtc, null);
  });

  test("keeps the wall clock but refuses to guess when nothing anchors it", () => {
    const r = resolveTimestamp({ dateTimeOriginal: firstPitch() });
    assert.equal(r.offsetSource, "none");
    assert.equal(r.takenLocal, "2024-07-14T19:05:33");
    assert.equal(r.takenUtc, null, "storing wall clock as UTC is the bug this prevents");
  });

  test("a photo with no date at all yields nulls, not an exception", () => {
    const r = resolveTimestamp({});
    assert.deepEqual(r, { takenUtc: null, takenLocal: null, tzOffset: null, offsetSource: "none" });
    assert.equal(resolveTimestamp({ dateTimeOriginal: new Date("nope") }).offsetSource, "none");
  });
});

describe("venueOffsetMinutes", () => {
  test("gives the summer offset for a July game in Chicago", () => {
    assert.equal(venueOffsetMinutes("America/Chicago", new Date("2024-07-14T19:00:00Z")), -300);
  });

  test("gives the winter offset for the same zone in January", () => {
    assert.equal(venueOffsetMinutes("America/Chicago", new Date("2024-01-14T19:00:00Z")), -360);
  });

  test("handles a zone that does not observe daylight saving", () => {
    assert.equal(venueOffsetMinutes("America/Phoenix", new Date("2024-07-14T19:00:00Z")), -420);
    assert.equal(venueOffsetMinutes("America/Phoenix", new Date("2024-01-14T19:00:00Z")), -420);
  });

  test("returns null for an unknown zone rather than throwing", () => {
    assert.equal(venueOffsetMinutes("Not/AZone", new Date()), null);
  });
});
