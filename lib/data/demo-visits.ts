import type { Trip, Visit } from "../types";

/**
 * DEMO DATA ONLY. Invented, for developing the UI before the ingest pipeline
 * exists. Delete this file once real visits come from the database -- nothing
 * outside app/ should import it.
 *
 * Chosen to exercise every state the map has to render:
 *   - ordinary permanent-park visits (most of these)
 *   - a temporary venue: Sutter Health Park, ballpark counts, Athletics don't
 *   - a building seen with no game attended: Dodger Stadium
 *
 * It no longer demonstrates the quiet asterisk. That needed a visit to a park a
 * franchise has since left, and the parks that closed before 2020 are out of
 * the seed now. The rule itself is unchanged and still covered by tests.
 */

export const demoTrips: Trip[] = [
  { id: "trip-midwest", title: "The Midwest swing", startDate: "2023-06-16", endDate: "2023-06-21", notes: "Three parks, five days, one very long drive through Indiana." },
  { id: "trip-northeast", title: "Northeast in the rain", startDate: "2024-05-03", endDate: "2024-05-07" },
  { id: "trip-california", title: "California, top to bottom", startDate: "2025-06-12", endDate: "2025-06-18" },
];

export const demoVisits: Visit[] = [
  {
    id: "v-wrigley", venueId: "wrigley", tripId: "trip-midwest", visitDate: "2023-06-16",
    attendedGame: true, homeTeamId: "chc", awayTeamId: "stl", homeScore: 4, awayScore: 3,
    seatSection: "208", seatRow: "F", weatherTempF: 78, weatherDesc: "Clear, wind out to left",
    notesUserA: "The ivy is the whole thing. Got there two hours early just to sit and look at it. Cubs walked it off in the ninth and the entire section hugged.",
    notesUserB: "Loudest place I have ever been. I lost my voice by the seventh inning and I have no regrets about it.",
    isPublic: true,
  },
  {
    id: "v-amfam", venueId: "amfam", tripId: "trip-midwest", visitDate: "2023-06-18",
    attendedGame: true, homeTeamId: "mil", awayTeamId: "pit", homeScore: 2, awayScore: 7,
    seatSection: "422", seatRow: "12", weatherTempF: 71, weatherDesc: "Roof closed",
    notesUserA: "The roof closing mid-game is a genuinely great piece of theatre. Bad baseball, good sausage race.",
    notesUserB: "Bernie's slide is worth the ticket on its own.",
    isPublic: true,
  },
  {
    id: "v-pnc", venueId: "pnc", tripId: "trip-midwest", visitDate: "2023-06-20",
    attendedGame: true, homeTeamId: "pit", awayTeamId: "cin", homeScore: 5, awayScore: 1,
    seatSection: "board", seatRow: "8", weatherTempF: 82, weatherDesc: "Humid, clear",
    notesUserA: "Best view in baseball and it is not close. The bridge, the river, the skyline right over the wall.",
    notesUserB: "We walked over the Clemente Bridge with everyone else and it felt like a parade.",
    isPublic: true,
  },
  {
    id: "v-fenway", venueId: "fenway", tripId: "trip-northeast", visitDate: "2024-05-04",
    attendedGame: true, homeTeamId: "bos", awayTeamId: "nyy", homeScore: 6, awayScore: 5,
    seatSection: "Grandstand 24", seatRow: "3", weatherTempF: 54, weatherDesc: "Cold drizzle",
    notesUserA: "Obstructed view, freezing, and I would do it again tomorrow. The Monster is taller in person than it has any right to be.",
    notesUserB: "The seats are made for people who lived in 1912. Worth it.",
    isPublic: true,
  },
  {
    id: "v-citi", venueId: "citi", tripId: "trip-northeast", visitDate: "2024-05-06",
    attendedGame: true, homeTeamId: "nym", awayTeamId: "atl", homeScore: 1, awayScore: 3,
    seatSection: "138", seatRow: "20", weatherTempF: 61, weatherDesc: "Overcast",
    notesUserA: "The Shea Bridge and the apple are the only parts that feel like the Mets. Rest of it is very nice and very anonymous.",
    notesUserB: "Best food of any park so far, and it is not particularly close.",
    isPublic: true,
  },
  {
    id: "v-camden", venueId: "camden", tripId: null, visitDate: "2024-08-11",
    attendedGame: true, homeTeamId: "bal", awayTeamId: "tor", homeScore: 8, awayScore: 2,
    seatSection: "14", seatRow: "H", weatherTempF: 91, weatherDesc: "Hot, still",
    notesUserA: "Every park built since 1992 is trying to be this one. The warehouse does all the work.",
    notesUserB: "Eutaw Street before the game is the best pre-game anywhere.",
    isPublic: true,
  },
  {
    id: "v-oracle", venueId: "oracle", tripId: "trip-california", visitDate: "2025-06-13",
    attendedGame: true, homeTeamId: "sfg", awayTeamId: "sdp", homeScore: 2, awayScore: 0,
    seatSection: "128", seatRow: "22", weatherTempF: 58, weatherDesc: "Fog, wind off the bay",
    notesUserA: "Bring a coat in June. Nobody tells you this and everybody knows it.",
    notesUserB: "Watching the kayaks wait for a splash hit is its own sport.",
    isPublic: true,
  },
  {
    id: "v-sutter", venueId: "sutter", tripId: "trip-california", visitDate: "2025-06-15",
    attendedGame: true, homeTeamId: "ath", awayTeamId: "sea", homeScore: 3, awayScore: 4,
    seatSection: "Lawn", seatRow: "—", weatherTempF: 96, weatherDesc: "Dry heat",
    notesUserA: "A major league game at a minor league park. Strange and a bit sad, and we are glad we went. Does not count for the Athletics, and it should not.",
    notesUserB: "Closest we have ever sat to a big league field, though.",
    isPublic: true,
  },
  {
    id: "v-petco", venueId: "petco", tripId: "trip-california", visitDate: "2025-06-17",
    attendedGame: true, homeTeamId: "sdp", awayTeamId: "lad", homeScore: 7, awayScore: 6,
    seatSection: "Park at the Park", seatRow: "—", weatherTempF: 74, weatherDesc: "Perfect",
    notesUserA: "The Western Metal building in the corner is the best single idea in any modern park.",
    notesUserB: "Sat on the grass in the outfield for eleven dollars. Eleven.",
    isPublic: true,
  },
  {
    // Seeing the building is not attending a game. Recorded, flagged, counts
    // toward nothing -- this is the row that proves the rule.
    id: "v-dodger", venueId: "dodger", tripId: "trip-california", visitDate: "2025-06-18",
    attendedGame: false,
    notesUserA: "Drove up to the gates on a road trip day. No game, no tickets, no entry. Does not count and we knew that going in.",
    isPublic: true,
  },
  {
    id: "v-nationals", venueId: "nationals", tripId: null, visitDate: "2022-04-16",
    attendedGame: true, homeTeamId: "wsn", awayTeamId: "ari", homeScore: 4, awayScore: 6,
    seatSection: "113", seatRow: "9", weatherTempF: 66, weatherDesc: "Breezy",
    notesUserA: "The racing presidents are the correct amount of stupid.",
    isPublic: true,
  },
  {
    id: "v-progressive", venueId: "progressive", tripId: null, visitDate: "2023-08-05",
    attendedGame: true, homeTeamId: "cle", awayTeamId: "det", homeScore: 9, awayScore: 4,
    seatSection: "155", seatRow: "C", weatherTempF: 76, weatherDesc: "Clear",
    notesUserB: "The drum guy never stops. Not once. Respect.",
    isPublic: true,
  },
  {
    id: "v-busch", venueId: "busch", tripId: null, visitDate: "2021-09-11",
    attendedGame: true, homeTeamId: "stl", awayTeamId: "cin", homeScore: 3, awayScore: 1,
    seatSection: "164", seatRow: "11", weatherTempF: 84, weatherDesc: "Clear",
    notesUserA: "The Arch framed over the outfield is a cheap trick and it works every time.",
    isPublic: true,
  },
];
