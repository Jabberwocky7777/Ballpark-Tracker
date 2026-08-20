import Link from "next/link";
import { UsMap, type MapPin } from "@/components/UsMap";
import { Fingerprint } from "@/components/Fingerprint";
import { computeProgress } from "@/lib/progress";
import { getFranchises, getTenancies, getVenues, getVisits } from "@/lib/db/queries";
import { notYetBlurbs } from "@/lib/data/blurbs";
import { mapGeometry, projectVenue, separatePins, MAP_WIDTH, MAP_HEIGHT } from "@/lib/map";
import type { ParkState } from "@/lib/types";

/** Reads the database on every request; nothing here can be prerendered. */
export const dynamic = "force-dynamic";

export default function HomePage() {
  const venues = getVenues();
  const visits = getVisits();

  const progress = computeProgress({
    visits,
    tenancies: getTenancies(),
    venues,
    franchises: getFranchises(),
    currentYear: new Date().getFullYear(),
  });

  const geo = mapGeometry();

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

      <div className="mt-3 overflow-hidden border border-ink-line">
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
        <h2 className="label text-chalk-dim">Lately</h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-[14px] text-chalk-muted">
            Nothing yet. The first park goes here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-line border-y border-ink-line">
            {recent.map((v) => {
              const venue = venueById.get(v.venueId);
              if (!venue) return null;
              return (
                <li key={v.id}>
                  <Link href={`/park/${venue.slug}`} className="flex items-baseline gap-3 py-3">
                    <span className="display flex-1 text-[17px] text-chalk">{venue.name}</span>
                    <span className="tabular text-[12px] text-chalk-dim">{v.visitDate}</span>
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
    <div className="rounded-[4px] bg-ink-panel px-4 py-3">
      <p className="tabular leading-none">
        <span className="text-[30px] font-bold text-chalk">{value}</span>
        <span className="text-[20px] text-chalk-dim">/{total}</span>
      </p>
      <p className="label mt-2 text-chalk-muted">{label}</p>
      {note && <p className="mt-0.5 text-[11px] text-chalk-dim">{note}</p>}
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
          <Fingerprint index={l.fp} state={l.state} size={14} />
          <span className="label text-chalk-dim">{l.text}</span>
        </li>
      ))}
    </ul>
  );
}
