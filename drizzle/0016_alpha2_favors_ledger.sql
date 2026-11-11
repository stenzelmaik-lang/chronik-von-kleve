CREATE TABLE `favor_crises` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`character_id` text NOT NULL,
	`npc_id` text NOT NULL,
	`opened_at` text NOT NULL,
	`closed_at` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favor_one_open_crisis` ON `favor_crises` (`campaign_id`,`character_id`,`npc_id`) WHERE "favor_crises"."closed_at" IS NULL;--> statement-breakpoint
CREATE TABLE `favor_events` (
	`id` text PRIMARY KEY NOT NULL,
	`obligation_id` text NOT NULL,
	`version` integer NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`details` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`obligation_id`) REFERENCES `favor_obligations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favor_event_revision` ON `favor_events` (`obligation_id`,`version`);--> statement-breakpoint
CREATE TABLE `favor_obligations` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`character_id` text NOT NULL,
	`npc_id` text NOT NULL,
	`direction` text NOT NULL,
	`kind` text NOT NULL,
	`tier` integer,
	`markers` integer NOT NULL,
	`remaining` integer NOT NULL,
	`status` text NOT NULL,
	`visibility` text NOT NULL,
	`description` text NOT NULL,
	`terms` text NOT NULL,
	`due_on` text,
	`gm_note` text DEFAULT '' NOT NULL,
	`legacy_key` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "favor_direction_check" CHECK("favor_obligations"."direction" IN ('owes','owed')),
	CONSTRAINT "favor_visibility_check" CHECK("favor_obligations"."visibility" IN ('parties','sl')),
	CONSTRAINT "favor_status_check" CHECK("favor_obligations"."status" IN ('proposed','confirmed','called','partial','disputed','fulfilled','forgiven','rejected')),
	CONSTRAINT "favor_amount_check" CHECK(("favor_obligations"."kind"='debt' AND "favor_obligations"."markers" BETWEEN 1 AND 20 AND "favor_obligations"."tier" IS NULL)
    OR ("favor_obligations"."kind"='favor' AND "favor_obligations"."markers"=0 AND "favor_obligations"."tier" IS NOT NULL AND "favor_obligations"."tier" BETWEEN 1 AND 3)
    OR ("favor_obligations"."kind"='trade' AND "favor_obligations"."markers"=0 AND "favor_obligations"."tier" IS NULL)),
	CONSTRAINT "favor_remaining_check" CHECK("favor_obligations"."remaining" BETWEEN 0 AND "favor_obligations"."markers"
    AND ("favor_obligations"."status" NOT IN ('fulfilled','forgiven','rejected') OR "favor_obligations"."remaining"=0))
);
--> statement-breakpoint
CREATE INDEX `favor_obligation_pair` ON `favor_obligations` (`campaign_id`,`character_id`,`npc_id`,`kind`,`direction`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `favor_obligation_legacy_source` ON `favor_obligations` (`campaign_id`,`created_by`,`legacy_key`) WHERE "favor_obligations"."legacy_key" IS NOT NULL;
--> statement-breakpoint
CREATE TRIGGER favor_close_crisis_after_change
AFTER UPDATE OF remaining,status,npc_id ON favor_obligations
BEGIN
  UPDATE favor_crises SET closed_at=NEW.updated_at
  WHERE campaign_id=OLD.campaign_id AND character_id=OLD.character_id AND npc_id=OLD.npc_id
    AND closed_at IS NULL AND (
      SELECT COALESCE(SUM(remaining),0) FROM favor_obligations
      WHERE campaign_id=OLD.campaign_id AND character_id=OLD.character_id AND npc_id=OLD.npc_id
        AND kind='debt' AND direction='owes' AND status IN ('confirmed','called','partial','disputed')
    )<3;
END;
--> statement-breakpoint
CREATE TRIGGER favor_open_crisis_after_change
AFTER UPDATE OF remaining,status,npc_id ON favor_obligations
WHEN NEW.kind='debt' AND NEW.direction='owes' AND NEW.status IN ('confirmed','called','partial','disputed')
BEGIN
  INSERT INTO favor_crises(id,campaign_id,character_id,npc_id,opened_at)
  SELECT lower(hex(randomblob(16))),NEW.campaign_id,NEW.character_id,NEW.npc_id,NEW.updated_at
  WHERE (
    SELECT COALESCE(SUM(remaining),0) FROM favor_obligations
    WHERE campaign_id=NEW.campaign_id AND character_id=NEW.character_id AND npc_id=NEW.npc_id
      AND kind='debt' AND direction='owes' AND status IN ('confirmed','called','partial','disputed')
  )>=3 ON CONFLICT DO NOTHING;
END;
