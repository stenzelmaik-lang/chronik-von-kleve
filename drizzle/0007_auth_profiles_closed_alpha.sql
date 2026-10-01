CREATE TABLE `auth_access_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`purpose` text NOT NULL,
	`environment` text NOT NULL,
	`email_normalized` text NOT NULL,
	`campaign_id` text,
	`member_id` text,
	`target_user_id` text,
	`issued_by` text NOT NULL,
	`approval_reference` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`consumed_by` text,
	`revoked_at` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`issued_by`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "auth_access_grants_purpose_check" CHECK("auth_access_grants"."purpose" IN ('invite','reset')),
	CONSTRAINT "auth_access_grants_environment_check" CHECK("auth_access_grants"."environment" IN ('local-test','closed-alpha-production')),
	CONSTRAINT "auth_access_grants_target_check" CHECK(("auth_access_grants"."purpose"='invite' AND "auth_access_grants"."campaign_id" IS NOT NULL AND "auth_access_grants"."target_user_id" IS NULL) OR ("auth_access_grants"."purpose"='reset' AND "auth_access_grants"."target_user_id" IS NOT NULL AND "auth_access_grants"."campaign_id" IS NULL AND "auth_access_grants"."member_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_access_grants_token_unique` ON `auth_access_grants` (`token_hash`);--> statement-breakpoint
CREATE INDEX `auth_access_grants_campaign_time` ON `auth_access_grants` (`campaign_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `auth_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`avatar_file_id` text,
	`preferences` text DEFAULT '{"reducedMotion":false,"compactView":false}' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`avatar_file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "auth_profiles_preferences_check" CHECK(json_valid("auth_profiles"."preferences"))
);
--> statement-breakpoint
CREATE TABLE `auth_security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`subject_user_id` text,
	`action` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "auth_security_events_metadata_check" CHECK(json_valid("auth_security_events"."metadata"))
);
--> statement-breakpoint
CREATE INDEX `auth_security_events_subject_time` ON `auth_security_events` (`subject_user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `session_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_public_id_unique` ON `auth_sessions` (`session_id`);--> statement-breakpoint
-- Additive only: generated table rebuild would discard immutable crosswalks.
ALTER TABLE `auth_users` ADD `version` integer NOT NULL DEFAULT 1
  CONSTRAINT auth_users_version_check CHECK(version >= 1);
--> statement-breakpoint
UPDATE auth_sessions SET session_id=lower(hex(randomblob(16))) WHERE session_id IS NULL;
--> statement-breakpoint
-- Old insert paths remain compatible; the public ID never exposes a token hash.
CREATE TRIGGER auth_sessions_assign_public_id AFTER INSERT ON auth_sessions
WHEN NEW.session_id IS NULL BEGIN
  UPDATE auth_sessions SET session_id=lower(hex(randomblob(16))) WHERE session_hash=NEW.session_hash;
END;
