import {actor,database,failure,HttpError,json} from '@/server/access';
import {isPlayerSafeCanon} from '@/domain/location-cms';
import {cmsPublisher,requireCmsPublisher,requireActivePlayer} from '@/server/location-cms-service';
import {visibleLocationLink,visibleLocationRelatedTarget} from '@/server/location-navigation';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
  const caller=await actor(),db=database(),p=new URL(req.url).searchParams;let a=caller;
  const viewerId=p.get('viewerId');if(viewerId){requireCmsPublisher(caller);await requireActivePlayer(db,caller.campaignId,viewerId);a={...caller,id:viewerId,gm:false,role:'player'};}
  const id=p.get('entityId');if(!id||id.length>160)throw new HttpError(400,'Ortseintrag fehlt.');const sl=p.get('view')==='sl'&&cmsPublisher(a);
  if(!await visibleLocationLink(db,a,id,sl))throw new HttpError(404,'Ortseintrag nicht gefunden.');
  if(p.get('candidates')==='1'){
    requireCmsPublisher(a);const rows=await db.prepare("SELECT e.id,e.title,e.canon_status,e.content,n.location_id,n.attributes,n.level FROM entities e LEFT JOIN location_nodes n ON n.campaign_id=e.campaign_id AND n.entity_id=e.id WHERE e.campaign_id=? AND (e.type='NPC' OR n.entity_id IS NOT NULL) AND e.id<>? ORDER BY e.title LIMIT 500").bind(a.campaignId,id).all<{id:string;title:string;attributes:string|null;level:string|null;location_id:string|null;canon_status:string;content:string}>();
    const parse=(value:string|null)=>{try{return JSON.parse(value||'{}');}catch{return {};}};const candidates=rows.results.filter(row=>isPlayerSafeCanon(row.canon_status,parse(row.content),parse(row.attributes))&&!['archived','deleted'].includes(String(parse(row.attributes).lifecycle))).map(row=>({id:row.id,title:String(parse(row.attributes).title||row.title),kind:row.level||'NSC',href:row.location_id?`/spielbereich?bereich=schauplaetze&ort=${encodeURIComponent(row.location_id)}&eintrag=${encodeURIComponent(row.id)}`:`/spielbereich?bereich=nscs&npc=${encodeURIComponent(row.id)}`}));return json({candidates});
  }
  const rows=await db.prepare(`SELECT id,source_id,target_id,type,note,visibility FROM relationships WHERE campaign_id=? AND (source_id=? OR target_id=?) AND type<>'location.contains' ${sl?'':"AND visibility='group'"} ORDER BY created_at,id`).bind(a.campaignId,id,id).all<{id:string;source_id:string;target_id:string;type:string;note:string|null;visibility:string}>();
  const relationships=[];for(const row of rows.results){const target=await visibleLocationRelatedTarget(db,a,row.source_id===id?row.target_id:row.source_id,sl);if(target)relationships.push({id:row.id,type:row.type,note:row.note,visibility:row.visibility,target});}
  return json({relationships});
}catch(error){return failure(error,req);}}
