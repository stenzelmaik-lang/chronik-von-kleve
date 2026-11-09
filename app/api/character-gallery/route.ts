import {actor,json,failure,HttpError} from '@/server/access';
import {campaignGallery,campaignGalleryImage} from '@/server/character-gallery';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const a=await actor(),q=new URL(req.url).searchParams,characterId=q.get('characterId'),fileId=q.get('fileId');
 if(characterId||fileId){
  if(!characterId||!fileId||characterId.length>160||fileId.length>160)throw new HttpError(400,'Charakter und Bild wählen.');
  return await campaignGalleryImage(a,characterId,fileId);
 }
 return json(await campaignGallery(a));
}catch(e){return failure(e,req);}}
