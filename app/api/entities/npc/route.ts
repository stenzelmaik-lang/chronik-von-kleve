import {actor,gmOnly,database,sameOrigin,input,json,failure,HttpError} from '@/server/access';
import {readNPCDraft,saveNPC,NPCAuthoringError} from '@/server/npc-authoring';
import {npcSaveSchema} from '@/domain/npc-authoring';
export const dynamic='force-dynamic';
const fail=(e:unknown,req:Request)=>failure(e instanceof NPCAuthoringError?new HttpError(e.status,e.message):e,req);
export async function GET(req:Request){
  try{const a=await actor();gmOnly(a);const id=new URL(req.url).searchParams.get('id');if(!id||id.length>200)throw new HttpError(400,'Ungültige NPC-ID.');return json(await readNPCDraft(database(),a,id));}catch(e){return fail(e,req);}
}
export async function POST(req:Request){
  try{sameOrigin(req);const a=await actor();gmOnly(a);const data=npcSaveSchema.safeParse(await input(req));if(!data.success)throw new HttpError(400,'Ungültige NPC-Akte.');return json(await saveNPC(database(),a,data.data));}catch(e){return fail(e,req);}
}
