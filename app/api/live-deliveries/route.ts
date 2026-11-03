import {z} from 'zod';
import {actor,sameOrigin,input,json,failure,HttpError} from '@/server/access';
import {listDeliveries,changeDeliveries,type DeliveryCommand} from '@/server/live-deliveries';
import {sceneWhisperSchema} from '@/domain/story-scene';
export const dynamic='force-dynamic';
// Triggering and withdrawing are GM only; "seen" and "ack" only change the caller's own receipt of a delivery addressed to them.
const session=z.object({sessionId:z.string().min(1).max(160)});
const recipients=z.discriminatedUnion('mode',[
 z.object({mode:z.literal('prepared')}).strict(),
 z.object({mode:z.literal('all')}).strict(),
 z.object({mode:z.literal('players'),playerIds:z.array(z.string().min(1).max(160)).min(1).max(30)}).strict(),
]);
const body=z.discriminatedUnion('action',[
 session.extend({action:z.literal('deliver'),requestId:z.string().uuid(),sceneId:z.string().min(1).max(160),whisperId:z.string().uuid(),sceneVersion:z.number().int().positive().optional(),recipients}).strict(),
 // spontaneous from the Regie: the full entry is checked like a prepared one; `save` keeps it in the scene
 session.extend({action:z.literal('compose'),requestId:z.string().uuid(),sceneId:z.string().min(1).max(160),entry:sceneWhisperSchema,recipients,save:z.boolean()}).strict(),
 session.extend({action:z.literal('save-entry'),sceneId:z.string().min(1).max(160),entry:sceneWhisperSchema}).strict(),
 session.extend({action:z.literal('withdraw'),runId:z.string().uuid()}).strict(),
 session.extend({action:z.literal('seen'),runId:z.string().uuid()}).strict(),
 session.extend({action:z.literal('ack'),runId:z.string().uuid()}).strict(),
]);
export async function GET(req:Request){try{
 const a=await actor(),id=new URL(req.url).searchParams.get('sessionId');
 if(!id||id.length>160)throw new HttpError(400,'Sitzung fehlt.');
 return json(await listDeliveries(a,id));
}catch(e){return failure(e,req);}}
export async function POST(req:Request){try{
 sameOrigin(req);const a=await actor(),d=body.safeParse(await input(req));
 if(!d.success)throw new HttpError(400,'Ungültige Zustellung.');
 return json(await changeDeliveries(a,d.data as DeliveryCommand));
}catch(e){return failure(e,req);}}
