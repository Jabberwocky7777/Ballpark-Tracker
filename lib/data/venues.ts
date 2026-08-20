import type { Venue, VenueName } from "../types.ts";

/**
 * Public reference data. Coordinates are venue centres, hand-entered and
 * checked by `npm run check:coords`, which projects every one of them and
 * fails if a park lands outside its own state -- a transposed or sign-flipped
 * lat/lng is otherwise invisible until someone looks at the map.
 *
 * `fingerprint` indexes the placeholder silhouette set in
 * components/Fingerprint.tsx. Real traced outfield-wall outlines replace it
 * later -- that's the signature asset and deserves real illustration work.
 */
export const venues: Venue[] = [
  // --- AL East ---
  { id: "camden", slug: "camden-yards", name: "Oriole Park at Camden Yards", city: "Baltimore", state: "MD", lat: 39.2839, lng: -76.6217, timezone: "America/New_York", openedYear: 1992, closedYear: null, fingerprint: 0 },
  { id: "fenway", slug: "fenway-park", name: "Fenway Park", city: "Boston", state: "MA", lat: 42.3467, lng: -71.0972, timezone: "America/New_York", openedYear: 1912, closedYear: null, fingerprint: 1 },
  { id: "yankee", slug: "yankee-stadium", name: "Yankee Stadium", city: "Bronx", state: "NY", lat: 40.8296, lng: -73.9262, timezone: "America/New_York", openedYear: 2009, closedYear: null, fingerprint: 2 },
  { id: "tropicana", slug: "tropicana-field", name: "Tropicana Field", city: "St. Petersburg", state: "FL", lat: 27.7683, lng: -82.6534, timezone: "America/New_York", openedYear: 1990, closedYear: null, fingerprint: 3 },
  { id: "rogers", slug: "rogers-centre", name: "Rogers Centre", city: "Toronto", state: "ON", lat: 43.6414, lng: -79.3894, timezone: "America/Toronto", openedYear: 1989, closedYear: null, fingerprint: 4 },

  // --- AL Central ---
  { id: "rate", slug: "rate-field", name: "Rate Field", city: "Chicago", state: "IL", lat: 41.8299, lng: -87.6338, timezone: "America/Chicago", openedYear: 1991, closedYear: null, fingerprint: 5 },
  { id: "progressive", slug: "progressive-field", name: "Progressive Field", city: "Cleveland", state: "OH", lat: 41.4962, lng: -81.6852, timezone: "America/New_York", openedYear: 1994, closedYear: null, fingerprint: 6 },
  { id: "comerica", slug: "comerica-park", name: "Comerica Park", city: "Detroit", state: "MI", lat: 42.3390, lng: -83.0485, timezone: "America/Detroit", openedYear: 2000, closedYear: null, fingerprint: 7 },
  { id: "kauffman", slug: "kauffman-stadium", name: "Kauffman Stadium", city: "Kansas City", state: "MO", lat: 39.0517, lng: -94.4803, timezone: "America/Chicago", openedYear: 1973, closedYear: null, fingerprint: 0 },
  { id: "target", slug: "target-field", name: "Target Field", city: "Minneapolis", state: "MN", lat: 44.9817, lng: -93.2776, timezone: "America/Chicago", openedYear: 2010, closedYear: null, fingerprint: 1 },

  // --- AL West ---
  { id: "daikin", slug: "daikin-park", name: "Daikin Park", city: "Houston", state: "TX", lat: 29.7572, lng: -95.3555, timezone: "America/Chicago", openedYear: 2000, closedYear: null, fingerprint: 2 },
  { id: "angel", slug: "angel-stadium", name: "Angel Stadium", city: "Anaheim", state: "CA", lat: 33.8003, lng: -117.8827, timezone: "America/Los_Angeles", openedYear: 1966, closedYear: null, fingerprint: 3 },
  { id: "sutter", slug: "sutter-health-park", name: "Sutter Health Park", city: "West Sacramento", state: "CA", lat: 38.5800, lng: -121.5133, timezone: "America/Los_Angeles", openedYear: 2000, closedYear: null, fingerprint: 4 },
  { id: "tmobile", slug: "t-mobile-park", name: "T-Mobile Park", city: "Seattle", state: "WA", lat: 47.5914, lng: -122.3325, timezone: "America/Los_Angeles", openedYear: 1999, closedYear: null, fingerprint: 5 },
  { id: "globelife", slug: "globe-life-field", name: "Globe Life Field", city: "Arlington", state: "TX", lat: 32.7473, lng: -97.0847, timezone: "America/Chicago", openedYear: 2020, closedYear: null, fingerprint: 6 },

  // --- NL East ---
  { id: "truist", slug: "truist-park", name: "Truist Park", city: "Atlanta", state: "GA", lat: 33.8907, lng: -84.4677, timezone: "America/New_York", openedYear: 2017, closedYear: null, fingerprint: 7 },
  { id: "loandepot", slug: "loandepot-park", name: "loanDepot park", city: "Miami", state: "FL", lat: 25.7781, lng: -80.2197, timezone: "America/New_York", openedYear: 2012, closedYear: null, fingerprint: 0 },
  { id: "citi", slug: "citi-field", name: "Citi Field", city: "Queens", state: "NY", lat: 40.7571, lng: -73.8458, timezone: "America/New_York", openedYear: 2009, closedYear: null, fingerprint: 1 },
  { id: "cbp", slug: "citizens-bank-park", name: "Citizens Bank Park", city: "Philadelphia", state: "PA", lat: 39.9061, lng: -75.1665, timezone: "America/New_York", openedYear: 2004, closedYear: null, fingerprint: 2 },
  { id: "nationals", slug: "nationals-park", name: "Nationals Park", city: "Washington", state: "DC", lat: 38.8730, lng: -77.0074, timezone: "America/New_York", openedYear: 2008, closedYear: null, fingerprint: 3 },

  // --- NL Central ---
  { id: "wrigley", slug: "wrigley-field", name: "Wrigley Field", city: "Chicago", state: "IL", lat: 41.9484, lng: -87.6553, timezone: "America/Chicago", openedYear: 1914, closedYear: null, fingerprint: 4 },
  { id: "gabp", slug: "great-american-ball-park", name: "Great American Ball Park", city: "Cincinnati", state: "OH", lat: 39.0975, lng: -84.5069, timezone: "America/New_York", openedYear: 2003, closedYear: null, fingerprint: 5 },
  { id: "amfam", slug: "american-family-field", name: "American Family Field", city: "Milwaukee", state: "WI", lat: 43.0280, lng: -87.9712, timezone: "America/Chicago", openedYear: 2001, closedYear: null, fingerprint: 6 },
  { id: "pnc", slug: "pnc-park", name: "PNC Park", city: "Pittsburgh", state: "PA", lat: 40.4469, lng: -80.0057, timezone: "America/New_York", openedYear: 2001, closedYear: null, fingerprint: 7 },
  { id: "busch", slug: "busch-stadium", name: "Busch Stadium", city: "St. Louis", state: "MO", lat: 38.6226, lng: -90.1928, timezone: "America/Chicago", openedYear: 2006, closedYear: null, fingerprint: 0 },

  // --- NL West ---
  { id: "chase", slug: "chase-field", name: "Chase Field", city: "Phoenix", state: "AZ", lat: 33.4455, lng: -112.0667, timezone: "America/Phoenix", openedYear: 1998, closedYear: null, fingerprint: 1 },
  { id: "coors", slug: "coors-field", name: "Coors Field", city: "Denver", state: "CO", lat: 39.7559, lng: -104.9942, timezone: "America/Denver", openedYear: 1995, closedYear: null, fingerprint: 2 },
  { id: "dodger", slug: "dodger-stadium", name: "Dodger Stadium", city: "Los Angeles", state: "CA", lat: 34.0739, lng: -118.2400, timezone: "America/Los_Angeles", openedYear: 1962, closedYear: null, fingerprint: 3 },
  { id: "petco", slug: "petco-park", name: "Petco Park", city: "San Diego", state: "CA", lat: 32.7073, lng: -117.1566, timezone: "America/Los_Angeles", openedYear: 2004, closedYear: null, fingerprint: 4 },
  { id: "oracle", slug: "oracle-park", name: "Oracle Park", city: "San Francisco", state: "CA", lat: 37.7786, lng: -122.3893, timezone: "America/Los_Angeles", openedYear: 2000, closedYear: null, fingerprint: 5 },

  // --- Temporary and future venues ---
  { id: "steinbrenner", slug: "steinbrenner-field", name: "George M. Steinbrenner Field", city: "Tampa", state: "FL", lat: 27.9803, lng: -82.5069, timezone: "America/New_York", openedYear: 1996, closedYear: null, fingerprint: 6 },
  { id: "vegas", slug: "las-vegas-ballpark", name: "Athletics Las Vegas Ballpark", city: "Las Vegas", state: "NV", lat: 36.0955, lng: -115.1761, timezone: "America/Los_Angeles", openedYear: 2028, closedYear: null, fingerprint: 7 },

  // --- Former parks. They stay on the board once visited, which is how a
  // --- moved franchise keeps its check while its new park is asterisked.
  { id: "coliseum", slug: "oakland-coliseum", name: "Oakland Coliseum", city: "Oakland", state: "CA", lat: 37.7516, lng: -122.2005, timezone: "America/Los_Angeles", openedYear: 1966, closedYear: 2024, fingerprint: 1 },
];

