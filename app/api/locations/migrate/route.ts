import { z } from "zod";

import { ELECTRIC_TABERNA_ID } from "@/domain/location-model";
import { KLEVE_CAMPAIGN_ID } from "@/domain/types";
import { actor, database, failure, gmOnly, HttpError, input, json, sameOrigin } from "@/server/access";
import { locationMigrationRows, MIGRATION_SOURCE_ID } from "@/server/location-repository";

export const dynamic = "force-dynamic";
const schema = z.object({ placeId: z.literal(ELECTRIC_TABERNA_ID) }).strict();

/** Explicit, repeatable transfer of the accepted V12 fixture. Never invoked during reads. */
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    gmOnly(a);
    const parsed = schema.safeParse(await input(req));
    if (!parsed.success) throw new HttpError(400, "Ungültiger Orts-Migrationsauftrag.");
    const db = database();
    const existing = await db.prepare("SELECT entity_id FROM location_nodes WHERE campaign_id=? AND entity_id=?").bind(KLEVE_CAMPAIGN_ID, ELECTRIC_TABERNA_ID).first<{entity_id:string}>();
    if (existing) return json({ ok: true, migrated: false, reason: "already-migrated", placeId: ELECTRIC_TABERNA_ID });
    const payload = locationMigrationRows();
    const historicActions = await db.prepare("SELECT payload FROM world_events WHERE campaign_id=? AND entity_id=? AND type=?").bind(a.campaignId, ELECTRIC_TABERNA_ID, "location.action.triggered").all<{payload:string}>();
    const historicActionIds = new Set<string>();
    for (const event of historicActions.results) {
      try { const data = JSON.parse(event.payload) as {actionId?: unknown}; if (typeof data.actionId === "string") historicActionIds.add(data.actionId); } catch {}
    }
    for (const action of payload.actions) if (historicActionIds.has(action.id)) action.status = "triggered";
    const statements = [
      ...payload.entities.map((entity) => db.prepare("INSERT INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,title,content,gm_body,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(entity.id, a.campaignId, entity.type, "WORKING", a.id, "sl", entity.title, entity.content, "", 1, payload.now, payload.now)),
      ...payload.nodes.map((node) => db.prepare("INSERT INTO location_nodes(entity_id,campaign_id,location_id,parent_id,level,position,world_state,world_visibility,world_subject_id,markers,attributes,revision,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(node.entityId, a.campaignId, node.locationId, node.parentId, node.level, node.position, node.worldState, node.worldVisibility, node.worldSubjectId, node.markers, node.attributes, node.revision, node.updatedAt)),
      ...payload.relationships.map((rel) => db.prepare("INSERT INTO relationships(id,campaign_id,source_id,target_id,type,visibility,created_at) VALUES(?,?,?,?,?,?,?)").bind(rel.id, a.campaignId, rel.sourceId, rel.targetId, "location.contains", "sl", payload.now)),
      ...payload.actions.map((action) => db.prepare("INSERT INTO location_actions(id,campaign_id,location_id,target_id,definition,status,revision,updated_at) VALUES(?,?,?,?,?,?,?,?)").bind(action.id, a.campaignId, ELECTRIC_TABERNA_ID, action.targetId, action.definition, action.status, action.revision, action.updatedAt)),
      ...payload.grants.map((grant) => db.prepare("INSERT INTO knowledge(id,campaign_id,entity_id,audience,subject_id,state,discovery_state,version,granted_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(campaign_id,entity_id,audience,subject_id) DO NOTHING").bind(`location-discovery.${grant.entityId}`, a.campaignId, grant.entityId, "group", a.campaignId, grant.state, grant.discoveryState, 1, a.id, payload.now, payload.now)),
      db.prepare("INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(), a.campaignId, ELECTRIC_TABERNA_ID, a.id, "location.migrated", JSON.stringify({ source: MIGRATION_SOURCE_ID, entities: payload.entities.length, nodes: payload.nodes.length, actions: payload.actions.length }), payload.now),
    ];
    await db.batch(statements);
    return json({ ok: true, migrated: true, placeId: ELECTRIC_TABERNA_ID, entities: payload.entities.length, nodes: payload.nodes.length });
  } catch (e) {
    console.error("location migration failed", e);
    return failure(e, req);
  }
}
