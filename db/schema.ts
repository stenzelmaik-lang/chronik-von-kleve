import {
  check,
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  foreignKey,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import {
  KLEVE_CAMPAIGN_ID,
  campaignRoleSchema,
  canonStatusSchema,
  entityTypeSchema,
  knowledgeStateSchema,
  visibilitySchema,
} from "@/domain/types";
export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});
export const members = sqliteTable("members", {
  campaignId: text("campaign_id").notNull().default(KLEVE_CAMPAIGN_ID),
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("pending"),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
}, (t) => [
  check("members_version_check", sql`${t.version} >= 1`),
]);
export const platformRoles = sqliteTable("platform_roles", {
  userId: text("user_id").notNull(),
  role: text("role", { enum: ["platform_admin"] }).notNull(),
  status: text("status", { enum: ["active", "revoked"] }).notNull(),
  grantedBy: text("granted_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  version: integer("version").notNull().default(1),
}, (t) => [
  primaryKey({ columns: [t.userId, t.role] }),
  index("idx_platform_roles_status").on(t.role, t.status),
  check("platform_roles_role_check", sql`${t.role} = 'platform_admin'`),
  check("platform_roles_status_check", sql`${t.status} IN ('active', 'revoked')`),
  check("platform_roles_version_check", sql`${t.version} >= 1`),
]);
export const campaignMemberships = sqliteTable("campaign_memberships", {
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  userId: text("user_id").notNull().references(() => members.id),
  role: text("role", { enum: campaignRoleSchema.options }).notNull(),
  status: text("status", { enum: ["pending", "active", "blocked"] }).notNull(),
  source: text("source", { enum: ["legacy_backfill", "manual"] }).notNull(),
  grantedBy: text("granted_by"),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  primaryKey({ columns: [t.campaignId, t.userId] }),
  index("idx_campaign_memberships_campaign_status").on(t.campaignId, t.status),
  index("idx_campaign_memberships_user_status").on(t.userId, t.status),
  check("campaign_memberships_role_check", sql`${t.role} IN ('campaign_owner', 'campaign_gm', 'campaign_editor', 'player')`),
  check("campaign_memberships_status_check", sql`${t.status} IN ('pending', 'active', 'blocked')`),
  check("campaign_memberships_source_check", sql`${t.source} IN ('legacy_backfill', 'manual')`),
  check("campaign_memberships_version_check", sql`${t.version} >= 1`),
]);
export const roleAuditEvents = sqliteTable("role_audit_events", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  actorKind: text("actor_kind", { enum: ["user", "system"] }).notNull(),
  action: text("action").notNull(),
  subjectUserId: text("subject_user_id").notNull(),
  campaignId: text("campaign_id"),
  beforeState: text("before_state").notNull().default("{}"),
  afterState: text("after_state").notNull().default("{}"),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [
  index("idx_role_audit_subject_time").on(t.subjectUserId, t.createdAt),
  index("idx_role_audit_campaign_time").on(t.campaignId, t.createdAt),
  check("role_audit_events_actor_kind_check", sql`${t.actorKind} IN ('user', 'system')`),
  check("role_audit_events_action_check", sql`${t.action} IN ('campaign_membership.backfilled', 'campaign_membership.status_changed', 'platform_admin.bootstrapped')`),
  check("role_audit_events_before_state_check", sql`json_valid(${t.beforeState})`),
  check("role_audit_events_after_state_check", sql`json_valid(${t.afterState})`),
]);
export const records = sqliteTable(
  "records",
  {
    campaignId: text("campaign_id").notNull().default(KLEVE_CAMPAIGN_ID),
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    kind: text("kind").notNull(),
    visibility: text("visibility").notNull().default("private"),
    title: text("title").notNull(),
    body: text("body").notNull().default("{}"),
    gmBody: text("gm_body").notNull().default(""),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_records_kind_owner").on(t.kind, t.ownerId),
    index("idx_records_kind_visibility").on(t.kind, t.visibility),
  ],
);
export const files = sqliteTable(
  "files",
  {
    campaignId: text("campaign_id").notNull().default(KLEVE_CAMPAIGN_ID),
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    visibility: text("visibility").notNull().default("private"),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    key: text("key").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("idx_files_owner").on(t.ownerId),
    uniqueIndex("idx_files_campaign_id").on(t.campaignId, t.id),
  ],
);
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const recoverySources = sqliteTable("recovery_sources", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  sha256: text("sha256").notNull(),
  r2Key: text("r2_key"),
  metadata: text("metadata").notNull(),
  createdAt: text("created_at").notNull(),
}, t => [index("idx_recovery_sources_campaign").on(t.campaignId)]);

