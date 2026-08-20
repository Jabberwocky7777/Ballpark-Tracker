import { getDb, schema } from "@/lib/db";
import { pendingCount } from "@/lib/jobs/queue";
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
  const pending = pendingCount();

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

      {pending > 0 && (
        <section className="mt-7">
          <h2 className="label text-muted">Still processing</h2>
          <p className="tabular mt-2 text-[14px] text-ink">{pending} photos</p>
          <p className="mt-1 text-[13px] text-muted">
            Thumbnails are being generated in the background. Nothing needs doing.
          </p>
        </section>
      )}

      <p className="mt-10 text-[13px] text-muted">
        Bulk assignment arrives next. Until then, photos can be uploaded and are matched
        automatically wherever their location survived.
      </p>
    </main>
  );
}
