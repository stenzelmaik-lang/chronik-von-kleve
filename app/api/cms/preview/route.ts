import { z } from "zod";
import { actor,database,failure,HttpError,input,json,sameOrigin } from "@/server/access";
import { loadPersistedLocation } from "@/server/location-repository";
import { getLocationNode,requireActivePlayer,requireCmsEditor,requireCmsRevisionAudience } from "@/server/location-cms-service";
export const dynamic="force-dynamic";
const schema=z.object({revisionId:z.string().uuid(),viewerId:z.string().min(1).max(180).optional()}).strict();
export async function POST(req:Request){
  try{
    sameOrigin(req);const a=await actor();requireCmsEditor(a);const parsed=schema.safeParse(await input(req));if(!parsed.success)throw new HttpError(400,"Ungültige Vorschau.");
    const db=database();const revision=await db.prepare(`SELECT id,entity_id,audience_scope,audience_key,audience_user_id,status FROM entity_revisions WHERE id=? AND campaign_id=?`)
      .bind(parsed.data.revisionId,a.campaignId).first<{id:string;entity_id:string;audience_scope:string;audience_key:string;audience_user_id:string|null;status:string}>();
    if(!revision||!(["draft","in_review","approved"].includes(revision.status)))throw new HttpError(404,"Entwurf nicht gefunden.");
    requireCmsRevisionAudience(a,revision.audience_scope,revision.audience_key);
    if(revision.audience_scope==="gm")throw new HttpError(403,"GM-Geheimnisse erhalten keine Spieler-Vorschau.");
    const node=await getLocationNode(db,a,revision.entity_id);
    let viewerId=parsed.data.viewerId||a.id;let target:"group"|"player"="group";
    if(revision.audience_scope==="player"){
      if(!revision.audience_user_id || (parsed.data.viewerId && parsed.data.viewerId!==revision.audience_user_id))throw new HttpError(403,"Die Vorschau darf nicht auf eine andere Person umgeleitet werden.");
      await requireActivePlayer(db,a.campaignId,revision.audience_user_id);viewerId=revision.audience_user_id;target="player";
    }else if(revision.audience_scope==="group"){
      if(parsed.data.viewerId && parsed.data.viewerId!==a.id){await requireActivePlayer(db,a.campaignId,parsed.data.viewerId);viewerId=parsed.data.viewerId;}
      target="group";
    }else target="player";
    const projection=await loadPersistedLocation(db,a,node.location_id,"player",target,{viewerId,preview:{entityId:revision.entity_id,revisionId:revision.id,scope:revision.audience_scope as "public"|"group"|"player",key:revision.audience_key,discoveryState:revision.audience_scope==="public"?undefined:"known"}});
    if(!projection)throw new HttpError(404,"Für dieses Ziel ist keine Vorschau verfügbar.");
    return json({projection,preview:{scope:revision.audience_scope,viewerId}});
  }catch(error){return failure(error,req);}
}