export const recoveryRecords = sqliteTable("recovery_records", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  sourceId: text("source_id").notNull().references(() => recoverySources.id),
  // Deleting a world entity does not delete the historical evidence.
  entityId: text("entity_id").references(() => entities.id, {onDelete:"set null"}),
  legacyId: text("legacy_id"),
  title: text("title").notNull(),
  recoveryStatus: text("recovery_status").notNull().default("GM_REVIEW"),
  metadata: text("metadata").notNull(),
  createdAt: text("created_at").notNull(),
}, t => [index("idx_recovery_records_campaign_source").on(t.campaignId,t.sourceId),index("idx_recovery_records_campaign_entity").on(t.campaignId,t.entityId)]);

export const recoveryConflicts = sqliteTable("recovery_conflicts", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  metadata: text("metadata").notNull(),
  createdAt: text("created_at").notNull(),
}, t=>[index("idx_recovery_conflicts_campaign").on(t.campaignId)]);

export const entities = sqliteTable(
  "entities",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .default(KLEVE_CAMPAIGN_ID)
      .references(() => campaigns.id),
    type: text("type", { enum: entityTypeSchema.options }).notNull(),
    canonStatus: text("canon_status", { enum: canonStatusSchema.options })
      .notNull()
      .default("WORKING"),
    legacyRecordId: text("legacy_record_id").references(() => records.id, {
      onDelete: "cascade",
    }),
    ownerId: text("owner_id").notNull(),
    visibility: text("visibility", { enum: visibilitySchema.options })
      .notNull()
      .default("sl"),
    title: text("title").notNull().default(""),
    content: text("content").notNull().default("{}"),
    gmBody: text("gm_body").notNull().default(""),
    version: integer("version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_entities_campaign_id").on(t.campaignId, t.id),
    uniqueIndex("idx_entities_legacy").on(t.legacyRecordId),
    index("idx_entities_campaign_type").on(t.campaignId, t.type),
  ],
);

export const relationships = sqliteTable(
  "relationships",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .default(KLEVE_CAMPAIGN_ID)
      .references(() => campaigns.id),
    sourceId: text("source_id").notNull(),
    targetId: text("target_id").notNull(),
    type: text("type").notNull(),
    visibility: text("visibility", { enum: visibilitySchema.options })
      .notNull()
      .default("sl"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.campaignId, t.sourceId],
      foreignColumns: [entities.campaignId, entities.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.campaignId, t.targetId],
      foreignColumns: [entities.campaignId, entities.id],
    }).onDelete("cascade"),
    index("idx_relationships_campaign_source").on(t.campaignId, t.sourceId),
  ],
);

export const knowledge = sqliteTable(
  "knowledge",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .default(KLEVE_CAMPAIGN_ID)
      .references(() => campaigns.id),
    entityId: text("entity_id").notNull(),
    audience: text("audience", { enum: ["public", "group", "player"] }).notNull(),
    subjectId: text("subject_id").notNull(),
    state: text("state", { enum: knowledgeStateSchema.options }).notNull(),
    discoveryState: text("discovery_state"),
    version: integer("version").notNull().default(1),
    grantedBy: text("granted_by").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.campaignId, t.entityId],
      foreignColumns: [entities.campaignId, entities.id],
    }).onDelete("cascade"),
    uniqueIndex("idx_knowledge_subject").on(
      t.campaignId,
      t.entityId,
      t.audience,
      t.subjectId,
    ),
  ],
);

export const worldEvents = sqliteTable(
  "world_events",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .default(KLEVE_CAMPAIGN_ID)
      .references(() => campaigns.id),
    entityId: text("entity_id"),
    actorId: text("actor_id").notNull(),
    type: text("type").notNull(),
    payload: text("payload").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("idx_world_events_campaign_time").on(t.campaignId, t.createdAt),
  ],
);

