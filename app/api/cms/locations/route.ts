import { z } from "zod";
import { actor,database,failure,HttpError,json } from "@/server/access";
import { isPlayerSafeCanon } from "@/domain/location-cms";
import { cmsPublisher, getLocationNode, requireCmsEditor } from "@/server/location-cms-service";

export const dynamic="force-dynamic";
const query=z.object({place:z.string().trim().min(1).max(160).optional()}).strict();
type CmsNode={entity_id:string;location_id:string;parent_id:string|null;level:"location"|"area"|"room"|"information";position:number;attributes:string;canon_status:string;content:string;title:string};
const parse=(raw:string)=>{try{const x:unknown=JSON.parse(raw);return x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:{};}catch{return {};}};

export async function GET(req:Request){
  try{
    const a=await actor();requireCmsEditor(a);const params=query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if(!params.success)throw new HttpError(400,"Ungültige Ortsauswahl.");
    const db=database();
    if(!params.data.place){
      const roots=await db.prepare(`SELECT n.entity_id,e.title,n.attributes,n.position,e.canon_status,e.content FROM location_nodes n JOIN entities e ON e.campaign_id=n.campaign_id AND e.id=n.entity_id
        WHERE n.campaign_id=? AND n.level='location' AND n.parent_id IS NULL AND n.location_id=n.entity_id ORDER BY n.position,n.entity_id`).bind(a.campaignId).all<{entity_id:string;title:string;attributes:string;position:number;canon_status:string;content:string}>();
      const players=cmsPublisher(a)?await db.prepare(`SELECT cm.user_id AS id,m.name FROM campaign_memberships cm JOIN members m ON m.campaign_id=cm.campaign_id AND m.id=cm.user_id
        WHERE cm.campaign_id=? AND cm.role='player' AND cm.status='active' ORDER BY m.name,cm.user_id`).bind(a.campaignId).all<{id:string;name:string}>():{results:[]};
      return json({locations:roots.results.filter(row=>isPlayerSafeCanon(row.canon_status,parse(row.content),parse(row.attributes))).map(row=>({id:row.entity_id,title:String(parse(row.attributes).title||row.title||""),position:row.position})),players:players.results});
    }
    const root=await getLocationNode(db,a,params.data.place);
    if(root.level!=="location"||root.location_id!==root.entity_id)throw new HttpError(404,"Ort nicht gefunden.");
    const rows=await db.prepare(`SELECT n.entity_id,n.location_id,n.parent_id,n.level,n.position,n.attributes,e.canon_status,e.content,e.title
      FROM location_nodes n JOIN entities e ON e.campaign_id=n.campaign_id AND e.id=n.entity_id
      WHERE n.campaign_id=? AND n.location_id=? ORDER BY n.position,n.entity_id`).bind(a.campaignId,root.entity_id).all<CmsNode>();
    const safe=rows.results.filter(row=>isPlayerSafeCanon(row.canon_status,parse(row.content),parse(row.attributes)));
    const byId=new Map(safe.map(row=>[row.entity_id,row]));
    const visible=safe.filter(row=>{
      let parent=row.parent_id;let seen=0;
      while(parent){if(++seen>16)return false;const p=byId.get(parent);if(!p)return false;parent=p.parent_id;}
      return true;
    });
    return json({location:{id:root.entity_id,title:String(parse(root.attributes).title||root.entity_title||"")},nodes:visible.map(row=>({id:row.entity_id,locationId:row.location_id,parentId:row.parent_id,level:row.level,position:row.position,title:String(parse(row.attributes).title||row.title||"")}))});
  }catch(error){return failure(error,req);}
}
