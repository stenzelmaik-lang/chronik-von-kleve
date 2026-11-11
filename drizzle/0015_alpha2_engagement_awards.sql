CREATE TABLE `engagement_recipients` (
	`campaign_id` text NOT NULL,
	`member_id` text NOT NULL,
	`interval_id` text NOT NULL,
	`character_id` text NOT NULL,
	PRIMARY KEY(`campaign_id`, `interval_id`, `member_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`interval_id`) REFERENCES `played_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `engagement_recipient_character` ON `engagement_recipients` (`campaign_id`,`interval_id`,`character_id`);--> statement-breakpoint
CREATE TABLE `engagement_verified_notes` (
	`campaign_id` text NOT NULL,
	`member_id` text NOT NULL,
	`interval_id` text NOT NULL,
	`day` text NOT NULL,
	`note_id` text NOT NULL,
	`high_water` integer DEFAULT 0 NOT NULL,
	`seconds` integer NOT NULL,
	PRIMARY KEY(`campaign_id`, `member_id`, `day`, `note_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`interval_id`) REFERENCES `played_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "engagement_verified_note_seconds" CHECK("engagement_verified_notes"."seconds" BETWEEN 1 AND 900)
);
--> statement-breakpoint
CREATE INDEX `engagement_verified_interval` ON `engagement_verified_notes` (`campaign_id`,`interval_id`,`member_id`,`day`);--> statement-breakpoint
ALTER TABLE `engagement_leases` ADD `unclaimed_notebook_seconds` integer DEFAULT 0 NOT NULL;