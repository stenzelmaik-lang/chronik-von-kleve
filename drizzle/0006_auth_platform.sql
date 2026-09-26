CREATE TABLE `auth_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_subject` text NOT NULL,
	`provider_email` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "auth_identities_provider_check" CHECK("auth_identities"."provider" IN ('local', 'google', 'discord'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_identities_provider_subject_unique` ON `auth_identities` (`provider`,`provider_subject`);--> statement-breakpoint
CREATE INDEX `auth_identities_user_idx` ON `auth_identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_member_links` (
	`auth_user_id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`approved_by` text NOT NULL,
	`approval_reference` text NOT NULL,
	`linked_at` text NOT NULL,
	FOREIGN KEY (`auth_user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "auth_member_links_approved_by_check" CHECK(length(trim("auth_member_links"."approved_by")) BETWEEN 1 AND 200),
	CONSTRAINT "auth_member_links_approval_reference_check" CHECK(length(trim("auth_member_links"."approval_reference")) BETWEEN 1 AND 300)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_member_links_member_unique` ON `auth_member_links` (`member_id`);--> statement-breakpoint
CREATE TABLE `auth_rate_limits` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`window_started_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`blocked_until` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`session_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_sessions_user_idx` ON `auth_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `auth_sessions_expiry_idx` ON `auth_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `auth_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_normalized` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text,
	`email_verified_at` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "auth_users_status_check" CHECK("auth_users"."status" IN ('active', 'blocked'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_users_email_normalized_unique` ON `auth_users` (`email_normalized`);
--> statement-breakpoint
CREATE TRIGGER auth_member_links_no_update
BEFORE UPDATE ON auth_member_links
BEGIN
  SELECT RAISE(ABORT, 'auth member links are immutable; require a reviewed unlink and relink procedure');
END;
--> statement-breakpoint
CREATE TRIGGER auth_member_links_no_delete
BEFORE DELETE ON auth_member_links
BEGIN
  SELECT RAISE(ABORT, 'auth member links are immutable; require a reviewed unlink and relink procedure');
END;
