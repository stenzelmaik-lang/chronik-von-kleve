import { z } from 'zod';
import { actor, database, gmOnly, input, sameOrigin, json, failure, HttpError } from '@/server/access';
import { storyDocumentSchema } from '@/domain/command-workspace';
import { listStories, readStory, storyHistory, writeStory } from '@/server/command-workspace';
import { deletePreparation, deletePreparationCommand } from '@/server/preparation-delete';
export const dynamic = 'force-dynamic';
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), clientRequestId: z.string().uuid(), document: storyDocumentSchema }).strict(),
  z.object({ action: z.literal('save'), id: z.string().min(1).max(100), version: z.number().int().min(1), document: storyDocumentSchema }).strict(),
  z.object({ action: z.literal('restore'), id: z.string().min(1).max(100), version: z.number().int().min(1), historyId: z.string().uuid() }).strict(),
]);
export async function GET(req: Request) {
  try { const a = await actor(); gmOnly(a); const db = database(), q = new URL(req.url).searchParams, id = q.get('id'); if (!id) return json({ stories: await listStories(db, a) }); return json({ story: await readStory(db, a, id), ...(q.get('history') === '1' ? { history: await storyHistory(db, a, id) } : {}) }); }
  catch (e) { return failure(e, req); }
}
export async function POST(req: Request) {
  try { sameOrigin(req); const a = await actor(); gmOnly(a); const body = await input(req), db = database();
    if (body?.action === 'delete') { const p = deletePreparationCommand.safeParse(body); if (!p.success) throw new HttpError(400, p.error.issues[0].message); return json({ deleted: await deletePreparation(db, a, 'story', p.data.id, p.data.version) }); }
    const p = actionSchema.safeParse(body); if (!p.success) throw new HttpError(400, p.error.issues[0].message); const d = p.data;
    if (d.action === 'create') return json({ story: await writeStory(db, a, { id: 'plot-' + d.clientRequestId, version: 0, document: d.document, create: true }) }, 201);
    if (d.action === 'restore') { const historic = (await storyHistory(db, a, d.id)).find(h => h.id === d.historyId); if (!historic) throw new HttpError(404, 'Historischer Stand nicht verfügbar.'); return json({ story: await writeStory(db, a, { id: d.id, version: d.version, document: historic.document, restored: true }) }); }
    return json({ story: await writeStory(db, a, d) });
  } catch (e) { return failure(e, req); }
}
