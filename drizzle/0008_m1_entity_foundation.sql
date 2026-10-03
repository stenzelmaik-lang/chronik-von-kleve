-- Additive compatibility migration. No legacy rows or secrecy flags are rewritten.
ALTER TABLE entities ADD COLUMN play_state TEXT CONSTRAINT entities_play_state_check CHECK (play_state IS NULL OR play_state IN ('unplayed','played','historical'));
--> statement-breakpoint
ALTER TABLE entities ADD COLUMN replaced_by TEXT REFERENCES entities(id) ON DELETE RESTRICT CONSTRAINT entities_replaced_by_self_check CHECK (replaced_by IS NULL OR replaced_by <> id);
--> statement-breakpoint
CREATE TRIGGER entities_replacement_insert BEFORE INSERT ON entities
WHEN NEW.replaced_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM entities WHERE id=NEW.replaced_by AND campaign_id=NEW.campaign_id)
BEGIN SELECT RAISE(ABORT,'Replacement must belong to the same campaign'); END;
--> statement-breakpoint
CREATE TRIGGER entities_replacement_update BEFORE UPDATE OF replaced_by,campaign_id ON entities
WHEN NEW.replaced_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM entities WHERE id=NEW.replaced_by AND campaign_id=NEW.campaign_id)
BEGIN SELECT RAISE(ABORT,'Replacement must belong to the same campaign'); END;
--> statement-breakpoint
CREATE TRIGGER entities_canon_insert BEFORE INSERT ON entities
WHEN NEW.canon_status NOT IN ('draft','open','confirmed','replaced','CANON','WORKING','RUMOR','GM_SECRET','PLAYER_KNOWLEDGE','SUPERSEDED','OPEN')
BEGIN SELECT RAISE(ABORT,'Invalid canon status'); END;
--> statement-breakpoint
CREATE TRIGGER entities_canon_update BEFORE UPDATE OF canon_status ON entities
WHEN NEW.canon_status IS NOT OLD.canon_status AND NEW.canon_status NOT IN ('draft','open','confirmed','replaced','CANON','WORKING','RUMOR','GM_SECRET','PLAYER_KNOWLEDGE','SUPERSEDED','OPEN')
BEGIN SELECT RAISE(ABORT,'Invalid canon status'); END;
