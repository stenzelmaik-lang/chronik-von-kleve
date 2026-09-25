import { z } from "zod";
import { actor, database, failure, gmOnly, HttpError, input, json, sameOrigin } from "@/server/access";
import { canAdvanceDiscovery, locationIsSecret } from "@/domain/location-discovery";
import { parseObject } from "@/server/entities";
import { discoveryStates, stateMarkerIds, worldStateIds } from "@/domain/location-types";

export const dynamic = "force-dynamic";
const schema = z.object({
  placeId: z.string().trim().min(1).max(160), entityId: z.string().min(1).max(160), mode: z.enum(["discovery", "world"]),
  audience: z.enum(["group", "player"]).optional(), playerId: z.string().max(200).optional(),
  discoveryState: z.enum(discoveryStates).optional(), worldState: z.enum(worldStateIds).optional(),
  markers: z.array(z.enum(stateMarkerIds)).max(8).optional(), expectedRevision: z.number().int().nonnegative().optional(),
  reason: z.string().trim().min(1).max(500),
}).strict();

export async function POST(req: Request) {
  try {
    sameOrigin(req); const a = await actor(); gmOnly(a);
    const parsed = schema.safeParse(await input(req));
    if (!parsed.success) throw new HttpError(400, "Ungültige Ortszustandsänderung.");
    const d = parsed.data, db = database();
    const node = await db.prepare("SELECT revision,world_state,markers FROM location_nodes WHERE campaign_id=? AND location_id=? AND entity_id=?").bind(a.campaignId, d.placeId, d.entityId).first<{revision:number;world_state:string;markers:string}>();
    if (!node) throw new HttpError(404, "Ortsobjekt nicht gefunden.");
    const now = new Date().toISOString();
    if (d.mode === "world") {
      if (!d.worldState && !d.markers) throw new HttpError(400, "Neuer Zustand fehlt.");
      const expected = d.expectedRevision ?? node.revision;
      const result = await db.batch([
        db.prepare("UPDATE location_nodes SET world_state=COALESCE(?,world_state),markers=COALESCE(?,markers),revision=revision+1,updated_at=? WHERE campaign_id=? AND location_id=? AND entity_id=? AND revision=?").bind(d.worldState || null, d.markers ? JSON.stringify(d.markers) : null, now, a.campaignId, d.placeId, d.entityId, expected),
        db.prepare("INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM location_nodes WHERE campaign_id=? AND entity_id=? AND revision=? AND updated_at=?)").bind(crypto.randomUUID(), a.campaignId, d.entityId, a.id, "location.state.changed", JSON.stringify({ previousWorldState: node.world_state, previousMarkers: node.markers, worldState: d.worldState || node.world_state, markers: d.markers || safeMarkers(node.markers), reason: d.reason, expectedRevision: expected, nextRevision: expected + 1 }), now, a.campaignId, d.entityId, expected + 1, now),
      ]);
      if (!result[0].meta.changes || !result[1].meta.changes) throw new HttpError(409, "Dieses Ortsobjekt wurde inzwischen geändert. Bitte lade es neu.");
      return json({ ok: true, mode: d.mode, entityId: d.entityId, revision: expected + 1 });
    }
    if (!d.audience || !d.discoveryState) throw new HttpError(400, "Discovery-Ziel und Status fehlen.");
    const subject = d.audience === "group" ? a.campaignId : d.playerId;
    if (!subject) throw new HttpError(400, "Spieler fehlt.");
    if (d.audience === "player") {
      const member = await db.prepare(
        `SELECT m.id FROM members m
         LEFT JOIN campaign_memberships cm ON cm.campaign_id=? AND cm.user_id=m.id
         WHERE m.id=? AND (
           (cm.user_id IS NOT NULL AND cm.status=?) OR
           (cm.user_id IS NULL AND m.campaign_id=? AND m.status=?)
         )`,
      ).bind(a.campaignId, subject, "active", a.campaignId, "active").first();
      if (!member) throw new HttpError(400, "Spieler ist nicht aktiv in dieser Chronik.");
    }
    const entity = await db.prepare("SELECT canon_status,content FROM entities WHERE campaign_id=? AND id=?").bind(a.campaignId,d.entityId).first<{canon_status:string;content:string}>();
    const attributes = await db.prepare("SELECT attributes FROM location_nodes WHERE campaign_id=? AND entity_id=?").bind(a.campaignId,d.entityId).first<{attributes:string}>();
    if (!entity || locationIsSecret(entity.canon_status,parseObject(entity.content),parseObject(attributes?.attributes || "{}")))
      throw new HttpError(400, "GM_SECRET kann nicht durch Discovery freigegeben werden.");
    if (d.expectedRevision === undefined) throw new HttpError(400, "Erwartete Discovery-Version fehlt (0 für einen neuen Grant).");
    const current = await db.prepare("SELECT version,discovery_state FROM knowledge WHERE campaign_id=? AND entity_id=? AND audience=? AND subject_id=?").bind(a.campaignId,d.entityId,d.audience,subject).first<{version:number;discovery_state:string|null}>();
    const expected = d.expectedRevision;
    if ((current?.version ?? 0) !== expected) throw new HttpError(409, "Diese Discovery wurde inzwischen geändert. Bitte lade sie neu.");
    if (!canAdvanceDiscovery(current?.discovery_state, d.discoveryState))
      throw new HttpError(400, "Discovery darf im normalen Spielbetrieb nicht zurückgestuft werden.");
    // The conditional write and its event run in one atomic D1 batch. changes()
    // refers to this batch's preceding statement, never another request's event/time.
    const write = current
      ? db.prepare("UPDATE knowledge SET discovery_state=?,state=CASE WHEN state='UNKNOWN' AND ?<>'hidden' THEN 'DISCOVERED' ELSE state END,version=version+1,granted_by=?,updated_at=? WHERE campaign_id=? AND entity_id=? AND audience=? AND subject_id=? AND version=?")
        .bind(d.discoveryState,d.discoveryState,a.id,now,a.campaignId,d.entityId,d.audience,subject,expected)
      : db.prepare("INSERT INTO knowledge(id,campaign_id,entity_id,audience,subject_id,state,discovery_state,version,granted_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(campaign_id,entity_id,audience,subject_id) DO NOTHING")
        .bind(crypto.randomUUID(),a.campaignId,d.entityId,d.audience,subject,d.discoveryState === "hidden" ? "UNKNOWN" : "DISCOVERED",d.discoveryState,1,a.id,now,now);
    const result = await db.batch([
      write,
      db.prepare("INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1")
        .bind(crypto.randomUUID(),a.campaignId,d.entityId,a.id,"location.discovery.changed",JSON.stringify({audience:d.audience,subjectId:subject,previousState:current?.discovery_state || "hidden",nextState:d.discoveryState,reason:d.reason,expectedRevision:expected,nextRevision:expected+1}),now),
    ]);
    if (!result[0].meta.changes) throw new HttpError(409, "Diese Discovery wurde inzwischen geändert. Bitte lade sie neu.");
    return json({ok:true,mode:d.mode,entityId:d.entityId,audience:d.audience,revision:expected+1});
  } catch (e) { return failure(e, req); }
}

function safeMarkers(raw: string) {
  try { const value: unknown = JSON.parse(raw); return Array.isArray(value) ? value : []; } catch { return []; }
}
