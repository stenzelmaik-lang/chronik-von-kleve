import {z} from 'zod';
import {actor,sameOrigin,input,json,failure,HttpError} from '@/server/access';
import {vitalsCommandSchema,tableCommandSchema} from '@/domain/character-vitals';
import {stageRoom,stageSnapshot} from '@/server/live-stage';
import {changeCharacterVitals,changeTableVitals,nightForAll,willpowerForAll} from '@/server/live-vitals';
export const dynamic='force-dynamic';
// Every change is checked here against the role, the table membership and the control profile.
const envelope=z.object({sessionId:z.string().min(1).max(160),runId:z.string().uuid()}).strict();
const body=z.union([
 envelope.extend({characterId:z.string().min(1).max(160),command:vitalsCommandSchema}).strict(),
 envelope.extend({expectedVersion:z.number().int().nonnegative(),table:tableCommandSchema}).strict(),
 envelope.extend({group:z.enum(['night','willpower'])}).strict(),
]);
export async function POST(req:Request){try{
 sameOrigin(req);const a=await actor(),d=body.safeParse(await input(req));if(!d.success)throw new HttpError(400,'Ungültige Zustandsänderung.');
 const {room}=await stageRoom(a,d.data.sessionId);if(room.runId!==d.data.runId)throw new HttpError(409,'Der Spielabend wurde neu gestartet. Bitte aktualisieren.');
 let message='';
 if('command' in d.data)message=await changeCharacterVitals(a,room,d.data.characterId,d.data.command);
 else if('table' in d.data)await changeTableVitals(a,room,d.data.expectedVersion,d.data.table);
 else message=(d.data.group==='night'?await nightForAll(a,room):await willpowerForAll(a,room)).join(' · ');
 return json({...await stageSnapshot(a,d.data.sessionId),message});
}catch(e){return failure(e,req);}}
