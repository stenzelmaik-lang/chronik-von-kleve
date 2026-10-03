-- NULL preserves every legacy visibility/knowledge rule.
ALTER TABLE entities ADD COLUMN default_visibility TEXT CONSTRAINT entities_default_visibility_check CHECK (default_visibility IS NULL OR default_visibility IN ('sl_secret','player_visible'));
