import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolve, sep } from "node:path";
import { resolveDerivativePath } from "./photo-path.ts";

const ROOT = resolve("/photos/derived");

describe("resolveDerivativePath", () => {
  test("resolves an ordinary relative path inside the root", () => {
    const out = resolveDerivativePath(ROOT, "ab/cd/photo-thumb.jpg");
    assert.equal(out, resolve(ROOT, "ab/cd/photo-thumb.jpg"));
  });

  test("accepts an absolute path that is genuinely inside the root", () => {
    const inside = resolve(ROOT, "ab/photo.jpg");
    assert.equal(resolveDerivativePath(ROOT, inside), inside);
  });

  test("refuses traversal out of the root", () => {
    for (const bad of [
      "../originals/secret.heic",
      "ab/../../originals/secret.heic",
      "../../../../etc/passwd",
      `..${sep}originals${sep}secret.heic`,
    ]) {
      assert.equal(resolveDerivativePath(ROOT, bad), null, `should refuse ${bad}`);
    }
  });

  test("refuses an absolute path outside the root", () => {
    assert.equal(resolveDerivativePath(ROOT, resolve("/photos/originals/a.heic")), null);
    assert.equal(resolveDerivativePath(ROOT, resolve("/etc/passwd")), null);
  });

  test("refuses a sibling directory that merely shares a prefix", () => {
    // /photos/derived-secret must not pass a naive startsWith check.
    assert.equal(resolveDerivativePath(ROOT, resolve("/photos/derived-secret/a.jpg")), null);
  });

  test("refuses the root itself, which is a directory", () => {
    assert.equal(resolveDerivativePath(ROOT, ""), null);
    assert.equal(resolveDerivativePath(ROOT, "."), null);
  });

  test("refuses a path containing a NUL byte", () => {
    assert.equal(resolveDerivativePath(ROOT, "ab/photo.jpg\0.png"), null);
  });

  test("traversal that lands back inside the root is allowed", () => {
    // Not an escape: it resolves within the root, so it is merely ugly.
    const out = resolveDerivativePath(ROOT, "ab/../cd/photo.jpg");
    assert.equal(out, resolve(ROOT, "cd/photo.jpg"));
  });
});
