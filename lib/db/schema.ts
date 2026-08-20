import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Schema for docs/plan.md section 5.
 *
 * Two columns carry the whole check-off rule and are NOT NULL with no default,
 * deliberately: `tenancies.is_temporary` and `visits.attended_game`. A silent
 * default on either would quietly produce wrong counters everywhere, so the
 * database refuses to guess.
 *
 * Booleans are integers, 0 or 1, per SQLite. Dates are ISO-8601 text, which
 * sorts and compares correctly and stays readable in a manual export.
 */

export const franchises = sqliteTable("franchises", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  abbrev: text("abbrev").notNull(),
  league: text("league").notNull(),
  division: text("division").notNull(),
});

export const venues = sqliteTable(
  "venues",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    timezone: text("timezone").notNull(),
    openedYear: integer("opened_year").notNull(),
    closedYear: integer("closed_year"),
    capacity: integer("capacity"),
    fingerprint: integer("fingerprint").notNull().default(0),
  },
  (t) => [uniqueIndex("venues_slug_idx").on(t.slug)],
);

/** A rename changes nothing about the checks. This exists only so a photo can
 *  display the name that was on the building that day. */
export const venueNames = sqliteTable(
  "venue_names",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    venueId: text("venue_id")
      .notNull()
      .references(() => venues.id),
    name: text("name").notNull(),
    validFrom: text("valid_from").notNull(),
    validTo: text("valid_to"),
  },
  (t) => [index("venue_names_venue_idx").on(t.venueId)],
);

export const tenancies = sqliteTable(
  "tenancies",
  {
    id: text("id").primaryKey(),
    franchiseId: text("franchise_id")
      .notNull()
      .references(() => franchises.id),
    venueId: text("venue_id")
      .notNull()
      .references(() => venues.id),
    startYear: integer("start_year").notNull(),
    endYear: integer("end_year"),
    /** Load-bearing. No default: a temporary venue checks off the ballpark but
     *  never the team, and guessing this wrong corrupts every counter. */
    isTemporary: integer("is_temporary").notNull(),
    isCurrent: integer("is_current").notNull(),
  },
  (t) => [
    index("tenancies_franchise_idx").on(t.franchiseId),
    index("tenancies_venue_idx").on(t.venueId),
  ],
);

export const trips = sqliteTable("trips", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  notes: text("notes"),
});

export const visits = sqliteTable(
  "visits",
  {
    id: text("id").primaryKey(),
    venueId: text("venue_id")
      .notNull()
      .references(() => venues.id),
    tripId: text("trip_id").references(() => trips.id),
    visitDate: text("visit_date").notNull(),
    /** Load-bearing. No default: seeing the building is not attending a game. */
    attendedGame: integer("attended_game").notNull(),
    homeTeamId: text("home_team_id").references(() => franchises.id),
    awayTeamId: text("away_team_id").references(() => franchises.id),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    seatSection: text("seat_section"),
    seatRow: text("seat_row"),
    weatherTempF: integer("weather_temp_f"),
    weatherDesc: text("weather_desc"),
    notesUserA: text("notes_user_a"),
    notesUserB: text("notes_user_b"),
    /** Private until deliberately published. */
    isPublic: integer("is_public").notNull().default(0),
  },
  (t) => [index("visits_venue_idx").on(t.venueId), index("visits_date_idx").on(t.visitDate)],
);

export const photos = sqliteTable(
  "photos",
  {
    id: text("id").primaryKey(),
    /** Dedupe key. The same photo will be uploaded more than once. */
    sha256: text("sha256").notNull(),
    originalFilename: text("original_filename").notNull(),
    /** Opaque, app-generated. Never built from user input. */
    storedPath: text("stored_path").notNull(),
    takenUtc: text("taken_utc"),
    takenLocal: text("taken_local"),
    tzOffset: text("tz_offset"),
    lat: real("lat"),
    lng: real("lng"),
    gpsSource: text("gps_source"),
    matchConfidence: text("match_confidence"),
    /** Null means it's sitting in the manual assignment queue. */
    visitId: text("visit_id").references(() => visits.id),
    venueId: text("venue_id").references(() => venues.id),
    caption: text("caption"),
    role: text("role").notNull().default("general"),
    /** 0 at ingest for every uploader. Publishing is a deliberate act. */
    isPublic: integer("is_public").notNull().default(0),
    isHero: integer("is_hero").notNull().default(0),
    /** Set when the photo's GPS falls inside the home guard radius. */
    homeGuardFlag: integer("home_guard_flag").notNull().default(0),
    /** Set when a guest upload has not been reviewed yet. */
    needsReview: integer("needs_review").notNull().default(0),
    width: integer("width"),
    height: integer("height"),
    bytes: integer("bytes"),
    /** user_a | user_b | guest:<link_id>. Never a real name. */
    uploadedBy: text("uploaded_by").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    uniqueIndex("photos_sha256_idx").on(t.sha256),
    index("photos_visit_idx").on(t.visitId),
    index("photos_venue_idx").on(t.venueId),
    index("photos_queue_idx").on(t.visitId, t.needsReview),
  ],
);

export const photoVariants = sqliteTable(
  "photo_variants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    photoId: text("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    path: text("path").notNull(),
    format: text("format").notNull(),
    width: integer("width").notNull(),
  },
  (t) => [index("photo_variants_photo_idx").on(t.photoId)],
);

export const rankings = sqliteTable(
  "rankings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    venueId: text("venue_id")
      .notNull()
      .references(() => venues.id),
    /** user_a | user_b */
    ranker: text("ranker").notNull(),
    elo: real("elo").notNull().default(1500),
    comparisonsCount: integer("comparisons_count").notNull().default(0),
  },
  (t) => [uniqueIndex("rankings_venue_ranker_idx").on(t.venueId, t.ranker)],
);

export const comparisons = sqliteTable("comparisons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ranker: text("ranker").notNull(),
  venueA: text("venue_a")
    .notNull()
    .references(() => venues.id),
  venueB: text("venue_b")
    .notNull()
    .references(() => venues.id),
  winnerVenueId: text("winner_venue_id")
    .notNull()
    .references(() => venues.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const guestLinks = sqliteTable(
  "guest_links",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id),
    /** Hashed at rest. The raw token is shown once and never stored. */
    tokenHash: text("token_hash").notNull(),
    label: text("label"),
    expiresAt: text("expires_at").notNull(),
    maxUploads: integer("max_uploads").notNull(),
    maxBytes: integer("max_bytes").notNull(),
    uploadsUsed: integer("uploads_used").notNull().default(0),
    bytesUsed: integer("bytes_used").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    revokedAt: text("revoked_at"),
  },
  (t) => [uniqueIndex("guest_links_token_idx").on(t.tokenHash)],
);

/** Decode and derivative generation never run in an HTTP request. */
export const jobs = sqliteTable(
  "jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind").notNull(),
    payloadJson: text("payload_json").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("jobs_status_idx").on(t.status, t.createdAt)],
);
