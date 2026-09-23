CREATE TABLE `recovery_conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`metadata` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_recovery_conflicts_campaign` ON `recovery_conflicts` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `recovery_records` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`source_id` text NOT NULL,
	`entity_id` text,
	`legacy_id` text,
	`title` text NOT NULL,
	`recovery_status` text DEFAULT 'GM_REVIEW' NOT NULL,
	`metadata` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `recovery_sources`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_recovery_records_campaign_source` ON `recovery_records` (`campaign_id`,`source_id`);--> statement-breakpoint
CREATE INDEX `idx_recovery_records_campaign_entity` ON `recovery_records` (`campaign_id`,`entity_id`);--> statement-breakpoint
CREATE TABLE `recovery_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`sha256` text NOT NULL,
	`r2_key` text,
	`metadata` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_recovery_sources_campaign` ON `recovery_sources` (`campaign_id`);