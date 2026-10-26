import {env} from 'cloudflare:workers';
import {actor,database,failure,HttpError} from '@/server/access';
import {getLocationNode,requireCmsPublisher,requireActivePlayer} from '@/server/location-cms-service';
import {loadPersistedLocation} from '@/server/location-repository';
import {LOCATION_MEDIA_KIND,parseLocationItemContent} from '@/domain/location-library';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
  const a=await actor(),p=new URL(req.url).searchParams,id=p.get('id'),preview=p.get('preview')==='1';if(!id||id.length>200)throw new HttpError(404,'Unterlage nicht gefunden.');
  if(preview)requireCmsPublisher(a);
  const db=database(),viewerId=p.get('viewerId')||undefined;if(viewerId){requireCmsPublisher(a);await requireActivePlayer(db,a.campaignId,viewerId);}
  const block=await db.prepare("SELECT entity_id,kind,content FROM entity_content_blocks WHERE campaign_id=? AND id=? AND kind=? AND visibility='sl_secret'").bind(a.campaignId,id,LOCATION_MEDIA_KIND).first<{entity_id:string;kind:string;content:string}>();
  const data=block&&parseLocationItemContent(block.content,block.kind)?.data;
  if(!block||!data||!('fileId' in data)||data.state!=='active')throw new HttpError(404,'Unterlage nicht gefunden.');
  const node=await getLocationNode(db,a,block.entity_id);
  if(!preview){
    if(!data.playerReleased||data.mediaType==='sl_plan')throw new HttpError(404,'Unterlage nicht gefunden.');
    const projection=await loadPersistedLocation(db,a,node.location_id,'player',viewerId?'player':a.gm?'group':'player',{viewerId});
    const location=projection?.location;
    const visible=location&&[...(location.media||[]),...location.areas.flatMap(area=>[...(area.media||[]),...area.rooms.flatMap(room=>room.media||[])]),...location.knownInformation.flatMap(info=>info.media||[])].some(media=>media.id===id);
    if(!visible)throw new HttpError(404,'Unterlage nicht gefunden.');
  }
  const file=await db.prepare("SELECT key,mime,size FROM files WHERE campaign_id=? AND id=? AND visibility='sl'").bind(a.campaignId,data.fileId).first<{key:string;mime:string;size:number}>();
  if(!file||!['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.mime)||!env.BUCKET)throw new HttpError(404,'Unterlage nicht gefunden.');
  const range=req.headers.get('range');if(range&&!/^bytes=\d+-\d*$/.test(range))throw new HttpError(416,'Ungültiger Seitenausschnitt.');
  if(range){const [start,end]=range.slice(6).split('-').map(Number);if(start>=file.size||(range.split('-')[1]&&end<start))throw new HttpError(416,'Ungültiger Seitenausschnitt.');}
  const object=await env.BUCKET.get(file.key,range?{range:req.headers}:undefined);if(!object)throw new HttpError(404,'Unterlage nicht gefunden.');
  const headers=new Headers({'Content-Type':file.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Cross-Origin-Resource-Policy':'same-origin','Accept-Ranges':'bytes'});
  if(range&&object.range&&'offset' in object.range){const offset=object.range.offset||0,length=object.range.length||file.size-offset;headers.set('Content-Range',`bytes ${offset}-${offset+length-1}/${file.size}`);headers.set('Content-Length',String(length));return new Response(object.body,{status:206,headers});}
  headers.set('Content-Length',String(file.size));return new Response(object.body,{headers});
}catch(error){return failure(error,req);}}
