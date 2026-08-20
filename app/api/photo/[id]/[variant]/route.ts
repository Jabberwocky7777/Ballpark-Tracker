import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { resolveDerivativePath } from "@/lib/photo-path";

export const dynamic = "force-dynamic";

/**
 * Serves a published photo derivative by opaque id.
 *
 * Rules this route exists to enforce:
 *   - the filesystem path is never built from user input; it comes from the
 *     database, and the id is only ever used as a lookup key
 *   - a private photo is a 404, not a 403 -- the id should not confirm itself
 *   - only derivatives are served, never an original, and derivatives are
 *     written with EXIF stripped, so no coordinates leave the database
 */

const ALLOWED_VARIANTS = new Set(["thumb", "web"]);

const CONTENT_TYPES: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  png: "image/png",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; variant: string }> },
) {
  const { id, variant } = await params;

  if (!ALLOWED_VARIANTS.has(variant)) return new Response(null, { status: 404 });

  const row = getDb()
    .select({
      path: schema.photoVariants.path,
      format: schema.photoVariants.format,
      isPublic: schema.photos.isPublic,
    })
    .from(schema.photoVariants)
    .innerJoin(schema.photos, eq(schema.photoVariants.photoId, schema.photos.id))
    .where(and(eq(schema.photoVariants.photoId, id), eq(schema.photoVariants.kind, variant)))
    .get();

  // Unknown id, unknown variant, and unpublished photo are indistinguishable.
  if (!row || row.isPublic !== 1) return new Response(null, { status: 404 });

  // Defence in depth: the path came from our own database, but a corrupted row
  // must not be able to read outside the derivatives directory.
  const target = resolveDerivativePath(process.env.DERIVED_DIR ?? "/photos/derived", row.path);
  if (!target) {
    console.error(`[photo] refusing stored path outside the derivatives root: ${row.path}`);
    return new Response(null, { status: 404 });
  }

  let size: number;
  try {
    const info = await stat(target);
    if (!info.isFile()) return new Response(null, { status: 404 });
    size = info.size;
  } catch {
    // The database says it exists and the disk disagrees. Derivatives are
    // regenerable, so this is a 404 and a log line, not an error page.
    console.error(`[photo] missing derivative on disk: ${target}`);
    return new Response(null, { status: 404 });
  }

  const stream = createReadStream(target) as unknown as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": CONTENT_TYPES[row.format.toLowerCase()] ?? "application/octet-stream",
      "Content-Length": String(size),
      // Immutable: a derivative's bytes never change, and a new photo gets a
      // new id.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