/**
 * Renaming changes nothing about the checks -- it's the same building. This
 * table exists so a photo displays the name that was on the building that day.
 */
export const venueNames: VenueName[] = [
  { venueId: "rate", name: "Comiskey Park", validFrom: "1991-01-01", validTo: "2003-01-01" },
  { venueId: "rate", name: "U.S. Cellular Field", validFrom: "2003-01-01", validTo: "2016-01-01" },
  { venueId: "rate", name: "Guaranteed Rate Field", validFrom: "2016-01-01", validTo: "2024-11-01" },
  { venueId: "rate", name: "Rate Field", validFrom: "2024-11-01", validTo: null },
  { venueId: "daikin", name: "Enron Field", validFrom: "2000-01-01", validTo: "2002-02-01" },
  { venueId: "daikin", name: "Minute Maid Park", validFrom: "2002-06-01", validTo: "2025-01-01" },
  { venueId: "daikin", name: "Daikin Park", validFrom: "2025-01-01", validTo: null },
  { venueId: "oracle", name: "Pacific Bell Park", validFrom: "2000-01-01", validTo: "2004-01-01" },
  { venueId: "oracle", name: "SBC Park", validFrom: "2004-01-01", validTo: "2006-01-01" },
  { venueId: "oracle", name: "AT&T Park", validFrom: "2006-01-01", validTo: "2019-01-01" },
  { venueId: "oracle", name: "Oracle Park", validFrom: "2019-01-01", validTo: null },
  { venueId: "amfam", name: "Miller Park", validFrom: "2001-01-01", validTo: "2021-01-01" },
  { venueId: "amfam", name: "American Family Field", validFrom: "2021-01-01", validTo: null },
  { venueId: "progressive", name: "Jacobs Field", validFrom: "1994-01-01", validTo: "2008-01-01" },
  { venueId: "progressive", name: "Progressive Field", validFrom: "2008-01-01", validTo: null },
];
