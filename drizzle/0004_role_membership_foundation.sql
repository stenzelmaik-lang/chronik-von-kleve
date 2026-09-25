-- Additive role and campaign-membership foundation. No legacy rows are moved
-- here; backfill runs as a separately reviewed, idempotent maintenance task.
ALTER TABLE members ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1);

CREATE TABLE platform_roles (
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role = 'platform_admin'),
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  granted_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  PRIMARY KEY (user_id, role)
);
CREATE INDEX idx_platform_roles_status ON platform_roles (role, status);

CREATE TABLE campaign_memberships (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  user_id TEXT NOT NULL REFERENCES members(id),
  role TEXT NOT NULL CHECK (role IN ('campaign_owner', 'campaign_gm', 'campaign_editor', 'player')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'blocked')),
  source TEXT NOT NULL CHECK (source IN ('legacy_backfill', 'manual')),
  granted_by TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (campaign_id, user_id)
);
CREATE INDEX idx_campaign_memberships_campaign_status ON campaign_memberships (campaign_id, status);
CREATE INDEX idx_campaign_memberships_user_status ON campaign_memberships (user_id, status);

CREATE TABLE role_audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  actor_id TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('user', 'system')),
  action TEXT NOT NULL CHECK (action IN (
    'campaign_membership.backfilled',
    'campaign_membership.status_changed',
    'platform_admin.bootstrapped'
  )),
  subject_user_id TEXT NOT NULL,
  campaign_id TEXT,
  before_state TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(before_state)),
  after_state TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(after_state)),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_role_audit_subject_time ON role_audit_events (subject_user_id, created_at);
CREATE INDEX idx_role_audit_campaign_time ON role_audit_events (campaign_id, created_at);

-- Audit records are append-only, including when a caller has direct SQL access.
CREATE TRIGGER role_audit_events_no_update
BEFORE UPDATE ON role_audit_events
BEGIN
  SELECT RAISE(ABORT, 'role audit events are immutable');
END;
CREATE TRIGGER role_audit_events_no_delete
BEFORE DELETE ON role_audit_events
BEGIN
  SELECT RAISE(ABORT, 'role audit events are immutable');
END;
