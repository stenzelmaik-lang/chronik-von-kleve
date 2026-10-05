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
} from "@/server/access";
import { entityTypeSchema, canonStatusSchema, playStateSchema, legacyCanonStatusSchema } from "@/domain/types";
import { loadEntities, grantsFor, projectEntity } from "@/server/entities";
import { characterKnowledgeContext } from '@/server/character-knowledge';
import {npcRedactedCards} from '@/server/npc-redacted-cards';
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const a = await actor(),
      id = new URL(req.url).searchParams.get("id") || undefined,
      db = database();
    const characterId = new URL(req.url).searchParams.get('characterId');
    const requestedType = new URL(req.url).searchParams.get('type');
    const type = requestedType === null ? undefined : entityTypeSchema.safeParse(requestedType);
    if (type && !type.success) throw new HttpError(400, "Ungültiger Entity-Typ.");
    const includeRedacted=new URL(req.url).searchParams.get('includeRedacted')==='1';
    if(includeRedacted&&(id||!type?.success||type.data!=='NPC'))throw new HttpError(400,'Anonyme Karten sind nur in der NPC-Übersicht verfügbar.');
    const character = characterId ? await characterKnowledgeContext(db, a, characterId) : undefined;
    const [entities, grants] = await Promise.all([
      loadEntities(db, a.campaignId, id),
      grantsFor(db, a, character),
    ]);
    const result = entities
      .filter((e) => !type || (type.success && e.type === type.data))
      .map((e) => projectEntity(a, e, grants, character))
      .filter((e) => e !== null);
    if (id && !result.length)
      throw new HttpError(404, "Entität nicht gefunden.");
    return json({ entities: result,...(includeRedacted?{redactedNPCs:await npcRedactedCards(a,entities,grants,character)}:{}) });
  } catch (e) {
    return failure(e, req);
  }
}
// Minimal authoring path for the security foundation, not a second CMS.
const schema = z
  .object({
    type: entityTypeSchema,
    canonStatus: z.union([canonStatusSchema, legacyCanonStatusSchema]).default("draft"),
    playState: playStateSchema.nullable().optional(),
    replacedBy: z.string().trim().min(1).nullable().optional(),
    defaultVisibility: z.enum(['sl_secret','player_visible']).optional(),
    title: z.string().trim().min(1).max(200),
    text: z.string().max(90000),
    gmBody: z.string().max(30000).default(""),
  })
  .strict();
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    gmOnly(a);
    const parsed = schema.safeParse(await input(req));
    if (!parsed.success) throw new HttpError(400, "Ungültige Entität.");
    const d = parsed.data,
      id = crypto.randomUUID(),
      now = new Date().toISOString(),
      db = database();
    if (d.replacedBy && !(await db.prepare("SELECT id FROM entities WHERE campaign_id=? AND id=?").bind(a.campaignId, d.replacedBy).first()))
      throw new HttpError(400, "Nachfolger-Entity nicht gefunden.");
    await db.batch([
      db
        .prepare(
          "INSERT INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,title,content,gm_body,created_at,updated_at,play_state,replaced_by,default_visibility) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          a.campaignId,
          d.type,
          d.canonStatus,
          a.id,
          "sl",
          d.title,
          JSON.stringify({ text: d.text, ...(d.type === 'NPC' ? { field_visibility: {} } : {}) }),
          d.gmBody,
          now,
          now,
          d.playState ?? null,
          d.replacedBy ?? null,
          d.defaultVisibility ?? null,
        ),
      db
        .prepare(
          "INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) VALUES(?,?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          a.campaignId,
          id,
          a.id,
          "entity.created",
          JSON.stringify({ canonStatus: d.canonStatus }),
          now,
        ),
    ]);
    return json({ id, campaignId: a.campaignId }, 201);
  } catch (e) {
    return failure(e, req);
  }
}
const updateSchema = z.object({
  id: z.string().trim().min(1).max(200),
  expectedVersion: z.number().int().min(1),
  canonStatus: schema.shape.canonStatus.removeDefault().optional(),
  playState: schema.shape.playState,
  replacedBy: schema.shape.replacedBy,
  defaultVisibility: schema.shape.defaultVisibility,
}).strict().refine(d=>['canonStatus','playState','replacedBy','defaultVisibility'].some(k=>k in d));
export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    const a=await actor(); gmOnly(a);
    const parsed=updateSchema.safeParse(await input(req));
    if(!parsed.success) throw new HttpError(400,'Ungültige Entity-Änderung.');
    const d=parsed.data,db=database();
    const entity=(await loadEntities(db,a.campaignId,d.id))[0];
    if(!entity || !projectEntity(a,entity,[])) throw new HttpError(404,'Entität nicht gefunden.');
    if(entity.version!==d.expectedVersion) throw new HttpError(409,'Entity wurde inzwischen geändert.');
    if(d.replacedBy && (d.replacedBy===d.id || !(await db.prepare('SELECT id FROM entities WHERE campaign_id=? AND id=?').bind(a.campaignId,d.replacedBy).first())))
      throw new HttpError(400,'Ungültige Nachfolger-Entity.');
    const result=await db.prepare('UPDATE entities SET canon_status=?,play_state=?,replaced_by=?,default_visibility=?,version=version+1,updated_at=? WHERE campaign_id=? AND id=? AND version=?')
      .bind(d.canonStatus??entity.canonStatus,d.playState===undefined?entity.playState??null:d.playState,d.replacedBy===undefined?entity.replacedBy??null:d.replacedBy,d.defaultVisibility??entity.defaultVisibility??null,new Date().toISOString(),a.campaignId,d.id,d.expectedVersion).run();
    if(!result.meta.changes) throw new HttpError(409,'Entity wurde inzwischen geändert.');
    return json({id:d.id,version:d.expectedVersion+1});
  } catch(e) { return failure(e,req); }
}
