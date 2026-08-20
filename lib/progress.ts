import type { Franchise, ParkState, Tenancy, Venue, Visit } from "./types.ts";

/**
 * The check-off rule, in one pure function. docs/plan.md section 4.8.
 *
 * A team is checked off when a game has been attended at that franchise's
 * permanent home ballpark -- the park that was its permanent home on the date
 * of the visit. Once true it stays true: a franchise that moves afterwards
 * keeps its check, and the new park picks up a quiet asterisk instead.
 *
 * A temporary venue checks off the ballpark but never the team.
 * Seeing the building without attending a game checks off neither.
 * A rename changes nothing -- it's the same building.
 *
 * No DB access, no framework imports, no dates read from the environment.
 * Everything it needs is an argument, so it's trivially testable.
 */

export interface ProgressInput {
  visits: Visit[];
  tenancies: Tenancy[];
  venues: Venue[];
  franchises: Franchise[];
  /** Used only to decide which venues are "in play" for the denominator. */
  currentYear: number;
}

export interface VenueProgress {
  venue: Venue;
  state: ParkState;
  /** True when a game was attended here. */
  visited: boolean;
  /**
   * Set when this park is the current permanent home of a franchise that is
   * already checked off from an earlier park. The quiet asterisk.
   */
  newParkFor: Franchise | null;
  /** Franchises whose current tenancy is at this venue. */
  currentFranchises: Franchise[];
  isTemporaryHome: boolean;
}

export interface Progress {
  teamsChecked: number;
  teamsTotal: number;
  ballparksChecked: number;
  ballparksTotal: number;
  asteriskCount: number;
  checkedFranchiseIds: Set<string>;
  byVenue: Map<string, VenueProgress>;
  /** Only venues that count toward the denominator, in a stable order. */
  countedVenues: VenueProgress[];
}

const year = (isoDate: string): number => Number(isoDate.slice(0, 4));

function tenancyCovers(t: Tenancy, y: number): boolean {
  if (y < t.startYear) return false;
  return t.endYear === null || y <= t.endYear;
}

export function computeProgress(input: ProgressInput): Progress {
  const { visits, tenancies, venues, franchises, currentYear } = input;

  // A visit only ever counts for anything if a game was actually attended.
  const attended = visits.filter((v) => v.attendedGame);
  const attendedVenueIds = new Set(attended.map((v) => v.venueId));

  // --- teams ---------------------------------------------------------------
  // Checked off if some attended visit landed on a park that was this
  // franchise's *permanent* home in the year of that visit.
  const checkedFranchiseIds = new Set<string>();
  for (const visit of attended) {
    const y = year(visit.visitDate);
    for (const t of tenancies) {
      if (t.venueId !== visit.venueId) continue;
      if (t.isTemporary) continue;
      if (!tenancyCovers(t, y)) continue;
      checkedFranchiseIds.add(t.franchiseId);
    }
  }

  // --- venues --------------------------------------------------------------
  const franchiseById = new Map(franchises.map((f) => [f.id, f]));
  const byVenue = new Map<string, VenueProgress>();

  for (const venue of venues) {
    const venueTenancies = tenancies.filter((t) => t.venueId === venue.id);
    const currentTenancies = venueTenancies.filter((t) => t.isCurrent);
    const currentFranchises = currentTenancies
      .map((t) => franchiseById.get(t.franchiseId))
      .filter((f): f is Franchise => Boolean(f));

    const visited = attendedVenueIds.has(venue.id);
    const isTemporaryHome = currentTenancies.some((t) => t.isTemporary);

    // The asterisk: this is a franchise's permanent home going forward, that
    // franchise is already checked off from an earlier park, and this park
    // hasn't been seen. Reads as "here's something new", never as a nag.
    let newParkFor: Franchise | null = null;
    if (!visited) {
      for (const t of venueTenancies) {
        if (t.isTemporary) continue;
        // Still running, or starting later. `endYear === null` alone was too
        // loose: it would asterisk a park a franchise has already left if the
        // row was ever written without an end year.
        const isCurrentOrFuture = t.endYear === null || t.endYear >= currentYear;
        if (!isCurrentOrFuture) continue;
        if (!checkedFranchiseIds.has(t.franchiseId)) continue;
        newParkFor = franchiseById.get(t.franchiseId) ?? null;
        if (newParkFor) break;
      }
    }

    let state: ParkState;
    if (visited) state = "done";
    else if (newParkFor) state = "done-asterisk";
    else if (isTemporaryHome) state = "temporary";
    else state = "not-done";

    byVenue.set(venue.id, { venue, state, visited, newParkFor, currentFranchises, isTemporaryHome });
  }

  // --- denominator ---------------------------------------------------------
  // A venue counts if it's someone's home now, is a known future home, or has
  // actually been visited. That last clause is what keeps a park you've been
  // to on the board after the team leaves it.
  const counted: VenueProgress[] = [];
  for (const venue of venues) {
    const vp = byVenue.get(venue.id)!;
    const ts = tenancies.filter((t) => t.venueId === venue.id);
    const inPlay =
      ts.some((t) => t.isCurrent || t.startYear > currentYear) || attendedVenueIds.has(venue.id);
    if (inPlay) counted.push(vp);
  }

  return {
    teamsChecked: checkedFranchiseIds.size,
    teamsTotal: franchises.length,
    ballparksChecked: counted.filter((v) => v.visited).length,
    ballparksTotal: counted.length,
    asteriskCount: counted.filter((v) => v.state === "done-asterisk").length,
    checkedFranchiseIds,
    byVenue,
    countedVenues: counted,
  };
}
