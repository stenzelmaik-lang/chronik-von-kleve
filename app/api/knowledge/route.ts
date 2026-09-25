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
export const dynamic = "force-dynamic";
const schema = z
  .object({
    entityId: z.string().min(1).max(100),
    audience: z.enum(["group", "player"]),
    playerId: z.string().max(200).optional(),
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
    if (entity.content.recoveryOnly === true || entity.canonStatus === "GM_SECRET")
      throw new HttpError(
        400,
        "GM_SECRET kann nicht an Spieler freigegeben werden.",
      );
    // Personal notes and sheets retain their owner's existing privacy controls.
    const legacy=entity.legacyRecordId?await db.prepare('SELECT kind FROM records WHERE id=? AND campaign_id=?').bind(entity.legacyRecordId,a.campaignId).first<{kind:string}>():null;
    if (legacy && personalKinds.includes(legacy.kind))
      throw new HttpError(
        400,
        "Für persönliche Daten gelten die bisherigen Sichtbarkeitsrechte.",
      );
    const subject = d.audience === "group" ? a.campaignId : d.playerId;
    if (!subject) throw new HttpError(400, "Spieler fehlt.");
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
    await db.batch([
      db
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
        ),
      db
        .prepare(
          "INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) VALUES(?,?,?,?,?,?,?)",
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
    return json({ ok: true });
  } catch (e) {
    return failure(e, req);
  }
}
