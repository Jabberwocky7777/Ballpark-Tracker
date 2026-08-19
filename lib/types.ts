/** Shared domain types. Mirrors the schema in docs/plan.md section 5. */

export type League = "AL" | "NL";
export type Division = "East" | "Central" | "West";

export interface Franchise {
  id: string;
  name: string;
  abbrev: string;
  league: League;
  division: Division;
}

export interface Venue {
  id: string;
  slug: string;
  /** Current name. Historical names live in venueNames. */
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  /** IANA zone. Fallback when a photo has no usable offset. */
  timezone: string;
  openedYear: number;
  closedYear: number | null;
  /** Index into the fingerprint silhouette set. Placeholder until real outlines are traced. */
  fingerprint: number;
}

export interface VenueName {
  venueId: string;
  name: string;
  validFrom: string;
  validTo: string | null;
}

export interface Tenancy {
  id: string;
  franchiseId: string;
  venueId: string;
  startYear: number;
  endYear: number | null;
  /**
   * Load-bearing. A game at a temporary venue checks off the ballpark but
   * never the team. See docs/plan.md section 4.8.
   */
  isTemporary: boolean;
  isCurrent: boolean;
}

export interface Visit {
  id: string;
  venueId: string;
  tripId: string | null;
  visitDate: string;
  /** Load-bearing. Seeing the building does not check off the team. */
  attendedGame: boolean;
  homeTeamId?: string;
  awayTeamId?: string;
  homeScore?: number;
  awayScore?: number;
  seatSection?: string;
  seatRow?: string;
  weatherTempF?: number;
  weatherDesc?: string;
  notesUserA?: string;
  notesUserB?: string;
  isPublic: boolean;
}

export interface Trip {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  notes?: string;
}

/** The four states a park can be in on the map. Shape-coded, never colour-only. */
export type ParkState = "done" | "done-asterisk" | "not-done" | "temporary";
