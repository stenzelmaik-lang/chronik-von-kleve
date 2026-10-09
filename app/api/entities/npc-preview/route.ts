import {actor,gmOnly,database,json,failure,HttpError} from '@/server/access';
import {readNPCPlayerPreview} from '@/server/npc-player-preview';
export const dynamic='force-dynamic';
export async function GET(req:Request){
  try{
    const a=await actor();gmOnly(a);
    const id=new URL(req.url).searchParams.get('id');
    if(!id||id.length>200)throw new HttpError(400,'Ungültige NPC-ID.');
    return json(await readNPCPlayerPreview(database(),a,id));
  }catch(e){return failure(e,req);}
}
