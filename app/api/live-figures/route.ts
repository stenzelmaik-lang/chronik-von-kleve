import {z} from 'zod';
import {actor,sameOrigin,input,json,failure,HttpError} from '@/server/access';
import {listFigures,changeFigures,type FigureCommand} from '@/server/live-figures';
export const dynamic='force-dynamic';
// Standard figures are a GM tool: every path below ends in gmOnly(); players get 403/404, anonymous 401.
const session=z.object({sessionId:z.string().min(1).max(160)});
const tier=z.enum(['easy','standard','hard','very_hard','extreme']);
const patch=z.object({label:z.string().max(60).optional(),hurt:z.number().int().min(0).max(7).optional(),willpower:z.number().int().min(0).max(10).optional(),blood:z.number().int().min(0).max(30).optional(),note:z.string().max(2000).optional(),imageFileId:z.string().max(160).optional()}).strict();
const body=z.discriminatedUnion('action',[
 session.extend({action:z.literal('spawn'),requestId:z.string().uuid(),typeId:z.string().min(1).max(60),tierId:tier,count:z.number().int().min(1).max(10),templateId:z.string().uuid().optional(),imageFileId:z.string().max(160).optional()}).strict(),
 session.extend({action:z.literal('update'),id:z.string().uuid(),patch}).strict(),
 session.extend({action:z.literal('retire'),id:z.string().uuid()}).strict(),
 session.extend({action:z.literal('linkAsset'),typeId:z.string().min(1).max(60),tierId:tier.nullable(),fileId:z.string().min(1).max(160),label:z.string().max(80),role:z.enum(['fullbody','portrait','token','scene'])}).strict(),
 session.extend({action:z.literal('unlinkAsset'),assetId:z.string().uuid()}).strict(),
]);
export async function GET(req:Request){try{
 const a=await actor(),id=new URL(req.url).searchParams.get('sessionId');
 if(!id||id.length>160)throw new HttpError(400,'Sitzung fehlt.');
 return json(await listFigures(a,id));
}catch(e){return failure(e,req);}}
export async function POST(req:Request){try{
 sameOrigin(req);const a=await actor(),d=body.safeParse(await input(req));
 if(!d.success)throw new HttpError(400,'Ungültige Figurenänderung.');
 return json(await changeFigures(a,d.data as FigureCommand));
}catch(e){return failure(e,req);}}
