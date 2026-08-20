import Link from "next/link";
import { getAllVisits, getVenues } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/** Dense on purpose. This gets used one-handed in a hotel. */
export default function AdminVisitsPage() {
  // Admin sees everything, published or not. That is the point of the page.
  const visits = getAllVisits();
  const venueById = new Map(getVenues().map((v) => [v.id, v]));

  return (
    <main className="pt-5">
      <h1 className="display text-[26px] leading-tight text-ink">Visits</h1>

      {visits.length === 0 ? (
        <p className="mt-4 text-[14px] text-muted">
          No visits recorded. The first one goes in when you get back from a game.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-paper-line border-y border-paper-line">
          {visits.map((v) => {
            const venue = venueById.get(v.venueId);
            return (
              <li key={v.id} className="flex items-baseline gap-3 py-2.5">
                <span className="tabular w-[86px] shrink-0 text-[12px] text-muted">{v.visitDate}</span>
                <span className="flex-1 text-[14px] text-ink">
                  {venue ? (
                    <Link href={`/park/${venue.slug}`} className="hover:text-accent">
                      {venue.name}
                    </Link>
                  ) : (
                    v.venueId
                  )}
                </span>
                {!v.attendedGame && <span className="label text-muted">no game</span>}
                {!v.isPublic && <span className="label text-muted">private</span>}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 text-[13px] text-muted">
        Editing arrives with the ingest pipeline.
      </p>
    </main>
  );
}
