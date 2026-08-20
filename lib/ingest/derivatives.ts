import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { decodeToRaster } from "./decode.ts";
import type { ImageFormat } from "./magic.ts";
import { derivativeRelativePath } from "./storage-path.ts";

/**
 * The only image bytes the public ever sees, and the place EXIF stripping
 * actually happens.
 *
 * sharp writes no metadata unless asked to with `withMetadata()`, so the
 * stripping is the absence of that call -- which is exactly the kind of
 * security property that gets reintroduced by a well-meaning edit adding it
 * back for colour profiles. Do not add it. Coordinates and timestamps live in
 * the database; a published photo carries neither.
 *
 * `.rotate()` with no argument applies the EXIF orientation and then drops the
 * tag, which is the one piece of metadata that has to survive as pixels rather
 * than as a tag -- without it every portrait photo renders sideways once the
 * tag is gone.
 */

interface VariantSpec {
  kind: string;
  width: number;
  quality: number;
}

const VARIANTS: VariantSpec[] = [
  // Enough for the map hover card and the queue grid at 2x.
  { kind: "thumb", width: 640, quality: 74 },
  // The lightbox. Beyond this, a phone photo gains nothing worth the bytes.
  { kind: "web", width: 1800, quality: 82 },
];

const FORMAT = "webp";

interface GeneratedVariant {
  kind: string;
  path: string;
  format: string;
  width: number;
}

interface DerivativeResult {
  variants: GeneratedVariant[];
  /** Dimensions of the original, for layout without reading the file again. */
  width: number | null;
  height: number | null;
}

/**
 * Decodes once, then writes every variant from that single raster.
 *
 * Runs only from the job worker -- see decode.ts on why this must never sit in
 * a request.
 */
export async function generateDerivatives(
  original: Buffer,
  sourceFormat: ImageFormat,
  photoId: string,
  derivedRoot: string,
): Promise<DerivativeResult> {
  const sharp = (await import("sharp")).default;
  const raster = await decodeToRaster(original, sourceFormat);

  const source = sharp(raster, { failOn: "error" }).rotate();
  const meta = await source.metadata();

  // Post-rotation dimensions: metadata reports the stored orientation, and a
  // portrait iPhone photo stores as landscape plus a tag.
  const swapped = (meta.orientation ?? 1) >= 5;
  const width = swapped ? meta.height : meta.width;
  const height = swapped ? meta.width : meta.height;

  const variants: GeneratedVariant[] = [];

  for (const spec of VARIANTS) {
    const relative = derivativeRelativePath(photoId, spec.kind, FORMAT);
    if (!relative) throw new Error(`refusing to write a derivative for id ${photoId}`);

    const target = join(derivedRoot, relative);
    await mkdir(dirname(target), { recursive: true });

    const bytes = await sharp(raster, { failOn: "error" })
      .rotate()
      // withoutEnlargement: a small original stays small rather than being
      // upscaled into a blurrier, larger file.
      .resize({ width: spec.width, withoutEnlargement: true })
      .webp({ quality: spec.quality })
      .toBuffer();

    await writeFile(target, bytes);

    variants.push({
      kind: spec.kind,
      path: relative,
      format: FORMAT,
      width: Math.min(spec.width, width ?? spec.width),
    });
  }

  return { variants, width: width ?? null, height: height ?? null };
}
