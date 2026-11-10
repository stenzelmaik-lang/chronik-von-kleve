CREATE TABLE `played_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`session_record_id` text NOT NULL,
	`appointment_id` text,
	`played_on` text NOT NULL,
	`title` text NOT NULL,
	`registered_by` text NOT NULL,
	`registered_at` text NOT NULL,
	CONSTRAINT "played_sessions_day_check" CHECK("played_sessions"."played_on" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `played_sessions_record_day_unique` ON `played_sessions` (`campaign_id`,`session_record_id`,`played_on`);--> statement-breakpoint
CREATE UNIQUE INDEX `played_sessions_appointment_unique` ON `played_sessions` (`campaign_id`,`appointment_id`) WHERE "played_sessions"."appointment_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `xp_settlement_participants` (
	`settlement_id` text NOT NULL,
	`character_id` text NOT NULL,
	`attended` integer NOT NULL,
	`recorded_by` text NOT NULL,
	`recorded_at` text NOT NULL,
	PRIMARY KEY(`settlement_id`, `character_id`),
	FOREIGN KEY (`settlement_id`) REFERENCES `xp_settlements`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "xp_settlement_participants_attended_check" CHECK("xp_settlement_participants"."attended" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE `xp_settlement_rewards` (
	`settlement_id` text NOT NULL,
	`character_id` text NOT NULL,
	`reward_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`status` text NOT NULL,
	`ledger_entry_id` text,
	`error_code` integer,
	`awarded_by` text NOT NULL,
	`updated_at` text NOT NULL,
	`booked_at` text,
	PRIMARY KEY(`settlement_id`, `character_id`, `reward_type`, `scope_id`),
	FOREIGN KEY (`settlement_id`,`character_id`) REFERENCES `xp_settlement_participants`(`settlement_id`,`character_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "xp_settlement_rewards_type_check" CHECK("xp_settlement_rewards"."reward_type" IN ('session','story','mvp','sl_exception')),
	CONSTRAINT "xp_settlement_rewards_status_check" CHECK("xp_settlement_rewards"."status" IN ('pending','booked','failed')),
	CONSTRAINT "xp_settlement_rewards_amount_check" CHECK("xp_settlement_rewards"."amount" BETWEEN 1 AND 1000),
	CONSTRAINT "xp_settlement_rewards_booked_check" CHECK(("xp_settlement_rewards"."status"='booked') = ("xp_settlement_rewards"."ledger_entry_id" IS NOT NULL AND "xp_settlement_rewards"."booked_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE `xp_settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`played_session_id` text NOT NULL,
	`status` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`played_session_id`) REFERENCES `played_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "xp_settlements_status_check" CHECK("xp_settlements"."status" IN ('complete','partial','failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `xp_settlements_session_unique` ON `xp_settlements` (`campaign_id`,`played_session_id`);--> statement-breakpoint
-- Hand-written additions (drizzle-kit does not generate triggers).
-- A registered played evening is proof and never rewritten.
CREATE TRIGGER played_sessions_immutable BEFORE UPDATE ON played_sessions BEGIN
  SELECT RAISE(ABORT, 'Ein registrierter Spielabend ist unveränderlich.');
END;
--> statement-breakpoint
-- A booked receipt line points to a real ledger entry: it can neither be changed nor removed.
-- Corrections happen in the character ledger as an audited counterbooking.
CREATE TRIGGER xp_settlement_rewards_booked_update BEFORE UPDATE ON xp_settlement_rewards
WHEN OLD.status = 'booked' AND (
  NEW.settlement_id IS NOT OLD.settlement_id OR NEW.character_id IS NOT OLD.character_id OR NEW.reward_type IS NOT OLD.reward_type OR NEW.scope_id IS NOT OLD.scope_id
  OR NEW.amount IS NOT OLD.amount OR NEW.reason IS NOT OLD.reason OR NEW.status IS NOT OLD.status OR NEW.ledger_entry_id IS NOT OLD.ledger_entry_id
  OR NEW.error_code IS NOT OLD.error_code OR NEW.awarded_by IS NOT OLD.awarded_by OR NEW.booked_at IS NOT OLD.booked_at
) BEGIN
  SELECT RAISE(ABORT, 'Eine gebuchte Vergabe ist unveränderlich.');
END;
--> statement-breakpoint
CREATE TRIGGER xp_settlement_rewards_booked_delete BEFORE DELETE ON xp_settlement_rewards
WHEN OLD.status = 'booked' BEGIN
  SELECT RAISE(ABORT, 'Eine gebuchte Vergabe ist unveränderlich.');
END;
