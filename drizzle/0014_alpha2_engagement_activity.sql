CREATE TABLE `engagement_daily` (
	`campaign_id` text NOT NULL,
	`member_id` text NOT NULL,
	`day` text NOT NULL,
	`category` text NOT NULL,
	`seconds` integer NOT NULL,
	PRIMARY KEY(`campaign_id`, `member_id`, `day`, `category`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "engagement_daily_seconds_positive" CHECK("engagement_daily"."seconds" > 0)
);
--> statement-breakpoint
CREATE TABLE `engagement_leases` (
	`campaign_id` text NOT NULL,
	`member_id` text NOT NULL,
	`ticket` text NOT NULL,
	`category` text NOT NULL,
	`received_at` integer NOT NULL,
	PRIMARY KEY(`campaign_id`, `member_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
