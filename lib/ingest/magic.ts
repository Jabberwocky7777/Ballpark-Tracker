/**
 * What kind of image this actually is, decided from the bytes.
 *
 * An extension is a claim made by whoever named the file, and the whole upload
 * surface treats it as untrusted: `.jpg` on a zip is the oldest trick there is,
 * and the decoders underneath this (libheif, libvips) have a long CVE history,
 * so nothing reaches them without being recognised first.
 *
 * Pure and dependency-free -- no fs, no sharp -- so every rejection case can be
 * tested from a byte array.
 */

export type ImageFormat = "jpeg" | "png" | "heic" | "heif" | "tiff" | "webp";

export interface SniffedImage {
  format: ImageFormat;
  mime: string;
  /** The extension the original is stored under. Ours, never the uploader's. */
  ext: string;
}

const FORMATS: Record<ImageFormat, { mime: string; ext: string }> = {
  jpeg: { mime: "image/jpeg", ext: "jpg" },
  png: { mime: "image/png", ext: "png" },
  heic: { mime: "image/heic", ext: "heic" },
  heif: { mime: "image/heif", ext: "heif" },
  tiff: { mime: "image/tiff", ext: "tif" },
  webp: { mime: "image/webp", ext: "webp" },
};

/**
 * ISO base-media brands that carry HEVC or AVC stills. `mif1`/`msf1` are the
 * generic image brands iOS writes for some bursts and edits, so excluding them
 * silently drops real photos.
 */
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs"]);
const HEIF_BRANDS = new Set(["mif1", "msf1", "avif", "avis"]);

const ascii = (b: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...b.subarray(from, to));

const startsWith = (b: Uint8Array, sig: number[]) =>
  b.length >= sig.length && sig.every((v, i) => b[i] === v);

/** Null when the bytes are not an image we are prepared to decode. */
export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  const format = detect(bytes);
  return format ? { format, ...FORMATS[format] } : null;
}

function detect(b: Uint8Array): ImageFormat | null {
  if (b.length < 12) return null;

  if (startsWith(b, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(b, [0x49, 0x49, 0x2a, 0x00])) return "tiff"; // little-endian
  if (startsWith(b, [0x4d, 0x4d, 0x00, 0x2a])) return "tiff"; // big-endian
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "webp";

  // ISO base media: [4-byte box size]["ftyp"][4-byte major brand]
  if (ascii(b, 4, 8) === "ftyp") {
    const brand = ascii(b, 8, 12).toLowerCase();
    if (HEIC_BRANDS.has(brand)) return "heic";
    if (HEIF_BRANDS.has(brand)) return "heif";
  }

  return null;
}

/** Whether decoding needs the HEIC path rather than sharp's ordinary readers. */
export function needsHeicDecode(format: ImageFormat): boolean {
  return format === "heic" || format === "heif";
}
