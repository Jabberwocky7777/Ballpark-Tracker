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
      <h1 className="display text-[26px] leading-tight text-chalk">Visits</h1>

      {visits.length === 0 ? (
        <p className="mt-4 text-[14px] text-chalk-muted">
          No visits recorded. The first one goes in when you get back from a game.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-ink-line border-y border-ink-line">
          {visits.map((v) => {
            const venue = venueById.get(v.venueId);
            return (
              <li key={v.id} className="flex items-baseline gap-3 py-2.5">
                <span className="tabular w-[86px] shrink-0 text-[12px] text-chalk-dim">{v.visitDate}</span>
                <span className="flex-1 text-[14px] text-chalk">
                  {venue ? (
                    <Link href={`/park/${venue.slug}`} className="hover:text-accent">
                      {venue.name}
                    </Link>
                  ) : (
                    v.venueId
                  )}
                </span>
                {!v.attendedGame && <span className="label text-chalk-dim">no game</span>}
                {!v.isPublic && <span className="label text-chalk-dim">private</span>}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 text-[13px] text-chalk-dim">
        Editing arrives with the ingest pipeline.
      </p>
    </main>
  );
}
