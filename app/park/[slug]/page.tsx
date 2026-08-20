import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Fingerprint } from "@/components/Fingerprint";
import { computeProgress } from "@/lib/progress";
import {
  getFranchises,
  getPublicPhotosForVisit,
  getPublicVisits,
  getPublicVisitsForVenue,
  getTenancies,
  getTrips,
  getVenueBySlug,
  getVenueNameOn,
  getVenues,
} from "@/lib/db/queries";
import type { PhotoSummary } from "@/lib/db/queries";
import { notYetBlurbs } from "@/lib/data/blurbs";

/**
 * Rendered per request rather than prerendered. The two display names arrive as
 * runtime env from the app wizard; a statically generated page would bake in
 * whatever the values were at image build time, which is nothing.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const venue = getVenueBySlug(slug);
  if (!venue) return {};
  return {
    title: `${venue.name} — Ballpark Tracker`,
    description: `${venue.city}, ${venue.state}`,
  };
}

export default async function ParkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const venue = getVenueBySlug(slug);
  if (!venue) notFound();

  const userA = process.env.USER_A_NAME ?? "A";
  const userB = process.env.USER_B_NAME ?? "B";

  const franchises = getFranchises();
  const franchiseById = new Map(franchises.map((f) => [f.id, f]));
  const trips = getTrips();

  const progress = computeProgress({
    visits: getPublicVisits(),
    tenancies: getTenancies(),
    venues: getVenues(),
    franchises,
    currentYear: new Date().getFullYear(),
  });
  const vp = progress.byVenue.get(venue.id);
  if (!vp) notFound();
  const visits = getPublicVisitsForVenue(venue.id);

  return (
    <main className="pt-6">
      <Link href="/" className="label text-muted hover:text-accent">
        ← Map
      </Link>

      <header className="mt-5 flex items-start gap-3">
        <Fingerprint index={venue.fingerprint} state={vp.state} size={36} className="mt-1 shrink-0" />
        <div className="min-w-0">
          <h1 className="display text-[26px] sm:text-[32px]">{venue.name}</h1>
          <p className="tabular mt-1 text-[12px] text-muted">
            {venue.city}, {venue.state} · opened {venue.openedYear}
            {venue.closedYear ? ` · closed ${venue.closedYear}` : ""}
          </p>
        </div>
      </header>

      {vp.newParkFor && (
        <p className="mt-4 flex items-start gap-2 border-l-2 border-gold pl-3 text-[13px] text-muted">
          New park since your visit — the {vp.newParkFor.name} play here now.
        </p>
      )}

      {!vp.visited && (
        <section className="mt-6">
          <p className="label text-muted">Not yet</p>
          <p className="mt-2 text-[15px] text-ink-body">{notYetBlurbs[venue.id] ?? "Not yet."}</p>
        </section>
      )}

      {visits.map((visit) => {
        const home = visit.homeTeamId ? franchiseById.get(visit.homeTeamId) : null;
        const away = visit.awayTeamId ? franchiseById.get(visit.awayTeamId) : null;
        const trip = trips.find((t) => t.id === visit.tripId);
        const nameThatDay = getVenueNameOn(venue.id, visit.visitDate);

        return (
          <article key={visit.id} className="mt-8 border-t border-paper-line pt-6">
            <div className="flex items-baseline justify-between gap-3">
              <p className="tabular text-[13px] text-ink">{visit.visitDate}</p>
              {trip && <p className="label text-muted">{trip.title}</p>}
            </div>

            {nameThatDay !== venue.name && (
              <p className="mt-1 text-[12px] text-muted">Called {nameThatDay} when we went.</p>
            )}

            {!visit.attendedGame ? (
              <p className="mt-3 text-[15px] text-ink-body">
                Saw the building, didn&apos;t get in. Doesn&apos;t count toward either total.
              </p>
            ) : (
              /* Same white card treatment as the counters, deliberately -- this
                 was a dark holdout and is now unified. */
              <dl className="card mt-4 grid grid-cols-2 gap-x-4 gap-y-3 p-4 sm:grid-cols-4">
                {home && away && (
                  <Stat
                    k="Result"
                    v={`${away.abbrev} ${visit.awayScore} — ${visit.homeScore} ${home.abbrev}`}
                  />
                )}
                {visit.seatSection && (
                  <Stat
                    k="Seat"
                    v={`${visit.seatSection}${visit.seatRow && visit.seatRow !== "—" ? `, row ${visit.seatRow}` : ""}`}
                  />
                )}
                {visit.weatherTempF !== undefined && (
                  <Stat k="Weather" v={`${visit.weatherTempF}°F`} />
                )}
                {visit.weatherDesc && <Stat k="Sky" v={visit.weatherDesc} />}
              </dl>
            )}

            <PhotoGrid photos={getPublicPhotosForVisit(visit.id)} />

            {(visit.notesUserA || visit.notesUserB) && (
              <div className="mt-6 grid grid-cols-2 gap-5">
                <Voice name={userA} text={visit.notesUserA} />
                <Voice name={userB} text={visit.notesUserB} />
              </div>
            )}
          </article>
        );
      })}
    </main>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="label text-muted">{k}</dt>
      <dd className="tabular mt-1 text-[14px] text-ink">{v}</dd>
    </div>
  );
}

/**
 * Published photos for one visit. Renders nothing at all when there are none,
 * rather than leaving a row of empty tiles -- the layout has to survive a visit
 * whose photos are all still private.
 */
function PhotoGrid({ photos }: { photos: PhotoSummary[] }) {
  if (photos.length === 0) {
    return <p className="mt-4 text-[13px] text-muted">No photos published from this one yet.</p>;
  }
  return (
    <div className="mt-5 grid grid-cols-3 gap-1.5">
      {photos.map((p) => (
        <img
          key={p.id}
          src={`/api/photo/${p.id}/thumb`}
          alt={p.caption ?? ""}
          loading="lazy"
          className="aspect-square w-full bg-paper-inset object-cover"
        />
      ))}
    </div>
  );
}

function Voice({ name, text }: { name: string; text?: string }) {
  if (!text) return null;
  return (
    <div>
      <p className="label border-b border-paper-line pb-1 text-muted">{name}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-body">{text}</p>
    </div>
  );
}
