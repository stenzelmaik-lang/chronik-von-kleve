import { z } from 'zod';
import { actor,database,sameOrigin,input,json,failure,HttpError } from '@/server/access';
import { relationshipInputSchema } from '@/domain/relationships';
import { RelationshipError,createRelationship,readRelationships,deleteRelationship } from '@/server/relationships';
import { readViewer } from '@/server/read-view';

export const dynamic='force-dynamic';
const idSchema=z.string().trim().min(1).max(200);
const fail=(e:unknown,req:Request)=>failure(e instanceof RelationshipError?new HttpError(e.status,e.message):e,req);
export async function GET(req:Request) {
  try {
    const q=new URL(req.url).searchParams,entity=idSchema.safeParse(q.get('entityId')),id=q.get('id');
    if(!entity.success || (id!==null && !idSchema.safeParse(id).success)) throw new HttpError(400,'Ungültige ID.');
    return json({relationships:await readRelationships(database(),readViewer(await actor(),q.get('view')),entity.data,id??undefined)});
  } catch(e) { return fail(e,req); }
}
export async function POST(req:Request) {
  try {
    sameOrigin(req);
    const a=await actor(),parsed=relationshipInputSchema.safeParse(await input(req));
    if(!parsed.success) throw new HttpError(400,'Ungültige Beziehung.');
    return json({relationship:await createRelationship(database(),a,parsed.data)},201);
  } catch(e) { return fail(e,req); }
}
export async function DELETE(req:Request) {
  try {
    sameOrigin(req);
    const a=await actor(),parsed=z.object({id:idSchema}).strict().safeParse(await input(req));
    if(!parsed.success) throw new HttpError(400,'Ungültige ID.');
    await deleteRelationship(database(),a,parsed.data.id);
    return json({deleted:true});
  } catch(e) { return fail(e,req); }
}
