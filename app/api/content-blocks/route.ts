import { actor, database, sameOrigin, input, json, failure, HttpError } from '@/server/access';
import { ContentBlockError, readContentBlocks, writeContentBlock, deleteContentBlock } from '@/server/content-blocks';
import { contentBlockInputSchema } from '@/domain/content-blocks';
import { z } from 'zod';
import { readViewer } from '@/server/read-view';

export const dynamic = 'force-dynamic';
const identity = z.object({entityId:z.string().trim().min(1).max(200),id:z.string().trim().min(1).max(200)}).strict();
const update = contentBlockInputSchema.extend({id:identity.shape.id});
const fail = (e: unknown, req: Request) => failure(e instanceof ContentBlockError ? new HttpError(e.status,e.message) : e, req);
export async function GET(req: Request) {
  try {
    const q=new URL(req.url).searchParams, entityId=q.get('entityId'), id=q.get('id');
    if (!entityId || entityId.length>200 || (id!==null && (!id || id.length>200))) throw new HttpError(400,'Entität oder Block-ID ungültig.');
    return json({blocks:await readContentBlocks(database(),readViewer(await actor(),q.get('view')),entityId,id??undefined)});
  } catch(e) { return fail(e,req); }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const a=await actor(), parsed=contentBlockInputSchema.safeParse(await input(req));
    if (!parsed.success) throw new HttpError(400,'Ungültiger Inhaltsblock.');
    return json({block:await writeContentBlock(database(),a,parsed.data)},201);
  } catch(e) { return fail(e,req); }
}
export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    const a=await actor(), parsed=update.safeParse(await input(req));
    if (!parsed.success) throw new HttpError(400,'Ungültiger Inhaltsblock.');
    const {id,...data}=parsed.data;
    return json({block:await writeContentBlock(database(),a,data,id)});
  } catch(e) { return fail(e,req); }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const a=await actor(), parsed=identity.safeParse(await input(req));
    if (!parsed.success) throw new HttpError(400,'Ungültige Block-ID.');
    await deleteContentBlock(database(),a,parsed.data.entityId,parsed.data.id);
    return json({deleted:true});
  } catch(e) { return fail(e,req); }
}
