CREATE TABLE `location_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`location_id` text NOT NULL,
	`target_id` text NOT NULL,
	`definition` text NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`,`location_id`) REFERENCES `entities`(`campaign_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_location_actions_campaign_location` ON `location_actions` (`campaign_id`,`location_id`);--> statement-breakpoint
CREATE TABLE `location_nodes` (
	`entity_id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`location_id` text NOT NULL,
	`parent_id` text,
	`level` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`world_state` text DEFAULT 'active' NOT NULL,
	`world_visibility` text DEFAULT 'group' NOT NULL,
	`world_subject_id` text,
	`markers` text DEFAULT '[]' NOT NULL,
	`attributes` text DEFAULT '{}' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`,`entity_id`) REFERENCES `entities`(`campaign_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`,`location_id`) REFERENCES `entities`(`campaign_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`,`parent_id`) REFERENCES `entities`(`campaign_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_location_nodes_campaign_location` ON `location_nodes` (`campaign_id`,`location_id`);--> statement-breakpoint
ALTER TABLE `knowledge` ADD `discovery_state` text;--> statement-breakpoint
ALTER TABLE `knowledge` ADD `version` integer DEFAULT 1 NOT NULL;