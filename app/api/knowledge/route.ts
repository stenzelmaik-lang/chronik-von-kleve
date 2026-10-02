import { z } from "zod";
import {
  actor,
  database,
  gmOnly,
  sameOrigin,
  input,
  json,
  failure,
  HttpError,
  personalKinds,
} from "@/server/access";
import { knowledgeStateSchema } from "@/domain/types";
import { loadEntities } from "@/server/entities";
import { characterKnowledgeContext } from '@/server/character-knowledge';
export const dynamic = "force-dynamic";
const schema = z
  .object({
    entityId: z.string().min(1).max(100),
    audience: z.enum(["group", "player", "character"]),
    playerId: z.string().max(200).optional(),
    characterId: z.string().min(1).max(100).optional(),
    expectedVersion: z.number().int().min(0).optional(),
    state: knowledgeStateSchema,
  })
  .strict();
export async function GET(req: Request) {
  try {
    const a = await actor();
    gmOnly(a);
    const entityId = new URL(req.url).searchParams.get("entityId");
    if (!entityId) throw new HttpError(400, "Entität fehlt.");
    const r = await database()
      .prepare("SELECT * FROM knowledge WHERE campaign_id=? AND entity_id=?")
      .bind(a.campaignId, entityId)
      .all();
    return json({ knowledge: r.results });
  } catch (e) {
    return failure(e, req);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    gmOnly(a);
    const parsed = schema.safeParse(await input(req));
    if (!parsed.success) throw new HttpError(400, "Ungültige Freigabe.");
    const d = parsed.data,
      db = database(),
      entity = (await loadEntities(db, a.campaignId, d.entityId))[0];
    if (!entity) throw new HttpError(404, "Entität nicht gefunden.");
    if (entity.content.recoveryOnly === true || entity.canonStatus === "GM_SECRET" || entity.content.canonStatus === 'GM_SECRET' || entity.content.canon_status === 'GM_SECRET')
      throw new HttpError(
        400,
        "GM_SECRET kann nicht an Spieler freigegeben werden.",
      );
    if (entity.type === 'SCENE' && entity.content.documentKind === 'story_scene') throw new HttpError(400, 'Szenen werden ausdrücklich im Regiepult freigegeben.');
    if (d.audience === 'character' && !['CLUE', 'HANDOUT'].includes(entity.type)) throw new HttpError(400, 'Charakterwissen ist hier für Hinweise und Handouts vorgesehen.');
    if (d.audience === 'character' && d.expectedVersion === undefined) throw new HttpError(428, 'Lade zuerst den aktuellen Wissensstand.');
    if (d.audience !== 'character' && d.characterId || d.audience !== 'player' && d.playerId) throw new HttpError(400, 'Die Identität passt nicht zur Zielgruppe.');
    // Personal notes and sheets retain their owner's existing privacy controls.
    const legacy=entity.legacyRecordId?await db.prepare('SELECT kind FROM records WHERE id=? AND campaign_id=?').bind(entity.legacyRecordId,a.campaignId).first<{kind:string}>():null;
    if (legacy && personalKinds.includes(legacy.kind))
      throw new HttpError(
        400,
        "Für persönliche Daten gelten die bisherigen Sichtbarkeitsrechte.",
      );
    const subject = d.audience === "group" ? a.campaignId : d.audience === 'character' ? d.characterId : d.playerId;
    if (!subject) throw new HttpError(400, "Spieler fehlt.");
    if (d.audience === 'character') await characterKnowledgeContext(db, a, subject, true);
    if (d.audience === "player") {
      const member = await db
        .prepare(
          `SELECT m.id FROM members m
           LEFT JOIN campaign_memberships cm ON cm.campaign_id=? AND cm.user_id=m.id
           WHERE m.id=? AND (
             (cm.user_id IS NOT NULL AND cm.status=?) OR
             (cm.user_id IS NULL AND m.campaign_id=? AND m.status=?)
           )`,
        )
        .bind(a.campaignId, subject, "active", a.campaignId, "active")
        .first();
      if (!member)
        throw new HttpError(400, "Spieler ist nicht aktiv in dieser Chronik.");
    }
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    const mutation = d.expectedVersion === 0
      ? db.prepare('INSERT OR IGNORE INTO knowledge(id,campaign_id,entity_id,audience,subject_id,state,granted_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,a.campaignId,d.entityId,d.audience,subject,d.state,a.id,now,now)
      : d.expectedVersion !== undefined
        ? db.prepare('UPDATE knowledge SET state=?,version=version+1,granted_by=?,updated_at=? WHERE campaign_id=? AND entity_id=? AND audience=? AND subject_id=? AND version=?').bind(d.state,a.id,now,a.campaignId,d.entityId,d.audience,subject,d.expectedVersion)
        : db
        .prepare(
          "INSERT INTO knowledge(id,campaign_id,entity_id,audience,subject_id,state,granted_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(campaign_id,entity_id,audience,subject_id) DO UPDATE SET state=excluded.state,version=knowledge.version+1,granted_by=excluded.granted_by,updated_at=excluded.updated_at",
        )
        .bind(
          id,
          a.campaignId,
          d.entityId,
          d.audience,
          subject,
          d.state,
          a.id,
          now,
          now,
        );
    const result = await db.batch([
      mutation,
      db
        .prepare(
          "INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1",
        )
        .bind(
          crypto.randomUUID(),
          a.campaignId,
          d.entityId,
          a.id,
          "knowledge.changed",
          JSON.stringify({
            audience: d.audience,
            subjectId: subject,
            state: d.state,
          }),
          now,
        ),
    ]);
    if (result[0].meta.changes !== 1) throw new HttpError(409, 'Dieser Wissensstand wurde inzwischen verändert. Bitte erneut laden.');
    return json({ ok: true });
  } catch (e) {
    return failure(e, req);
  }
}
