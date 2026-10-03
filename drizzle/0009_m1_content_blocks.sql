CREATE TABLE entity_content_blocks (
  id TEXT PRIMARY KEY NOT NULL,
  campaign_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  kind TEXT NOT NULL CONSTRAINT entity_content_blocks_kind_check CHECK (length(trim(kind)) BETWEEN 1 AND 100),
  content TEXT NOT NULL CONSTRAINT entity_content_blocks_content_check CHECK (length(content) <= 90000),
  visibility TEXT NOT NULL CONSTRAINT entity_content_blocks_visibility_check CHECK (visibility IN ('sl_secret','player_visible')),
  position INTEGER NOT NULL CONSTRAINT entity_content_blocks_position_check CHECK (typeof(position) = 'integer' AND position BETWEEN 0 AND 2147483647),
  FOREIGN KEY (campaign_id,entity_id) REFERENCES entities(campaign_id,id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX idx_entity_content_blocks_order ON entity_content_blocks(campaign_id,entity_id,position,id);
--> statement-breakpoint
CREATE TRIGGER entity_content_blocks_identity_immutable BEFORE UPDATE OF id,entity_id,campaign_id ON entity_content_blocks
WHEN NEW.id <> OLD.id OR NEW.entity_id <> OLD.entity_id OR NEW.campaign_id <> OLD.campaign_id
BEGIN SELECT RAISE(ABORT,'Immutable content block identity'); END;
