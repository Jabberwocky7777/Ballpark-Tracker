import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { needsHeicDecode, sniffImage } from "./magic.ts";

/** An ISO base-media header with the given major brand. */
function ftyp(brand: string): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes.set([0x00, 0x00, 0x00, 0x18], 0);
  bytes.set([..."ftyp"].map((c) => c.charCodeAt(0)), 4);
  bytes.set([...brand].map((c) => c.charCodeAt(0)), 8);
  return bytes;
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe("sniffImage", () => {
  test("recognises the formats that come off the phones", () => {
    assert.equal(sniffImage(JPEG)?.format, "jpeg");
    assert.equal(sniffImage(PNG)?.format, "png");
    assert.equal(sniffImage(ftyp("heic"))?.format, "heic");
  });

  test("recognises the generic ISO image brands iOS also writes", () => {
    // mif1 is what some edits and bursts carry. Dropping it drops real photos.
    assert.equal(sniffImage(ftyp("mif1"))?.format, "heif");
    assert.equal(sniffImage(ftyp("msf1"))?.format, "heif");
  });

  test("recognises every HEVC still brand", () => {
    for (const brand of ["heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs"]) {
      assert.equal(sniffImage(ftyp(brand))?.format, "heic", brand);
    }
  });

  test("recognises TIFF in both byte orders, and WebP", () => {
    const little = new Uint8Array(12);
    little.set([0x49, 0x49, 0x2a, 0x00]);
    const big = new Uint8Array(12);
    big.set([0x4d, 0x4d, 0x00, 0x2a]);
    assert.equal(sniffImage(little)?.format, "tiff");
    assert.equal(sniffImage(big)?.format, "tiff");

    const webp = new Uint8Array(12);
    webp.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0);
    webp.set([..."WEBP"].map((c) => c.charCodeAt(0)), 8);
    assert.equal(sniffImage(webp)?.format, "webp");
  });

  test("the extension is ours, not the uploader's", () => {
    // A .jpg named file that is really a HEIC still gets stored as .heic.
    assert.equal(sniffImage(ftyp("heic"))?.ext, "heic");
    assert.equal(sniffImage(JPEG)?.ext, "jpg");
  });

  test("refuses anything that is not an image we decode", () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0]);
    const elf = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0, 0, 0, 0, 0, 0, 0, 0]);
    const html = new Uint8Array([..."<!doctype html>"].map((c) => c.charCodeAt(0)));
    const mp4 = ftyp("isom"); // a real video, not a still

    for (const bad of [zip, elf, html, mp4]) assert.equal(sniffImage(bad), null);
  });

  test("refuses input too short to identify", () => {
    assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff])), null);
    assert.equal(sniffImage(new Uint8Array()), null);
  });
});

describe("needsHeicDecode", () => {
  test("is true only for the brands sharp may not be able to read", () => {
    assert.equal(needsHeicDecode("heic"), true);
    assert.equal(needsHeicDecode("heif"), true);
    assert.equal(needsHeicDecode("jpeg"), false);
    assert.equal(needsHeicDecode("png"), false);
  });
});