// 1:1 structured extensions of the shared entity identities, never a second world.
export const locationNodes = sqliteTable("location_nodes", {
  entityId: text("entity_id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  locationId: text("location_id").notNull(),
  parentId: text("parent_id"),
  level: text("level", {enum:["location","area","room","information"]}).notNull(),
  position: integer("position").notNull().default(0),
  worldState: text("world_state").notNull().default("active"),
  worldVisibility: text("world_visibility").notNull().default("group"),
  worldSubjectId: text("world_subject_id"),
  markers: text("markers").notNull().default("[]"),
  attributes: text("attributes").notNull().default("{}"),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
}, t => [
  foreignKey({columns:[t.campaignId,t.entityId],foreignColumns:[entities.campaignId,entities.id]}),
  foreignKey({columns:[t.campaignId,t.locationId],foreignColumns:[entities.campaignId,entities.id]}),
  foreignKey({columns:[t.campaignId,t.parentId],foreignColumns:[entities.campaignId,entities.id]}),
  index("idx_location_nodes_campaign_location").on(t.campaignId,t.locationId),
]);

export const locationActions = sqliteTable("location_actions", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull().references(() => campaigns.id),
  locationId: text("location_id").notNull(),
  targetId: text("target_id").notNull(),
  definition: text("definition").notNull(),
  status: text("status").notNull().default("ready"),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
},t=>[
  foreignKey({columns:[t.campaignId,t.locationId],foreignColumns:[entities.campaignId,entities.id]}),
  index("idx_location_actions_campaign_location").on(t.campaignId,t.locationId),
]);

// Phase C editorial snapshots remain attached to the existing stable Entity IDs.
// Releases are audience-specific and never mutate location_nodes or entities.
export const entityRevisions = sqliteTable("entity_revisions", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull(),
  entityId: text("entity_id").notNull(),
  revisionNo: integer("revision_no").notNull(),
  parentRevisionId: text("parent_revision_id"),
  audienceScope: text("audience_scope", { enum: ["gm", "public", "group", "player"] }).notNull(),
  audienceKey: text("audience_key").notNull(),
  audienceUserId: text("audience_user_id"),
  status: text("status", { enum: ["draft", "in_review", "approved", "rejected", "archived"] }).notNull(),
  baseEntityVersion: integer("base_entity_version").notNull(),
  version: integer("version").notNull().default(1),
  playerPayloadJson: text("player_payload_json").notNull().default("{}"),
  gmSecretJson: text("gm_secret_json").notNull().default("{}"),
  geographyJson: text("geography_json").notNull().default('{"status":"unknown"}'),
  authorId: text("author_id").notNull().references(() => members.id, { onDelete: "restrict" }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  foreignKey({ columns: [t.campaignId, t.entityId], foreignColumns: [entities.campaignId, entities.id] }).onDelete("restrict"),
  foreignKey({ columns: [t.parentRevisionId], foreignColumns: [t.id] }).onDelete("restrict"),
  foreignKey({ columns: [t.campaignId, t.audienceUserId], foreignColumns: [campaignMemberships.campaignId, campaignMemberships.userId] }).onDelete("restrict"),
  uniqueIndex("uq_entity_revisions_campaign_entity_no").on(t.campaignId, t.entityId, t.revisionNo),
  uniqueIndex("uq_entity_revisions_campaign_entity_id").on(t.campaignId, t.entityId, t.id),
  uniqueIndex("uq_entity_revisions_audience_ref").on(t.campaignId, t.entityId, t.id, t.audienceScope, t.audienceKey),
  uniqueIndex("uq_entity_revisions_draft_target").on(t.campaignId, t.entityId, t.audienceScope, t.audienceKey).where(sql`${t.status} = 'draft'`),
  index("idx_entity_revisions_entity_status").on(t.campaignId, t.entityId, t.status, t.revisionNo),
  index("idx_entity_revisions_parent").on(t.campaignId, t.entityId, t.parentRevisionId),
  check("entity_revisions_no_check", sql`${t.revisionNo} >= 1`),
  check("entity_revisions_version_check", sql`${t.version} >= 1 AND ${t.baseEntityVersion} >= 1`),
  check("entity_revisions_scope_check", sql`${t.audienceScope} IN ('gm','public','group','player')`),
  check("entity_revisions_status_check", sql`${t.status} IN ('draft','in_review','approved','rejected','archived')`),
  check("entity_revisions_payload_check", sql`json_valid(${t.playerPayloadJson}) AND json_type(${t.playerPayloadJson}) = 'object'`),
  check("entity_revisions_gm_secret_check", sql`json_valid(${t.gmSecretJson}) AND json_type(${t.gmSecretJson}) = 'object'`),
  check("entity_revisions_geo_check", sql`(
    json_valid(${t.geographyJson}) AND json_type(${t.geographyJson}) = 'object' AND
    json_extract(${t.geographyJson}, '$.status') IN ('unknown','exact','approximate') AND
    ((json_extract(${t.geographyJson}, '$.status') = 'unknown' AND json_type(${t.geographyJson}, '$.coordinates') IS NULL) OR
     (json_extract(${t.geographyJson}, '$.status') IN ('exact','approximate') AND
      json_type(${t.geographyJson}, '$.coordinates') = 'array' AND json_array_length(${t.geographyJson}, '$.coordinates') = 2 AND
      json_type(${t.geographyJson}, '$.coordinates[0]') IN ('integer','real') AND json_extract(${t.geographyJson}, '$.coordinates[0]') BETWEEN -180 AND 180 AND
      json_type(${t.geographyJson}, '$.coordinates[1]') IN ('integer','real') AND json_extract(${t.geographyJson}, '$.coordinates[1]') BETWEEN -90 AND 90 AND
      json_type(${t.geographyJson}, '$.source') = 'text' AND length(trim(json_extract(${t.geographyJson}, '$.source'))) BETWEEN 1 AND 300 AND
      json_type(${t.geographyJson}, '$.reviewedAt') = 'text' AND
      (json_type(${t.geographyJson}, '$.reference') IS NULL OR json_type(${t.geographyJson}, '$.reference') = 'text') AND
      (json_extract(${t.geographyJson}, '$.status') = 'exact' OR
       (json_type(${t.geographyJson}, '$.accuracyMeters') = 'integer' AND json_extract(${t.geographyJson}, '$.accuracyMeters') BETWEEN 1 AND 1000000))))
  )`),
  check("entity_revisions_audience_key_check", sql`(
    (${t.audienceScope} = 'gm' AND ${t.audienceKey} = '@gm' AND ${t.audienceUserId} IS NULL) OR
    (${t.audienceScope} = 'public' AND ${t.audienceKey} = '@public' AND ${t.audienceUserId} IS NULL) OR
    (${t.audienceScope} = 'group' AND ${t.audienceKey} = '@group' AND ${t.audienceUserId} IS NULL) OR
    (${t.audienceScope} = 'player' AND ${t.audienceUserId} IS NOT NULL AND ${t.audienceKey} = ${t.audienceUserId})
  )`),
]);

