import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/sqlite-core";
import {
  KLEVE_CAMPAIGN_ID,
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
  createdAt: text("created_at").notNull(),
});
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
