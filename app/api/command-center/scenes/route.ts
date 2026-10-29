import { actor, database, gmOnly, input, sameOrigin, json, failure, HttpError } from '@/server/access';
import { sceneCommandSchema } from '@/domain/story-scene';
import { readScene, listScenes, sceneHistory, executeScene, scenePlayerPreview } from '@/server/story-scenes';
import { deletePreparation, deletePreparationCommand } from '@/server/preparation-delete';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    const a = await actor(); gmOnly(a); const db = database(), q = new URL(req.url).searchParams;
    if (q.get('view') === 'player') return json({ scenes: await scenePlayerPreview(db, a, q.get('characterId') || undefined, q.get('sessionId') || undefined) });
    const id = q.get('id');
    return json(id ? { scene: await readScene(db, a, id), ...(q.get('history') === '1' ? { history: await sceneHistory(db, a, id) } : {}) } : { scenes: await listScenes(db, a) });
  } catch (e) { return failure(e, req); }
}
export async function POST(req: Request) {
  try { sameOrigin(req); const a = await actor(); gmOnly(a); const body = await input(req);
    if (body?.action === 'delete') { const p = deletePreparationCommand.safeParse(body); if (!p.success) throw new HttpError(400, p.error.issues[0].message); return json({ deleted: await deletePreparation(database(), a, 'scene', p.data.id, p.data.version) }); }
    const command = sceneCommandSchema.safeParse(body);
    if (!command.success) throw new HttpError(400, command.error.issues[0].message);
    return json({ scene: await executeScene(database(), a, command.data) }, command.data.action === 'create' ? 201 : 200);
  } catch (e) { return failure(e, req); }
}
