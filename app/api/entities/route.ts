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
import { entityTypeSchema, canonStatusSchema } from "@/domain/types";
import { loadEntities, grantsFor, projectEntity } from "@/server/entities";
import { characterKnowledgeContext } from '@/server/character-knowledge';
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const a = await actor(),
      id = new URL(req.url).searchParams.get("id") || undefined,
      db = database();
    const characterId = new URL(req.url).searchParams.get('characterId');
    const character = characterId ? await characterKnowledgeContext(db, a, characterId) : undefined;
    const [entities, grants] = await Promise.all([
      loadEntities(db, a.campaignId, id),
      grantsFor(db, a, character),
    ]);
    const result = entities
      .map((e) => projectEntity(a, e, grants, character))
      .filter((e) => e !== null);
    if (id && !result.length)
      throw new HttpError(404, "Entität nicht gefunden.");
    return json({ entities: result });
  } catch (e) {
    return failure(e, req);
  }
}
// Minimal authoring path for the security foundation, not a second CMS.
const schema = z
  .object({
    type: entityTypeSchema,
    canonStatus: canonStatusSchema.default("WORKING"),
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
    await db.batch([
      db
        .prepare(
          "INSERT INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,title,content,gm_body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          a.campaignId,
          d.type,
          d.canonStatus,
          a.id,
          "sl",
          d.title,
          JSON.stringify({ text: d.text }),
          d.gmBody,
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
