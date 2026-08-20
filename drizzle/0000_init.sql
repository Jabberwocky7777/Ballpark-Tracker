CREATE TABLE `comparisons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ranker` text NOT NULL,
	`venue_a` text NOT NULL,
	`venue_b` text NOT NULL,
	`winner_venue_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`venue_a`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`venue_b`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winner_venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `franchises` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`abbrev` text NOT NULL,
	`league` text NOT NULL,
	`division` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `guest_links` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`label` text,
	`expires_at` text NOT NULL,
	`max_uploads` integer NOT NULL,
	`max_bytes` integer NOT NULL,
	`uploads_used` integer DEFAULT 0 NOT NULL,
	`bytes_used` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guest_links_token_idx` ON `guest_links` (`token_hash`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `photo_variants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`photo_id` text NOT NULL,
	`kind` text NOT NULL,
	`path` text NOT NULL,
	`format` text NOT NULL,
	`width` integer NOT NULL,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `photo_variants_photo_idx` ON `photo_variants` (`photo_id`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`sha256` text NOT NULL,
	`original_filename` text NOT NULL,
	`stored_path` text NOT NULL,
	`taken_utc` text,
	`taken_local` text,
	`tz_offset` text,
	`lat` real,
	`lng` real,
	`gps_source` text,
	`match_confidence` text,
	`visit_id` text,
	`venue_id` text,
	`caption` text,
	`role` text DEFAULT 'general' NOT NULL,
	`is_public` integer DEFAULT 0 NOT NULL,
	`is_hero` integer DEFAULT 0 NOT NULL,
	`home_guard_flag` integer DEFAULT 0 NOT NULL,
	`needs_review` integer DEFAULT 0 NOT NULL,
	`width` integer,
	`height` integer,
	`bytes` integer,
	`uploaded_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`visit_id`) REFERENCES `visits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_sha256_idx` ON `photos` (`sha256`);--> statement-breakpoint
CREATE INDEX `photos_visit_idx` ON `photos` (`visit_id`);--> statement-breakpoint
CREATE INDEX `photos_venue_idx` ON `photos` (`venue_id`);--> statement-breakpoint
CREATE INDEX `photos_queue_idx` ON `photos` (`visit_id`,`needs_review`);--> statement-breakpoint
CREATE TABLE `rankings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`venue_id` text NOT NULL,
	`ranker` text NOT NULL,
	`elo` real DEFAULT 1500 NOT NULL,
	`comparisons_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rankings_venue_ranker_idx` ON `rankings` (`venue_id`,`ranker`);--> statement-breakpoint
CREATE TABLE `tenancies` (
	`id` text PRIMARY KEY NOT NULL,
	`franchise_id` text NOT NULL,
	`venue_id` text NOT NULL,
	`start_year` integer NOT NULL,
	`end_year` integer,
	`is_temporary` integer NOT NULL,
	`is_current` integer NOT NULL,
	FOREIGN KEY (`franchise_id`) REFERENCES `franchises`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tenancies_franchise_idx` ON `tenancies` (`franchise_id`);--> statement-breakpoint
CREATE INDEX `tenancies_venue_idx` ON `tenancies` (`venue_id`);--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `venue_names` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`venue_id` text NOT NULL,
	`name` text NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `venue_names_venue_idx` ON `venue_names` (`venue_id`);--> statement-breakpoint
CREATE TABLE `venues` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`timezone` text NOT NULL,
	`opened_year` integer NOT NULL,
	`closed_year` integer,
	`capacity` integer,
	`fingerprint` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `venues_slug_idx` ON `venues` (`slug`);--> statement-breakpoint
CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`venue_id` text NOT NULL,
	`trip_id` text,
	`visit_date` text NOT NULL,
	`attended_game` integer NOT NULL,
	`home_team_id` text,
	`away_team_id` text,
	`home_score` integer,
	`away_score` integer,
	`seat_section` text,
	`seat_row` text,
	`weather_temp_f` integer,
	`weather_desc` text,
	`notes_user_a` text,
	`notes_user_b` text,
	`is_public` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`home_team_id`) REFERENCES `franchises`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`away_team_id`) REFERENCES `franchises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `visits_venue_idx` ON `visits` (`venue_id`);--> statement-breakpoint
CREATE INDEX `visits_date_idx` ON `visits` (`visit_date`);