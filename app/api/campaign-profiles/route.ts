import {actor,failure,HttpError,json} from '@/server/access';
import {participantAvatar,participantFigureImage,participantView} from '@/server/live-participants';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 try{
  const a=await actor(),q=new URL(req.url).searchParams;
  const memberId=q.get('memberId'),characterId=q.get('characterId'),fileId=q.get('fileId'),view=q.get('view')??'profile';
  if(!memberId||[memberId,characterId,fileId].some(id=>id&&id.length>160))throw new HttpError(400,'Teilnehmer oder Bild ungültig.');
  if(view==='avatar')return await participantAvatar(a,null,memberId);
  if(view==='figure-image'&&characterId&&fileId)return await participantFigureImage(a,null,memberId,characterId,fileId);
  return json(await participantView(a,null,memberId,view,characterId??undefined));
 }catch(error){return failure(error,req);}
}