export const entityRevisionReleases = sqliteTable("entity_revision_releases", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull(),
  entityId: text("entity_id").notNull(),
  revisionId: text("revision_id"),
  audienceScope: text("audience_scope", { enum: ["public", "group", "player"] }).notNull(),
  audienceKey: text("audience_key").notNull(),
  audienceUserId: text("audience_user_id"),
  releaseVersion: integer("release_version").notNull(),
  transition: text("transition", { enum: ["publish", "revoke", "block"] }).notNull(),
  discoveryGrantState: text("discovery_grant_state"),
  actorId: text("actor_id").notNull().references(() => members.id, { onDelete: "restrict" }),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [
  foreignKey({ columns: [t.campaignId, t.entityId], foreignColumns: [entities.campaignId, entities.id] }).onDelete("restrict"),
  foreignKey({ columns: [t.campaignId, t.entityId, t.revisionId, t.audienceScope, t.audienceKey], foreignColumns: [entityRevisions.campaignId, entityRevisions.entityId, entityRevisions.id, entityRevisions.audienceScope, entityRevisions.audienceKey] }).onDelete("restrict"),
  foreignKey({ columns: [t.campaignId, t.audienceUserId], foreignColumns: [campaignMemberships.campaignId, campaignMemberships.userId] }).onDelete("restrict"),
  uniqueIndex("uq_entity_revision_releases_target_version").on(t.campaignId, t.entityId, t.audienceScope, t.audienceKey, t.releaseVersion),
  index("idx_entity_revision_releases_target").on(t.campaignId, t.entityId, t.audienceScope, t.audienceKey, t.releaseVersion),
  check("entity_revision_releases_version_check", sql`${t.releaseVersion} >= 1`),
  check("entity_revision_releases_transition_check", sql`${t.transition} IN ('publish','revoke','block')`),
  check("entity_revision_releases_scope_check", sql`${t.audienceScope} IN ('public','group','player')`),
  check("entity_revision_releases_reason_check", sql`length(trim(${t.reason})) BETWEEN 1 AND 500`),
  check("entity_revision_releases_discovery_check", sql`${t.discoveryGrantState} IS NULL OR ${t.discoveryGrantState} IN ('rumored','known','visited','investigated')`),
  check("entity_revision_releases_audience_key_check", sql`(
    (${t.audienceScope} = 'public' AND ${t.audienceKey} = '@public' AND ${t.audienceUserId} IS NULL) OR
    (${t.audienceScope} = 'group' AND ${t.audienceKey} = '@group' AND ${t.audienceUserId} IS NULL) OR
    (${t.audienceScope} = 'player' AND ${t.audienceUserId} IS NOT NULL AND ${t.audienceKey} = ${t.audienceUserId})
  )`),
  check("entity_revision_releases_revision_action_check", sql`(${t.transition} = 'publish' AND ${t.revisionId} IS NOT NULL) OR (${t.transition} <> 'publish' AND ${t.revisionId} IS NULL AND ${t.discoveryGrantState} IS NULL)`),
]);

