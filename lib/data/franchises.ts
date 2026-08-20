import type { Franchise, Tenancy } from "../types.ts";

export const franchises: Franchise[] = [
  { id: "bal", name: "Orioles", abbrev: "BAL", league: "AL", division: "East" },
  { id: "bos", name: "Red Sox", abbrev: "BOS", league: "AL", division: "East" },
  { id: "nyy", name: "Yankees", abbrev: "NYY", league: "AL", division: "East" },
  { id: "tbr", name: "Rays", abbrev: "TB", league: "AL", division: "East" },
  { id: "tor", name: "Blue Jays", abbrev: "TOR", league: "AL", division: "East" },
  { id: "cws", name: "White Sox", abbrev: "CWS", league: "AL", division: "Central" },
  { id: "cle", name: "Guardians", abbrev: "CLE", league: "AL", division: "Central" },
  { id: "det", name: "Tigers", abbrev: "DET", league: "AL", division: "Central" },
  { id: "kcr", name: "Royals", abbrev: "KC", league: "AL", division: "Central" },
  { id: "min", name: "Twins", abbrev: "MIN", league: "AL", division: "Central" },
  { id: "hou", name: "Astros", abbrev: "HOU", league: "AL", division: "West" },
  { id: "laa", name: "Angels", abbrev: "LAA", league: "AL", division: "West" },
  // No city name during the Sacramento years -- the club is just "Athletics".
  { id: "ath", name: "Athletics", abbrev: "ATH", league: "AL", division: "West" },
  { id: "sea", name: "Mariners", abbrev: "SEA", league: "AL", division: "West" },
  { id: "tex", name: "Rangers", abbrev: "TEX", league: "AL", division: "West" },
  { id: "atl", name: "Braves", abbrev: "ATL", league: "NL", division: "East" },
  { id: "mia", name: "Marlins", abbrev: "MIA", league: "NL", division: "East" },
  { id: "nym", name: "Mets", abbrev: "NYM", league: "NL", division: "East" },
  { id: "phi", name: "Phillies", abbrev: "PHI", league: "NL", division: "East" },
  { id: "wsn", name: "Nationals", abbrev: "WSH", league: "NL", division: "East" },
  { id: "chc", name: "Cubs", abbrev: "CHC", league: "NL", division: "Central" },
  { id: "cin", name: "Reds", abbrev: "CIN", league: "NL", division: "Central" },
  { id: "mil", name: "Brewers", abbrev: "MIL", league: "NL", division: "Central" },
  { id: "pit", name: "Pirates", abbrev: "PIT", league: "NL", division: "Central" },
  { id: "stl", name: "Cardinals", abbrev: "STL", league: "NL", division: "Central" },
  { id: "ari", name: "Diamondbacks", abbrev: "AZ", league: "NL", division: "West" },
  { id: "col", name: "Rockies", abbrev: "COL", league: "NL", division: "West" },
  { id: "lad", name: "Dodgers", abbrev: "LAD", league: "NL", division: "West" },
  { id: "sdp", name: "Padres", abbrev: "SD", league: "NL", division: "West" },
  { id: "sfg", name: "Giants", abbrev: "SF", league: "NL", division: "West" },
];

/**
 * Franchise-to-venue with dates. Modelling these separately is what keeps the
 * schema stable across moves, temporary venues, and renames.
 *
 * `isTemporary` is the boolean the whole check-off rule turns on.
 */
export const tenancies: Tenancy[] = [
  { id: "t-bal", franchiseId: "bal", venueId: "camden", startYear: 1992, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-bos", franchiseId: "bos", venueId: "fenway", startYear: 1912, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-nyy", franchiseId: "nyy", venueId: "yankee", startYear: 2009, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-tor", franchiseId: "tor", venueId: "rogers", startYear: 1989, endYear: null, isTemporary: false, isCurrent: true },

  // Rays: displaced to Steinbrenner Field for 2025 after Tropicana Field was
  // damaged, back at the Trop from 2026. The 2025 row is temporary.
  { id: "t-tbr-trop-1", franchiseId: "tbr", venueId: "tropicana", startYear: 1998, endYear: 2024, isTemporary: false, isCurrent: false },
  { id: "t-tbr-steinbrenner", franchiseId: "tbr", venueId: "steinbrenner", startYear: 2025, endYear: 2025, isTemporary: true, isCurrent: false },
  { id: "t-tbr-trop-2", franchiseId: "tbr", venueId: "tropicana", startYear: 2026, endYear: null, isTemporary: false, isCurrent: true },

  { id: "t-cws", franchiseId: "cws", venueId: "rate", startYear: 1991, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-cle", franchiseId: "cle", venueId: "progressive", startYear: 1994, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-det", franchiseId: "det", venueId: "comerica", startYear: 2000, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-kcr", franchiseId: "kcr", venueId: "kauffman", startYear: 1973, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-min", franchiseId: "min", venueId: "target", startYear: 2010, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-hou", franchiseId: "hou", venueId: "daikin", startYear: 2000, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-laa", franchiseId: "laa", venueId: "angel", startYear: 1966, endYear: null, isTemporary: false, isCurrent: true },

  // Athletics: Sacramento is explicitly temporary through 2027, Las Vegas is
  // the intended permanent home from 2028.
  { id: "t-ath-coliseum", franchiseId: "ath", venueId: "coliseum", startYear: 1968, endYear: 2024, isTemporary: false, isCurrent: false },
  { id: "t-ath-sutter", franchiseId: "ath", venueId: "sutter", startYear: 2025, endYear: 2027, isTemporary: true, isCurrent: true },
  { id: "t-ath-vegas", franchiseId: "ath", venueId: "vegas", startYear: 2028, endYear: null, isTemporary: false, isCurrent: false },

  { id: "t-sea", franchiseId: "sea", venueId: "tmobile", startYear: 1999, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-tex", franchiseId: "tex", venueId: "globelife", startYear: 2020, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-atl", franchiseId: "atl", venueId: "truist", startYear: 2017, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-mia", franchiseId: "mia", venueId: "loandepot", startYear: 2012, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-nym", franchiseId: "nym", venueId: "citi", startYear: 2009, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-phi", franchiseId: "phi", venueId: "cbp", startYear: 2004, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-wsn", franchiseId: "wsn", venueId: "nationals", startYear: 2008, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-chc", franchiseId: "chc", venueId: "wrigley", startYear: 1916, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-cin", franchiseId: "cin", venueId: "gabp", startYear: 2003, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-mil", franchiseId: "mil", venueId: "amfam", startYear: 2001, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-pit", franchiseId: "pit", venueId: "pnc", startYear: 2001, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-stl", franchiseId: "stl", venueId: "busch", startYear: 2006, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-ari", franchiseId: "ari", venueId: "chase", startYear: 1998, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-col", franchiseId: "col", venueId: "coors", startYear: 1995, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-lad", franchiseId: "lad", venueId: "dodger", startYear: 1962, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-sdp", franchiseId: "sdp", venueId: "petco", startYear: 2004, endYear: null, isTemporary: false, isCurrent: true },
  { id: "t-sfg", franchiseId: "sfg", venueId: "oracle", startYear: 2000, endYear: null, isTemporary: false, isCurrent: true },
];
