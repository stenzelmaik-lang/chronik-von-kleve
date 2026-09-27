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
  (t) => [index("idx_files_owner").on(t.ownerId)],
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
