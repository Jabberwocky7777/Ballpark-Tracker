import Link from "next/link";
import type { Metadata } from "next";
import { computeProgress } from "@/lib/progress";
import { venues } from "@/lib/data/venues";
import { franchises, tenancies } from "@/lib/data/franchises";
import { demoVisits } from "@/lib/data/demo-visits";

export const metadata: Metadata = {
  title: "The shot — Ballpark Tracker",
  description: "The same photo at every park.",
};

const CURRENT_YEAR = 2026;

/**
 * The repeated shot: one standard framing at every park, rendered as a grid.
 * The emotional centre of the site, so it gets its own page and a light
 * surface -- this is the browsing mode, not the data mode.
 */
export default function RepeatedShotPage() {
  const progress = computeProgress({
    visits: demoVisits,
    tenancies,
    venues,
    franchises,
    currentYear: CURRENT_YEAR,
  });

  const done = progress.countedVenues
    .filter((vp) => vp.visited)
    .map((vp) => {
      const visit = demoVisits
        .filter((v) => v.venueId === vp.venue.id && v.attendedGame)
        .sort((a, b) => a.visitDate.localeCompare(b.visitDate))[0];
      return { vp, visit };
    })
    .sort((a, b) => (a.visit?.visitDate ?? "").localeCompare(b.visit?.visitDate ?? ""));

  return (
    <main className="-mx-5 min-h-screen bg-paper px-5 pb-10 pt-6 text-paper-ink">
      <Link href="/" className="label text-paper-muted hover:text-paper-ink">
        ← Map
      </Link>

      <h1 className="display mt-5 text-[30px] leading-tight">The shot</h1>
      <p className="mt-2 max-w-[38ch] text-[14px] text-paper-ink-soft">
        The same photo at every park: both of us, field behind, same framing. In the order we took
        them.
      </p>

      <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-6">
        {done.map(({ vp, visit }) => (
          <figure key={vp.venue.id}>
            <Link href={`/park/${vp.venue.slug}`} className="block">
              <div className="aspect-[4/5] bg-paper-ink/8" />
            </Link>
            <figcaption className="mt-2">
              <p className="display text-[15px] leading-tight">{vp.venue.name}</p>
              <p className="tabular mt-0.5 text-[11px] text-paper-muted">{visit?.visitDate}</p>
            </figcaption>
          </figure>
        ))}
      </div>

      <p className="mt-8 text-[13px] text-paper-muted">
        {progress.ballparksTotal - progress.ballparksChecked} still to go.
      </p>
    </main>
  );
}
