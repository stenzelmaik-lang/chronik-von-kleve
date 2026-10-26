import {z} from 'zod';
import {actor,database,failure,HttpError,input,json,sameOrigin} from '@/server/access';
import {initializeLocationChapters,readLocationLibrary,writeLocationLibrary} from '@/server/location-library';
export const dynamic='force-dynamic';
const id=z.string().min(1).max(200);
const write=z.object({entityId:id,kind:z.enum(['chapter','media']),id:id.optional(),expectedVersion:z.number().int().min(0),position:z.number().int().min(0).max(2147483647),data:z.unknown(),action:z.enum(['save','restore_version']).optional(),eventId:z.string().uuid().optional()}).strict();
const initialize=z.object({action:z.enum(['initialize','adopt']),entityId:id,expectedLegacyVersion:z.number().int().min(0).optional()}).strict();
export async function GET(req:Request){try{
  const p=new URL(req.url).searchParams,entityId=p.get('entityId');if(!entityId||entityId.length>200)throw new HttpError(400,'Ortseintrag fehlt.');
  return json(await readLocationLibrary(database(),await actor(),entityId,{id:p.get('id')||undefined,full:p.get('full')==='1',history:p.get('history')==='1',archived:p.get('archived')==='1',q:p.get('q')?.slice(0,160)}));
}catch(error){return failure(error,req);}}
export async function POST(req:Request){try{sameOrigin(req);const a=await actor(),raw=await input(req),init=initialize.safeParse(raw);
  if(init.success)return json(await initializeLocationChapters(database(),a,init.data.entityId,init.data.action==='adopt',init.data.expectedLegacyVersion),201);
  const data=write.safeParse(raw);if(!data.success)throw new HttpError(400,'Ungültige Ortsinhalte.');if(data.data.id)throw new HttpError(400,'Zum Bearbeiten PATCH verwenden.');
  return json({item:await writeLocationLibrary(database(),a,data.data)},201);
}catch(error){return failure(error,req);}}
export async function PATCH(req:Request){try{sameOrigin(req);const a=await actor(),data=write.safeParse(await input(req));if(!data.success||!data.data.id)throw new HttpError(400,'Inhalts-ID und aktueller Versionsstand fehlen.');
  return json({item:await writeLocationLibrary(database(),a,data.data)});
}catch(error){return failure(error,req);}}
