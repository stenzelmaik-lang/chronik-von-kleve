import {z} from 'zod';
import {actor,sameOrigin,input,json,failure,HttpError} from '@/server/access';
import {stageCommandSchema} from '@/domain/live-stage';
import {stageSnapshot,stageMutation} from '@/server/live-stage';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const a=await actor(),id=new URL(req.url).searchParams.get('sessionId');if(!id||id.length>160)throw new HttpError(400,'Sitzung fehlt.');return json(await stageSnapshot(a,id,new URL(req.url).searchParams.get('catalog')==='1'));}catch(e){return failure(e,req);}}
const envelope=z.object({sessionId:z.string().min(1).max(160),runId:z.string().uuid(),expectedVersion:z.number().int().nonnegative(),command:stageCommandSchema}).strict();
export async function POST(req:Request){try{sameOrigin(req);const a=await actor(),d=envelope.safeParse(await input(req));if(!d.success)throw new HttpError(400,'Ungültiger Bühnenbefehl.');await stageMutation(a,d.data.sessionId,d.data.runId,d.data.expectedVersion,d.data.command);return json(await stageSnapshot(a,d.data.sessionId));}catch(e){return failure(e,req);}}
