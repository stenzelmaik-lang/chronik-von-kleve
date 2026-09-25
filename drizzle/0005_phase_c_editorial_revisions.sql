CREATE TABLE `entity_revision_events` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`revision_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`event` text NOT NULL,
	`expected_version` integer NOT NULL,
	`revision_version` integer NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`campaign_id`,`entity_id`,`revision_id`) REFERENCES `entity_revisions`(`campaign_id`,`entity_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "entity_revision_events_version_check" CHECK("entity_revision_events"."expected_version" >= 0 AND "entity_revision_events"."revision_version" >= 1),
	CONSTRAINT "entity_revision_events_reason_check" CHECK(length("entity_revision_events"."reason") <= 500)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_entity_revision_events_version` ON `entity_revision_events` (`campaign_id`,`revision_id`,`revision_version`);--> statement-breakpoint
CREATE INDEX `idx_entity_revision_events_entity_time` ON `entity_revision_events` (`campaign_id`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `entity_revision_media` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`revision_id` text NOT NULL,
	`file_id` text NOT NULL,
	`audience_scope` text NOT NULL,
	`audience_key` text NOT NULL,
	`purpose` text NOT NULL,
	`alt_text` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`,`entity_id`,`revision_id`,`audience_scope`,`audience_key`) REFERENCES `entity_revisions`(`campaign_id`,`entity_id`,`id`,`audience_scope`,`audience_key`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`campaign_id`,`file_id`) REFERENCES `files`(`campaign_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "entity_revision_media_purpose_check" CHECK("entity_revision_media"."purpose" IN ('hero','gallery','handout')),
	CONSTRAINT "entity_revision_media_position_check" CHECK("entity_revision_media"."position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_entity_revision_media_file_purpose` ON `entity_revision_media` (`campaign_id`,`revision_id`,`file_id`,`purpose`);--> statement-breakpoint
CREATE INDEX `idx_entity_revision_media_file` ON `entity_revision_media` (`campaign_id`,`file_id`);--> statement-breakpoint
CREATE INDEX `idx_entity_revision_media_revision` ON `entity_revision_media` (`campaign_id`,`revision_id`,`position`);--> statement-breakpoint
CREATE TABLE `entity_revision_releases` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`revision_id` text,
	`audience_scope` text NOT NULL,
	`audience_key` text NOT NULL,
	`audience_user_id` text,
	`release_version` integer NOT NULL,
	`transition` text NOT NULL,
	`discovery_grant_state` text,
	`actor_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`campaign_id`,`entity_id`) REFERENCES `entities`(`campaign_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`campaign_id`,`entity_id`,`revision_id`,`audience_scope`,`audience_key`) REFERENCES `entity_revisions`(`campaign_id`,`entity_id`,`id`,`audience_scope`,`audience_key`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`campaign_id`,`audience_user_id`) REFERENCES `campaign_memberships`(`campaign_id`,`user_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "entity_revision_releases_version_check" CHECK("entity_revision_releases"."release_version" >= 1),
	CONSTRAINT "entity_revision_releases_transition_check" CHECK("entity_revision_releases"."transition" IN ('publish','revoke','block')),
	CONSTRAINT "entity_revision_releases_scope_check" CHECK("entity_revision_releases"."audience_scope" IN ('public','group','player')),
	CONSTRAINT "entity_revision_releases_reason_check" CHECK(length(trim("entity_revision_releases"."reason")) BETWEEN 1 AND 500),
	CONSTRAINT "entity_revision_releases_discovery_check" CHECK("entity_revision_releases"."discovery_grant_state" IS NULL OR "entity_revision_releases"."discovery_grant_state" IN ('rumored','known','visited','investigated')),
	CONSTRAINT "entity_revision_releases_audience_key_check" CHECK((
    ("entity_revision_releases"."audience_scope" = 'public' AND "entity_revision_releases"."audience_key" = '@public' AND "entity_revision_releases"."audience_user_id" IS NULL) OR
    ("entity_revision_releases"."audience_scope" = 'group' AND "entity_revision_releases"."audience_key" = '@group' AND "entity_revision_releases"."audience_user_id" IS NULL) OR
    ("entity_revision_releases"."audience_scope" = 'player' AND "entity_revision_releases"."audience_user_id" IS NOT NULL AND "entity_revision_releases"."audience_key" = "entity_revision_releases"."audience_user_id")
  )),
	CONSTRAINT "entity_revision_releases_revision_action_check" CHECK(("entity_revision_releases"."transition" = 'publish' AND "entity_revision_releases"."revision_id" IS NOT NULL) OR ("entity_revision_releases"."transition" <> 'publish' AND "entity_revision_releases"."revision_id" IS NULL AND "entity_revision_releases"."discovery_grant_state" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_entity_revision_releases_target_version` ON `entity_revision_releases` (`campaign_id`,`entity_id`,`audience_scope`,`audience_key`,`release_version`);--> statement-breakpoint
CREATE INDEX `idx_entity_revision_releases_target` ON `entity_revision_releases` (`campaign_id`,`entity_id`,`audience_scope`,`audience_key`,`release_version`);--> statement-breakpoint
CREATE TABLE `entity_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`revision_no` integer NOT NULL,
	`parent_revision_id` text,
	`audience_scope` text NOT NULL,
	`audience_key` text NOT NULL,
	`audience_user_id` text,
	`status` text NOT NULL,
	`base_entity_version` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`player_payload_json` text DEFAULT '{}' NOT NULL,
	`gm_secret_json` text DEFAULT '{}' NOT NULL,
	`geography_json` text DEFAULT '{"status":"unknown"}' NOT NULL,
	`author_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`campaign_id`,`entity_id`) REFERENCES `entities`(`campaign_id`,`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`parent_revision_id`) REFERENCES `entity_revisions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`campaign_id`,`audience_user_id`) REFERENCES `campaign_memberships`(`campaign_id`,`user_id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "entity_revisions_no_check" CHECK("entity_revisions"."revision_no" >= 1),
	CONSTRAINT "entity_revisions_version_check" CHECK("entity_revisions"."version" >= 1 AND "entity_revisions"."base_entity_version" >= 1),
	CONSTRAINT "entity_revisions_scope_check" CHECK("entity_revisions"."audience_scope" IN ('gm','public','group','player')),
	CONSTRAINT "entity_revisions_status_check" CHECK("entity_revisions"."status" IN ('draft','in_review','approved','rejected','archived')),
	CONSTRAINT "entity_revisions_payload_check" CHECK(json_valid("entity_revisions"."player_payload_json") AND json_type("entity_revisions"."player_payload_json") = 'object'),
	CONSTRAINT "entity_revisions_gm_secret_check" CHECK(json_valid("entity_revisions"."gm_secret_json") AND json_type("entity_revisions"."gm_secret_json") = 'object'),
	CONSTRAINT "entity_revisions_geo_check" CHECK((
    json_valid("entity_revisions"."geography_json") AND json_type("entity_revisions"."geography_json") = 'object' AND
    json_extract("entity_revisions"."geography_json", '$.status') IN ('unknown','exact','approximate') AND
    ((json_extract("entity_revisions"."geography_json", '$.status') = 'unknown' AND json_type("entity_revisions"."geography_json", '$.coordinates') IS NULL) OR
     (json_extract("entity_revisions"."geography_json", '$.status') IN ('exact','approximate') AND
      json_type("entity_revisions"."geography_json", '$.coordinates') = 'array' AND json_array_length("entity_revisions"."geography_json", '$.coordinates') = 2 AND
      json_type("entity_revisions"."geography_json", '$.coordinates[0]') IN ('integer','real') AND json_extract("entity_revisions"."geography_json", '$.coordinates[0]') BETWEEN -180 AND 180 AND
      json_type("entity_revisions"."geography_json", '$.coordinates[1]') IN ('integer','real') AND json_extract("entity_revisions"."geography_json", '$.coordinates[1]') BETWEEN -90 AND 90 AND
      json_type("entity_revisions"."geography_json", '$.source') = 'text' AND length(trim(json_extract("entity_revisions"."geography_json", '$.source'))) BETWEEN 1 AND 300 AND
      json_type("entity_revisions"."geography_json", '$.reviewedAt') = 'text' AND
      (json_type("entity_revisions"."geography_json", '$.reference') IS NULL OR json_type("entity_revisions"."geography_json", '$.reference') = 'text') AND
      (json_extract("entity_revisions"."geography_json", '$.status') = 'exact' OR
       (json_type("entity_revisions"."geography_json", '$.accuracyMeters') = 'integer' AND json_extract("entity_revisions"."geography_json", '$.accuracyMeters') BETWEEN 1 AND 1000000))))
  )),
	CONSTRAINT "entity_revisions_audience_key_check" CHECK((
    ("entity_revisions"."audience_scope" = 'gm' AND "entity_revisions"."audience_key" = '@gm' AND "entity_revisions"."audience_user_id" IS NULL) OR
    ("entity_revisions"."audience_scope" = 'public' AND "entity_revisions"."audience_key" = '@public' AND "entity_revisions"."audience_user_id" IS NULL) OR
    ("entity_revisions"."audience_scope" = 'group' AND "entity_revisions"."audience_key" = '@group' AND "entity_revisions"."audience_user_id" IS NULL) OR
    ("entity_revisions"."audience_scope" = 'player' AND "entity_revisions"."audience_user_id" IS NOT NULL AND "entity_revisions"."audience_key" = "entity_revisions"."audience_user_id")
  ))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_entity_revisions_campaign_entity_no` ON `entity_revisions` (`campaign_id`,`entity_id`,`revision_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_entity_revisions_campaign_entity_id` ON `entity_revisions` (`campaign_id`,`entity_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_entity_revisions_audience_ref` ON `entity_revisions` (`campaign_id`,`entity_id`,`id`,`audience_scope`,`audience_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_entity_revisions_draft_target` ON `entity_revisions` (`campaign_id`,`entity_id`,`audience_scope`,`audience_key`) WHERE "entity_revisions"."status" = 'draft';--> statement-breakpoint
CREATE INDEX `idx_entity_revisions_entity_status` ON `entity_revisions` (`campaign_id`,`entity_id`,`status`,`revision_no`);--> statement-breakpoint
CREATE INDEX `idx_entity_revisions_parent` ON `entity_revisions` (`campaign_id`,`entity_id`,`parent_revision_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_files_campaign_id` ON `files` (`campaign_id`,`id`);
--> statement-breakpoint

-- Workflow invariants not expressible by Drizzle's table declarations.
CREATE TRIGGER entity_revisions_insert_draft_only
BEFORE INSERT ON entity_revisions
WHEN NEW.status <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'new revisions must start as drafts');
END;
--> statement-breakpoint
CREATE TRIGGER entity_revisions_parent_same_entity
BEFORE INSERT ON entity_revisions
WHEN NEW.parent_revision_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM entity_revisions p
  WHERE p.id=NEW.parent_revision_id AND p.campaign_id=NEW.campaign_id AND p.entity_id=NEW.entity_id
)
BEGIN
  SELECT RAISE(ABORT, 'parent revision must belong to the same campaign entity');
END;
--> statement-breakpoint
CREATE TRIGGER entity_revisions_update_guard
BEFORE UPDATE ON entity_revisions
WHEN NEW.id <> OLD.id
  OR NEW.campaign_id <> OLD.campaign_id
  OR NEW.entity_id <> OLD.entity_id
  OR NEW.revision_no <> OLD.revision_no
  OR NEW.parent_revision_id IS NOT OLD.parent_revision_id
  OR NEW.audience_scope <> OLD.audience_scope
  OR NEW.audience_key <> OLD.audience_key
  OR NEW.audience_user_id IS NOT OLD.audience_user_id
  OR NEW.author_id <> OLD.author_id
  OR NEW.created_at <> OLD.created_at
  OR NEW.version <> OLD.version + 1
  OR NOT (
    (OLD.status='draft' AND NEW.status IN ('draft','in_review')) OR
    (OLD.status='in_review' AND NEW.status IN ('approved','rejected')) OR
    (OLD.status='rejected' AND NEW.status='archived')
  )
  OR (OLD.status <> 'draft' AND (
    NEW.player_payload_json <> OLD.player_payload_json OR
    NEW.gm_secret_json <> OLD.gm_secret_json OR
    NEW.geography_json <> OLD.geography_json
  ))
BEGIN
  SELECT RAISE(ABORT, 'revision state or version conflict');
END;
--> statement-breakpoint
CREATE TRIGGER entity_revision_events_insert_guard
BEFORE INSERT ON entity_revision_events
WHEN NOT EXISTS (
  SELECT 1 FROM entity_revisions r
  WHERE r.id=NEW.revision_id AND r.campaign_id=NEW.campaign_id AND r.entity_id=NEW.entity_id
    AND r.version=NEW.revision_version
    AND (
      (NEW.event='created' AND NEW.expected_version=0 AND r.version=1 AND r.status='draft') OR
      (NEW.event='saved' AND NEW.expected_version + 1=NEW.revision_version AND r.status='draft') OR
      (NEW.event='submitted' AND NEW.expected_version + 1=NEW.revision_version AND r.status='in_review') OR
      (NEW.event='approved' AND NEW.expected_version + 1=NEW.revision_version AND r.status='approved') OR
      (NEW.event='rejected' AND NEW.expected_version + 1=NEW.revision_version AND r.status='rejected')
    )
)
BEGIN
  SELECT RAISE(ABORT, 'revision event does not match committed revision state');
END;
--> statement-breakpoint
CREATE TRIGGER entity_revision_events_no_update
BEFORE UPDATE ON entity_revision_events
BEGIN SELECT RAISE(ABORT, 'revision events are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER entity_revision_events_no_delete
BEFORE DELETE ON entity_revision_events
BEGIN SELECT RAISE(ABORT, 'revision events are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER entity_revision_media_draft_insert
BEFORE INSERT ON entity_revision_media
WHEN NOT EXISTS (
  SELECT 1 FROM entity_revisions r WHERE r.id=NEW.revision_id AND r.campaign_id=NEW.campaign_id
    AND r.entity_id=NEW.entity_id AND r.audience_scope=NEW.audience_scope AND r.audience_key=NEW.audience_key AND r.status='draft'
)
OR NOT EXISTS (
  SELECT 1 FROM files f WHERE f.id=NEW.file_id AND f.campaign_id=NEW.campaign_id
    AND ((NEW.purpose='handout' AND f.mime IN ('application/pdf','image/jpeg','image/png','image/webp')) OR
         (NEW.purpose IN ('hero','gallery') AND f.mime IN ('image/jpeg','image/png','image/webp')))
)
BEGIN SELECT RAISE(ABORT, 'revision media must use an allowed file on a draft'); END;
--> statement-breakpoint
CREATE TRIGGER entity_revision_media_draft_update
BEFORE UPDATE ON entity_revision_media
WHEN NOT EXISTS (SELECT 1 FROM entity_revisions r WHERE r.id=OLD.revision_id AND r.campaign_id=OLD.campaign_id AND r.status='draft')
BEGIN SELECT RAISE(ABORT, 'approved revision media is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER entity_revision_media_draft_delete
BEFORE DELETE ON entity_revision_media
WHEN NOT EXISTS (SELECT 1 FROM entity_revisions r WHERE r.id=OLD.revision_id AND r.campaign_id=OLD.campaign_id AND r.status='draft')
BEGIN SELECT RAISE(ABORT, 'historical revision media is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER entity_revision_releases_insert_guard
BEFORE INSERT ON entity_revision_releases
WHEN NEW.release_version <> COALESCE((
  SELECT MAX(release_version) FROM entity_revision_releases
  WHERE campaign_id=NEW.campaign_id AND entity_id=NEW.entity_id
    AND audience_scope=NEW.audience_scope AND audience_key=NEW.audience_key
),0) + 1
OR (NEW.transition='publish' AND NOT EXISTS (
  SELECT 1 FROM entity_revisions r
  WHERE r.id=NEW.revision_id AND r.campaign_id=NEW.campaign_id AND r.entity_id=NEW.entity_id
    AND r.audience_scope=NEW.audience_scope AND r.audience_key=NEW.audience_key AND r.status='approved'
))
OR (NEW.transition='publish' AND EXISTS (
  SELECT 1 FROM entities e
  LEFT JOIN location_nodes n ON n.campaign_id=e.campaign_id AND n.entity_id=e.id
  WHERE e.campaign_id=NEW.campaign_id AND e.id=NEW.entity_id AND (
    e.canon_status='GM_SECRET' OR json_extract(e.content,'$.recoveryOnly')=1 OR
    json_extract(e.content,'$.canonStatus')='GM_SECRET' OR json_extract(e.content,'$.canon_status')='GM_SECRET' OR
    json_extract(n.attributes,'$.recoveryOnly')=1 OR json_extract(n.attributes,'$.canonStatus')='GM_SECRET' OR
    json_extract(n.attributes,'$.canon_status')='GM_SECRET'
  )
))
BEGIN SELECT RAISE(ABORT, 'release version, approval, or entity safety conflict'); END;
--> statement-breakpoint
CREATE TRIGGER entity_revision_releases_no_update
BEFORE UPDATE ON entity_revision_releases
BEGIN SELECT RAISE(ABORT, 'release history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER entity_revision_releases_no_delete
BEFORE DELETE ON entity_revision_releases
BEGIN SELECT RAISE(ABORT, 'release history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER files_no_delete_when_revision_referenced
BEFORE DELETE ON files
WHEN EXISTS (SELECT 1 FROM entity_revision_media m WHERE m.campaign_id=OLD.campaign_id AND m.file_id=OLD.id)
BEGIN SELECT RAISE(ABORT, 'file is referenced by an editorial revision'); END;
