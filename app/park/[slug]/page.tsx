import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Fingerprint } from "@/components/Fingerprint";
import { computeProgress } from "@/lib/progress";
import { venues, venueBySlug, venueNameOn } from "@/lib/data/venues";
import { franchises, tenancies, franchiseById } from "@/lib/data/franchises";
import { demoVisits, demoTrips } from "@/lib/data/demo-visits";
import { notYetBlurbs } from "@/lib/data/blurbs";

const CURRENT_YEAR = 2026;

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
  const venue = venueBySlug.get(slug);
  if (!venue) return {};
  return {
    title: `${venue.name} — Ballpark Tracker`,
    description: `${venue.city}, ${venue.state}`,
  };
}

export default async function ParkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const venue = venueBySlug.get(slug);
  if (!venue) notFound();

  const userA = process.env.USER_A_NAME ?? "A";
  const userB = process.env.USER_B_NAME ?? "B";

  const progress = computeProgress({
    visits: demoVisits,
    tenancies,
    venues,
    franchises,
    currentYear: CURRENT_YEAR,
  });
  const vp = progress.byVenue.get(venue.id)!;
  const visits = demoVisits
    .filter((v) => v.venueId === venue.id)
    .sort((a, b) => b.visitDate.localeCompare(a.visitDate));

  return (
    <main className="-mx-5 min-h-screen bg-paper px-5 pb-10 pt-6 text-paper-ink">
      <Link href="/" className="label text-paper-muted hover:text-paper-ink">
        ← Map
      </Link>

      <header className="mt-5 flex items-start gap-3">
        <Fingerprint index={venue.fingerprint} state={vp.state} size={34} surface="paper" className="mt-1 shrink-0" />
        <div className="min-w-0">
          <h1 className="display text-[30px] leading-[1.1]">{venue.name}</h1>
          <p className="tabular mt-1 text-[12px] text-paper-muted">
            {venue.city}, {venue.state} · opened {venue.openedYear}
            {venue.closedYear ? ` · closed ${venue.closedYear}` : ""}
          </p>
        </div>
      </header>

      {vp.newParkFor && (
        <p className="mt-4 border-l-2 border-paper-muted/40 pl-3 text-[13px] text-paper-muted">
          New park since your visit — the {vp.newParkFor.name} play here now.
        </p>
      )}

      {!vp.visited && (
        <section className="mt-6">
          <p className="label text-paper-muted">Not yet</p>
          <p className="mt-2 text-[15px] text-paper-ink-soft">
            {notYetBlurbs[venue.id] ?? "Not yet."}
          </p>
        </section>
      )}

      {visits.map((visit) => {
        const home = visit.homeTeamId ? franchiseById.get(visit.homeTeamId) : null;
        const away = visit.awayTeamId ? franchiseById.get(visit.awayTeamId) : null;
        const trip = demoTrips.find((t) => t.id === visit.tripId);
        const nameThatDay = venueNameOn(venue.id, visit.visitDate);

        return (
          <article key={visit.id} className="mt-8 border-t border-paper-ink/10 pt-6">
            <div className="flex items-baseline justify-between gap-3">
              <p className="tabular text-[13px]">{visit.visitDate}</p>
              {trip && (
                <p className="label text-paper-muted">{trip.title}</p>
              )}
            </div>

            {nameThatDay !== venue.name && (
              <p className="mt-1 text-[12px] italic text-paper-muted">
                Called {nameThatDay} when we went.
              </p>
            )}

            {!visit.attendedGame ? (
              <p className="mt-3 text-[15px] text-paper-ink-soft">
                Saw the building, didn&apos;t get in. Doesn&apos;t count toward either total.
              </p>
            ) : (
              <>
                {home && away && (
                  <p className="tabular mt-3 text-[17px]">
                    {away.abbrev} {visit.awayScore} — {visit.homeScore} {home.abbrev}
                  </p>
                )}
                <dl className="tabular mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                  {visit.seatSection && (
                    <Row k="Seat" v={`${visit.seatSection}${visit.seatRow && visit.seatRow !== "—" ? `, row ${visit.seatRow}` : ""}`} />
                  )}
                  {visit.weatherTempF !== undefined && (
                    <Row k="Weather" v={`${visit.weatherTempF}°F, ${visit.weatherDesc ?? ""}`} />
                  )}
                </dl>
              </>
            )}

            <PhotoGrid count={visit.attendedGame ? 6 : 2} />

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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="label text-paper-muted">{k}</dt>
      <dd className="mt-0.5">{v}</dd>
    </div>
  );
}

/**
 * Placeholder tiles until the ingest pipeline exists. Deliberately renders a
 * ragged count -- the layout has to survive private and missing photos without
 * leaving holes.
 */
function PhotoGrid({ count }: { count: number }) {
  return (
    <div className="mt-5 grid grid-cols-3 gap-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-square bg-paper-ink/8" />
      ))}
    </div>
  );
}

function Voice({ name, text }: { name: string; text?: string }) {
  if (!text) return null;
  return (
    <div>
      <p className="label border-b border-paper-ink/20 pb-1 text-paper-muted">{name}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-paper-ink-soft">{text}</p>
    </div>
  );
}
