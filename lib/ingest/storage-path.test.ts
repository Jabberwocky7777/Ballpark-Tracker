import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { derivativeRelativePath, originalRelativePath } from "./storage-path.ts";

const SHA = "a".repeat(64);
const MIXED = "AbC" + "0".repeat(61);

describe("originalRelativePath", () => {
  test("fans out two levels deep by the leading hash bytes", () => {
    const sha = "0123456789abcdef".repeat(4);
    assert.equal(originalRelativePath(sha, "heic"), `01/23/${sha}.heic`);
  });

  test("normalises case and a leading dot on the extension", () => {
    assert.equal(originalRelativePath(MIXED, ".JPG"), originalRelativePath(MIXED.toLowerCase(), "jpg"));
  });

  test("refuses anything that is not a sha256", () => {
    for (const bad of ["", "abc", "z".repeat(64), SHA + "0", SHA.slice(0, 63)]) {
      assert.equal(originalRelativePath(bad, "jpg"), null, bad.slice(0, 12));
    }
  });

  test("refuses an extension that could reach outside its directory", () => {
    for (const bad of ["", ".", "../x", "jp/g", "a".repeat(6), "jpg\0", "j g"]) {
      assert.equal(originalRelativePath(SHA, bad), null, JSON.stringify(bad));
    }
  });
});

describe("derivativeRelativePath", () => {
  test("names the variant so one photo's files sit together", () => {
    const id = "0123456789abcdef";
    assert.equal(derivativeRelativePath(id, "thumb", "webp"), `01/23/${id}-thumb.webp`);
    assert.equal(derivativeRelativePath(id, "web", "webp"), `01/23/${id}-web.webp`);
  });

  test("refuses an id that is not an opaque hex handle", () => {
    const bad = [
      "",
      "0123456", // a character short of the minimum
      "f".repeat(65), // a character past the maximum
      "zzzzzzzzzzzzzzzz", // right length, wrong alphabet
      "01 23456789",
      "../../etc/passwd",
    ];
    // Fixtures are deliberately repetitive rather than random-looking: a
    // plausible-looking hex handle here reads as a leaked key to a secret
    // scanner, and CI is right not to take our word for it.
    for (const id of bad) {
      assert.equal(derivativeRelativePath(id, "thumb", "webp"), null, id);
    }
  });

  test("refuses a kind that is not a plain lowercase token", () => {
    for (const bad of ["", "..", "Thumb", "thumb/x", "thumb-1", "a".repeat(17)]) {
      assert.equal(derivativeRelativePath("0123456789abcdef", bad, "webp"), null, bad);
    }
  });
});
