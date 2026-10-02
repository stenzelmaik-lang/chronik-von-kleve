import { z } from 'zod';
import { actor, database, gmOnly, input, sameOrigin, json, failure, HttpError } from '@/server/access';
import { workspaceModes, workspaceSchema } from '@/domain/command-workspace';
import { readWorkspace, saveWorkspace } from '@/server/command-workspace';
export const dynamic = 'force-dynamic';
const scope = z.object({ mode: z.enum(workspaceModes).default('live'), windowRole: z.enum(['main', 'companion']).default('main') });
const save = scope.extend({ version: z.number().int().min(0), workspace: workspaceSchema }).strict();
export async function GET(req: Request) {
  try { const a = await actor(); gmOnly(a); const query = new URL(req.url).searchParams, p = scope.safeParse({ mode: query.get('mode') || 'live', windowRole: query.get('windowRole') || 'main' }); if (!p.success) throw new HttpError(400, 'Unbekannte Arbeitsfläche.'); return json(await readWorkspace(database(), a, p.data.mode, p.data.windowRole)); }
  catch (e) { return failure(e, req); }
}
export async function POST(req: Request) {
  try { sameOrigin(req); const a = await actor(); gmOnly(a); const p = save.safeParse(await input(req)); if (!p.success) throw new HttpError(400, p.error.issues[0].message); return json(await saveWorkspace(database(), a, p.data.mode, p.data.windowRole, p.data.version, p.data.workspace)); }
  catch (e) { return failure(e, req); }
}
