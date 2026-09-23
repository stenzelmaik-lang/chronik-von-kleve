CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `entities` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text DEFAULT 'chronik-von-kleve' NOT NULL,
	`type` text NOT NULL,
	`canon_status` text DEFAULT 'WORKING' NOT NULL,
	`legacy_record_id` text,
	`owner_id` text NOT NULL,
	`visibility` text DEFAULT 'sl' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`content` text DEFAULT '{}' NOT NULL,
	`gm_body` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`legacy_record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_entities_campaign_id` ON `entities` (`campaign_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_entities_legacy` ON `entities` (`legacy_record_id`);--> statement-breakpoint
CREATE INDEX `idx_entities_campaign_type` ON `entities` (`campaign_id`,`type`);--> statement-breakpoint
CREATE TABLE `knowledge` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text DEFAULT 'chronik-von-kleve' NOT NULL,
	`entity_id` text NOT NULL,
	`audience` text NOT NULL,
	`subject_id` text NOT NULL,
	`state` text NOT NULL,
	`granted_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`,`entity_id`) REFERENCES `entities`(`campaign_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_knowledge_subject` ON `knowledge` (`campaign_id`,`entity_id`,`audience`,`subject_id`);--> statement-breakpoint
CREATE TABLE `relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text DEFAULT 'chronik-von-kleve' NOT NULL,
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	`type` text NOT NULL,
	`visibility` text DEFAULT 'sl' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`,`source_id`) REFERENCES `entities`(`campaign_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`,`target_id`) REFERENCES `entities`(`campaign_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_relationships_campaign_source` ON `relationships` (`campaign_id`,`source_id`);--> statement-breakpoint
CREATE TABLE `world_events` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text DEFAULT 'chronik-von-kleve' NOT NULL,
	`entity_id` text,
	`actor_id` text NOT NULL,
	`type` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_world_events_campaign_time` ON `world_events` (`campaign_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `files` ADD `campaign_id` text DEFAULT 'chronik-von-kleve' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `campaign_id` text DEFAULT 'chronik-von-kleve' NOT NULL;--> statement-breakpoint
ALTER TABLE `records` ADD `campaign_id` text DEFAULT 'chronik-von-kleve' NOT NULL;
--> statement-breakpoint
INSERT INTO campaigns(id,name,created_at) VALUES('chronik-von-kleve','Chronik von Kleve','2026-09-14T00:00:00.000Z');
--> statement-breakpoint
-- Identity adapter only: no lore, bodies, R2 bytes or player data are copied.
INSERT INTO entities(id,campaign_id,type,legacy_record_id,owner_id,created_at,updated_at) SELECT id,campaign_id,CASE kind WHEN 'charaktere' THEN 'CHARACTER' WHEN 'nscs' THEN 'NPC' WHEN 'schauplaetze' THEN 'PLACE' WHEN 'archiv' THEN 'HANDOUT' WHEN 'sitzungen' THEN 'SESSION' WHEN 'chronik' THEN 'CHRONICLE' WHEN 'regelwerk' THEN 'RULE' WHEN 'haendler' THEN 'MERCHANT' WHEN 'notizen' THEN 'NOTE' ELSE 'LEGACY' END,id,owner_id,created_at,updated_at FROM records;
--> statement-breakpoint
CREATE TRIGGER records_entity_insert AFTER INSERT ON records BEGIN
INSERT INTO entities(id,campaign_id,type,legacy_record_id,owner_id,created_at,updated_at) VALUES(NEW.id,NEW.campaign_id,CASE NEW.kind WHEN 'charaktere' THEN 'CHARACTER' WHEN 'nscs' THEN 'NPC' WHEN 'schauplaetze' THEN 'PLACE' WHEN 'archiv' THEN 'HANDOUT' WHEN 'sitzungen' THEN 'SESSION' WHEN 'chronik' THEN 'CHRONICLE' WHEN 'regelwerk' THEN 'RULE' WHEN 'haendler' THEN 'MERCHANT' WHEN 'notizen' THEN 'NOTE' ELSE 'LEGACY' END,NEW.id,NEW.owner_id,NEW.created_at,NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER records_campaign_insert BEFORE INSERT ON records WHEN NOT EXISTS (SELECT 1 FROM campaigns WHERE id=NEW.campaign_id) BEGIN SELECT RAISE(ABORT,'Unknown campaign'); END;
--> statement-breakpoint
CREATE TRIGGER records_campaign_update BEFORE UPDATE ON records WHEN NOT EXISTS (SELECT 1 FROM campaigns WHERE id=NEW.campaign_id) BEGIN SELECT RAISE(ABORT,'Unknown campaign'); END;
--> statement-breakpoint
CREATE TRIGGER records_identity_immutable BEFORE UPDATE OF id,campaign_id ON records WHEN NEW.id<>OLD.id OR NEW.campaign_id<>OLD.campaign_id BEGIN SELECT RAISE(ABORT,'Immutable identity'); END;
--> statement-breakpoint
CREATE TRIGGER members_campaign_insert BEFORE INSERT ON members WHEN NOT EXISTS (SELECT 1 FROM campaigns WHERE id=NEW.campaign_id) BEGIN SELECT RAISE(ABORT,'Unknown campaign'); END;
--> statement-breakpoint
CREATE TRIGGER members_campaign_update BEFORE UPDATE ON members WHEN NOT EXISTS (SELECT 1 FROM campaigns WHERE id=NEW.campaign_id) BEGIN SELECT RAISE(ABORT,'Unknown campaign'); END;
--> statement-breakpoint
CREATE TRIGGER members_identity_immutable BEFORE UPDATE OF id,campaign_id ON members WHEN NEW.id<>OLD.id OR NEW.campaign_id<>OLD.campaign_id BEGIN SELECT RAISE(ABORT,'Immutable identity'); END;
--> statement-breakpoint
CREATE TRIGGER files_campaign_insert BEFORE INSERT ON files WHEN NOT EXISTS (SELECT 1 FROM campaigns WHERE id=NEW.campaign_id) BEGIN SELECT RAISE(ABORT,'Unknown campaign'); END;
--> statement-breakpoint
CREATE TRIGGER files_campaign_update BEFORE UPDATE ON files WHEN NOT EXISTS (SELECT 1 FROM campaigns WHERE id=NEW.campaign_id) BEGIN SELECT RAISE(ABORT,'Unknown campaign'); END;
--> statement-breakpoint
CREATE TRIGGER files_identity_immutable BEFORE UPDATE OF id,campaign_id ON files WHEN NEW.id<>OLD.id OR NEW.campaign_id<>OLD.campaign_id BEGIN SELECT RAISE(ABORT,'Immutable identity'); END;
--> statement-breakpoint
CREATE TRIGGER entities_identity_immutable BEFORE UPDATE OF id,campaign_id,legacy_record_id ON entities WHEN NEW.id<>OLD.id OR NEW.campaign_id<>OLD.campaign_id OR NEW.legacy_record_id IS NOT OLD.legacy_record_id BEGIN SELECT RAISE(ABORT,'Immutable identity'); END;
--> statement-breakpoint
CREATE TRIGGER records_audit_update AFTER UPDATE ON records BEGIN INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) VALUES(lower(hex(randomblob(16))),NEW.campaign_id,NEW.id,'legacy-trigger','legacy.updated',json_object('version',NEW.version),NEW.updated_at); END;
--> statement-breakpoint
CREATE TRIGGER records_audit_delete AFTER DELETE ON records BEGIN INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) VALUES(lower(hex(randomblob(16))),OLD.campaign_id,OLD.id,'legacy-trigger','legacy.deleted','{}',strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;
