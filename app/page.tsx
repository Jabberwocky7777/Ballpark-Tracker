import Link from "next/link";
import { UsMap, type MapPin } from "@/components/UsMap";
import { Fingerprint } from "@/components/Fingerprint";
import { computeProgress } from "@/lib/progress";
import {
  getFranchises,
  getPublicHeroPhotoByVenue,
  getPublicVisits,
  getTenancies,
  getVenues,
} from "@/lib/db/queries";
import { notYetBlurbs } from "@/lib/data/blurbs";
import { referencePhotos } from "@/lib/data/park-reference-photos";
import { mapGeometry, projectVenue, separatePins, MAP_WIDTH, MAP_HEIGHT } from "@/lib/map";
import type { ParkState } from "@/lib/types";

/** Reads the database on every request; nothing here can be prerendered. */
export const dynamic = "force-dynamic";

export default function HomePage() {
  const venues = getVenues();
  // Published visits only. An unpublished visit is not on the public site,
  // and that includes the counters -- publishing is what puts it there.
  const visits = getPublicVisits();

  const progress = computeProgress({
    visits,
    tenancies: getTenancies(),
    venues,
    franchises: getFranchises(),
    currentYear: new Date().getFullYear(),
  });

  const geo = mapGeometry();
  const heroByVenue = getPublicHeroPhotoByVenue();

  // Project first, then push apart anything that would render underneath a
  // neighbour -- several parks are within a pin's width of each other.
  const projected = progress.countedVenues
    .map((vp) => projectVenue(vp.venue))
    .filter((p): p is NonNullable<typeof p> => p !== null);
  const separated = new Map(separatePins(projected).map((p) => [p.id, p]));

  const pins: MapPin[] = progress.countedVenues
    .map((vp) => {
      const p = separated.get(vp.venue.id);
      if (!p) return null;
      return {
        id: vp.venue.id,
        slug: vp.venue.slug,
        name: vp.venue.name,
        city: vp.venue.city,
        state: vp.venue.state,
        x: p.x,
        y: p.y,
        anchorX: p.anchorX,
        anchorY: p.anchorY,
        nudged: p.nudged,
        parkState: vp.state,
        fingerprint: vp.venue.fingerprint,
        blurb: notYetBlurbs[vp.venue.id] ?? "Not yet.",
        newParkFor: vp.newParkFor?.name ?? null,
        heroPhotoId: heroByVenue.get(vp.venue.id) ?? null,
        reference: referencePhotos[vp.venue.id]
          ? {
              file: referencePhotos[vp.venue.id].file,
              author: referencePhotos[vp.venue.id].author,
              licence: referencePhotos[vp.venue.id].licence,
            }
          : null,
      } satisfies MapPin;
    })
    .filter((p): p is MapPin => p !== null);

  const venueById = new Map(venues.map((v) => [v.id, v]));
  const recent = visits.filter((v) => v.attendedGame).slice(0, 3);

  return (
    <main>
      <div className="grid grid-cols-2 gap-2">
        <Counter value={progress.teamsChecked} total={progress.teamsTotal} label="Teams" />
        <Counter
          value={progress.ballparksChecked}
          total={progress.ballparksTotal}
          label="Ballparks"
          note={progress.asteriskCount > 0 ? `${progress.asteriskCount} asterisked` : undefined}
        />
      </div>

      <div className="mt-3 overflow-hidden rounded-[3px] border border-paper-line">
        <UsMap
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
          statePaths={geo.statePaths}
          neighbourPaths={geo.neighbourPaths}
          pins={pins}
        />
      </div>

      <Legend />

      <section className="mt-9">
        <h2 className="label text-muted">Lately</h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-[14px] text-muted">
            Nothing yet. The first park goes here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-paper-line border-y border-paper-line">
            {recent.map((v) => {
              const venue = venueById.get(v.venueId);
              if (!venue) return null;
              return (
                <li key={v.id}>
                  <Link href={`/park/${venue.slug}`} className="flex items-baseline gap-3 py-3">
                    <span className="display flex-1 text-[15px]">{venue.name}</span>
                    <span className="tabular text-[12px] text-muted">{v.visitDate}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function Counter({
  value,
  total,
  label,
  note,
}: {
  value: number;
  total: number;
  label: string;
  note?: string;
}) {
  return (
    <div className="card px-4 py-4 sm:px-5 sm:py-5">
      <p className="tabular leading-none">
        <span className="text-[34px] font-bold text-ink sm:text-[44px]">{value}</span>
        <span className="text-[22px] text-muted sm:text-[28px]">/{total}</span>
      </p>
      <p className="label mt-2 text-ink">{label}</p>
      {note && (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
          <span className="inline-block h-2 w-2 rounded-full bg-gold" aria-hidden="true" />
          {note}
        </p>
      )}
    </div>
  );
}

const LEGEND: { state: ParkState; text: string; fp: number }[] = [
  { state: "done", text: "Been", fp: 4 },
  { state: "done-asterisk", text: "New park", fp: 6 },
  { state: "not-done", text: "Not yet", fp: 0 },
  { state: "temporary", text: "Temporary", fp: 3 },
];

function Legend() {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
      {LEGEND.map((l) => (
        <li key={l.state} className="flex items-center gap-1.5">
          <Fingerprint index={l.fp} state={l.state} size={16} />
          <span className="label text-muted">{l.text}</span>
        </li>
      ))}
    </ul>
  );
}
