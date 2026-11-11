CREATE INDEX `engagement_daily_retention` ON `engagement_daily` (`day`);--> statement-breakpoint
CREATE INDEX `engagement_lease_retention` ON `engagement_leases` (`received_at`);--> statement-breakpoint
CREATE INDEX `engagement_verified_retention` ON `engagement_verified_notes` (`day`);