export const entityRevisionMedia = sqliteTable("entity_revision_media", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull(),
  entityId: text("entity_id").notNull(),
  revisionId: text("revision_id").notNull(),
  fileId: text("file_id").notNull(),
  audienceScope: text("audience_scope", { enum: ["gm", "public", "group", "player"] }).notNull(),
  audienceKey: text("audience_key").notNull(),
  purpose: text("purpose", { enum: ["hero", "gallery", "handout"] }).notNull(),
  altText: text("alt_text").notNull().default(""),
  position: integer("position").notNull().default(0),
  createdAt: text("created_at").notNull(),
}, (t) => [
  foreignKey({ columns: [t.campaignId, t.entityId, t.revisionId, t.audienceScope, t.audienceKey], foreignColumns: [entityRevisions.campaignId, entityRevisions.entityId, entityRevisions.id, entityRevisions.audienceScope, entityRevisions.audienceKey] }).onDelete("restrict"),
  foreignKey({ columns: [t.campaignId, t.fileId], foreignColumns: [files.campaignId, files.id] }).onDelete("restrict"),
  uniqueIndex("uq_entity_revision_media_file_purpose").on(t.campaignId, t.revisionId, t.fileId, t.purpose),
  index("idx_entity_revision_media_file").on(t.campaignId, t.fileId),
  index("idx_entity_revision_media_revision").on(t.campaignId, t.revisionId, t.position),
  check("entity_revision_media_purpose_check", sql`${t.purpose} IN ('hero','gallery','handout')`),
  check("entity_revision_media_position_check", sql`${t.position} >= 0`),
]);

export const entityRevisionEvents = sqliteTable("entity_revision_events", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull(),
  entityId: text("entity_id").notNull(),
  revisionId: text("revision_id").notNull(),
  actorId: text("actor_id").notNull().references(() => members.id, { onDelete: "restrict" }),
  event: text("event", { enum: ["created", "saved", "submitted", "approved", "rejected"] }).notNull(),
  expectedVersion: integer("expected_version").notNull(),
  revisionVersion: integer("revision_version").notNull(),
  reason: text("reason").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, (t) => [
  foreignKey({ columns: [t.campaignId, t.entityId, t.revisionId], foreignColumns: [entityRevisions.campaignId, entityRevisions.entityId, entityRevisions.id] }).onDelete("restrict"),
  uniqueIndex("uq_entity_revision_events_version").on(t.campaignId, t.revisionId, t.revisionVersion),
  index("idx_entity_revision_events_entity_time").on(t.campaignId, t.entityId, t.createdAt),
  check("entity_revision_events_version_check", sql`${t.expectedVersion} >= 0 AND ${t.revisionVersion} >= 1`),
  check("entity_revision_events_reason_check", sql`length(${t.reason}) <= 500`),
]);

// Closed-alpha sign-in is provisioned only through an explicitly reviewed
// identity-to-member crosswalk. Account identity never depends on email equality.
export const authUsers = sqliteTable("auth_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  emailNormalized: text("email_normalized").notNull(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash"),
  emailVerifiedAt: text("email_verified_at"),
  status: text("status", { enum: ["active", "blocked"] }).notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  version: integer("version").notNull().default(1),
}, (t) => [
  uniqueIndex("auth_users_email_normalized_unique").on(t.emailNormalized),
  check("auth_users_status_check", sql`${t.status} IN ('active', 'blocked')`),
  check("auth_users_version_check", sql`${t.version} >= 1`),
]);

