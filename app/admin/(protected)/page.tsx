import { getDb, schema } from "@/lib/db";
import { eq, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * The assignment queue. Expect 20-40% of photos to land here with no usable
 * GPS, so this is a primary interface, not a fallback -- dense, fast, and
 * usable with one thumb.
 */
export default function AdminQueuePage() {
  const db = getDb();
  const unassigned = db.select().from(schema.photos).where(isNull(schema.photos.visitId)).limit(50).all();
  const needsReview = db.select().from(schema.photos).where(eq(schema.photos.needsReview, 1)).limit(50).all();

  return (
    <main className="pt-5">
      <h1 className="display text-[26px] leading-tight text-ink">Queue</h1>

      <section className="mt-6">
        <h2 className="label text-muted">Needs a park</h2>
        {unassigned.length === 0 ? (
          <p className="mt-2 text-[14px] text-muted">
            Nothing waiting. Photos with no usable GPS land here to be assigned.
          </p>
        ) : (
          <p className="tabular mt-2 text-[14px] text-ink">{unassigned.length} photos</p>
        )}
      </section>

      <section className="mt-7">
        <h2 className="label text-muted">Needs review</h2>
        {needsReview.length === 0 ? (
          <p className="mt-2 text-[14px] text-muted">
            Nothing waiting. Guest uploads and anything flagged near home arrive here first.
          </p>
        ) : (
          <p className="tabular mt-2 text-[14px] text-ink">{needsReview.length} photos</p>
        )}
      </section>

      <p className="mt-10 text-[13px] text-muted">
        Upload and bulk assignment arrive with the ingest pipeline.
      </p>
    </main>
  );
}