export const authIdentities = sqliteTable("auth_identities", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: ["local", "google", "discord"] }).notNull(),
  providerSubject: text("provider_subject").notNull(),
  providerEmail: text("provider_email"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  uniqueIndex("auth_identities_provider_subject_unique").on(t.provider, t.providerSubject),
  index("auth_identities_user_idx").on(t.userId),
  check("auth_identities_provider_check", sql`${t.provider} IN ('local', 'google', 'discord')`),
]);

export const authSessions = sqliteTable("auth_sessions", {
  sessionHash: text("session_hash").primaryKey(),
  sessionId: text("session_id"),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  revokedAt: text("revoked_at"),
}, (t) => [
  uniqueIndex("auth_sessions_public_id_unique").on(t.sessionId),
  index("auth_sessions_user_idx").on(t.userId),
  index("auth_sessions_expiry_idx").on(t.expiresAt),
]);

export const authRateLimits = sqliteTable("auth_rate_limits", {
  keyHash: text("key_hash").primaryKey(),
  windowStartedAt: text("window_started_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  blockedUntil: text("blocked_until"),
  updatedAt: text("updated_at").notNull(),
});

export const authMemberLinks = sqliteTable("auth_member_links", {
  authUserId: text("auth_user_id").primaryKey().references(() => authUsers.id, { onDelete: "restrict" }),
  memberId: text("member_id").notNull().references(() => members.id, { onDelete: "restrict" }),
  approvedBy: text("approved_by").notNull(),
  approvalReference: text("approval_reference").notNull(),
  linkedAt: text("linked_at").notNull(),
}, (t) => [
  uniqueIndex("auth_member_links_member_unique").on(t.memberId),
  check("auth_member_links_approved_by_check", sql`length(trim(${t.approvedBy})) BETWEEN 1 AND 200`),
  check("auth_member_links_approval_reference_check", sql`length(trim(${t.approvalReference})) BETWEEN 1 AND 300`),
]);

// Extensions of the existing account identity; no parallel account/member store.
export const authProfiles = sqliteTable("auth_profiles", {
  userId: text("user_id").primaryKey().references(() => authUsers.id, { onDelete: "cascade" }),
  avatarFileId: text("avatar_file_id").references(() => files.id, { onDelete: "set null" }),
  preferences: text("preferences").notNull().default('{"reducedMotion":false,"compactView":false}'),
}, t => [check("auth_profiles_preferences_check", sql`json_valid(${t.preferences})`)]);
export const authAccessGrants = sqliteTable("auth_access_grants", {
  id: text("id").primaryKey(), tokenHash: text("token_hash").notNull(),
  purpose: text("purpose", { enum: ["invite", "reset"] }).notNull(),
  environment: text("environment", { enum: ["local-test", "closed-alpha-production"] }).notNull(),
  email: text("email_normalized").notNull(),
  campaignId: text("campaign_id").references(() => campaigns.id),
  memberId: text("member_id").references(() => members.id),
  targetUserId: text("target_user_id").references(() => authUsers.id),
  issuedBy: text("issued_by").notNull().references(() => authUsers.id),
  approvalReference: text("approval_reference").notNull(),
  createdAt: text("created_at").notNull(), expiresAt: text("expires_at").notNull(),
  consumedAt: text("consumed_at"), consumedBy: text("consumed_by"), revokedAt: text("revoked_at"),
}, t => [
  uniqueIndex("auth_access_grants_token_unique").on(t.tokenHash),
  index("auth_access_grants_campaign_time").on(t.campaignId, t.createdAt),
  check("auth_access_grants_purpose_check", sql`${t.purpose} IN ('invite','reset')`),
  check("auth_access_grants_environment_check", sql`${t.environment} IN ('local-test','closed-alpha-production')`),
  check("auth_access_grants_target_check", sql`(${t.purpose}='invite' AND ${t.campaignId} IS NOT NULL AND ${t.targetUserId} IS NULL) OR (${t.purpose}='reset' AND ${t.targetUserId} IS NOT NULL AND ${t.campaignId} IS NULL AND ${t.memberId} IS NULL)`),
]);
export const authSecurityEvents = sqliteTable("auth_security_events", {
  id: text("id").primaryKey(), actorId: text("actor_id").notNull(),
  subjectUserId: text("subject_user_id"), action: text("action").notNull(),
  metadata: text("metadata").notNull().default("{}"), createdAt: text("created_at").notNull(),
}, t => [
  index("auth_security_events_subject_time").on(t.subjectUserId, t.createdAt),
  check("auth_security_events_metadata_check", sql`json_valid(${t.metadata})`),
]);
