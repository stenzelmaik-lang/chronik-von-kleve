import { env } from "cloudflare:workers";
import { actor,database,failure,HttpError,json,sameOrigin } from "@/server/access";
import { isPlayerSafeCanon } from "@/domain/location-cms";
import { loadPersistedLocation } from "@/server/location-repository";
import { cmsPublisher,getLocationNode,requireCmsEditor,requireCmsPublisher,requireActivePlayer,requireCmsRevisionAudience } from "@/server/location-cms-service";
export const dynamic="force-dynamic";
type FileRow={id:string;campaign_id:string;owner_id:string;visibility:string;name:string;mime:string;size:number;key:string;created_at:string};
const imageTypes=["image/jpeg","image/png","image/webp"];

export async function POST(req:Request){
  try{
    sameOrigin(req);const a=await actor();requireCmsEditor(a);
    const length=Number(req.headers.get("content-length")||0);if(length>10*1024*1024+64*1024)throw new HttpError(413,"Bilder dürfen maximal 10 MB groß sein.");
    const form=await req.formData(),file=form.get("file");
    if(!(file instanceof File)||!imageTypes.includes(file.type)||file.size<1||file.size>10*1024*1024)throw new HttpError(400,"Wähle ein JPG-, PNG- oder WebP-Bild bis 10 MB.");
    const bytes=new Uint8Array(await file.arrayBuffer()),sig=String.fromCharCode(...bytes.slice(0,12));
    const valid=file.type==="image/png"?bytes[0]===137&&sig.slice(1,4)==="PNG":file.type==="image/jpeg"?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:sig.startsWith("RIFF")&&sig.slice(8)==="WEBP";
    if(!valid)throw new HttpError(400,"Dateiinhalte und Bildformat stimmen nicht überein.");
    if(!env.BUCKET)throw new HttpError(503,"Der private Bildspeicher ist nicht erreichbar.");
    const id=crypto.randomUUID(),key=`campaigns/${a.campaignId}/cms/${a.id}/${id}`,now=new Date().toISOString();
    try{await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:file.type,cacheControl:"private, no-store"}});}
    catch{throw new HttpError(503,"Der Bild-Upload zum privaten Medienspeicher ist fehlgeschlagen. Prüfe die lokale Testumgebung und versuche es erneut.");}
    try{await database().prepare("INSERT INTO files(id,campaign_id,owner_id,visibility,name,mime,size,key,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
      .bind(id,a.campaignId,a.id,"sl",file.name.replace(/[\\/\u0000-\u001f]/g,"_").slice(0,160)||"Ortsbild",file.type,file.size,key,now).run();}
    catch{
      try{await env.BUCKET.delete(key);}catch{ /* The object remains private and unaddressable without a files row. */ }
      throw new HttpError(503,"Das Bild liegt im privaten Speicher, konnte aber nicht dem Ortsbestand zugeordnet werden. Es wurde kein öffentlicher Bildlink erstellt. Bitte erneut versuchen.");
    }
    return json({id,name:file.name.slice(0,160),mime:file.type,size:file.size},201);
  }catch(error){return failure(error,req);}
}

export async function GET(req:Request){
  try{
    const a=await actor();const url=new URL(req.url),id=url.searchParams.get("id"),entityId=url.searchParams.get("entityId"),revisionId=url.searchParams.get("revisionId"),preview=url.searchParams.get("preview")==="1",candidate=url.searchParams.get("candidate")==="1";
    if(url.searchParams.get("library")==="1"){
      requireCmsEditor(a);
      if(!entityId||!revisionId)throw new HttpError(400,"Ortsentwurf fehlt.");
      await getLocationNode(database(),a,entityId);
      const revision=await database().prepare("SELECT audience_scope,audience_key,status FROM entity_revisions WHERE campaign_id=? AND entity_id=? AND id=?")
        .bind(a.campaignId,entityId,revisionId).first<{audience_scope:string;audience_key:string;status:string}>();
      if(!revision)throw new HttpError(404,"Entwurf nicht gefunden.");
      requireCmsRevisionAudience(a,revision.audience_scope,revision.audience_key);
      if(revision.status!=="draft")throw new HttpError(409,"Nur ein bearbeitbarer Entwurf kann Medien auswählen.");
      const result=await database().prepare(`SELECT id,name,mime,size FROM files WHERE campaign_id=? AND visibility='sl' AND mime IN ('image/jpeg','image/png','image/webp') AND (owner_id=? OR ?=1) ORDER BY created_at DESC LIMIT 100`)
        .bind(a.campaignId,a.id,cmsPublisher(a)?1:0).all<Pick<FileRow,"id"|"name"|"mime"|"size">>();
      return json({files:result.results});
    }
    if(!id||!entityId||!revisionId)throw new HttpError(404,"Bild nicht gefunden.");
    const db=database(),viewerId=url.searchParams.get("viewerId")||undefined;if(viewerId){requireCmsPublisher(a);await requireActivePlayer(db,a.campaignId,viewerId);}
    const node=await getLocationNode(db,a,entityId);
    const revision=await db.prepare("SELECT audience_scope,audience_key,status FROM entity_revisions WHERE campaign_id=? AND entity_id=? AND id=?")
      .bind(a.campaignId,entityId,revisionId).first<{audience_scope:string;audience_key:string;status:string}>();
    if(!revision)throw new HttpError(404,"Bild nicht gefunden.");
    if(preview){
      requireCmsEditor(a);
      requireCmsRevisionAudience(a,revision.audience_scope,revision.audience_key);
      if(candidate?revision.status!=="draft":!["draft","in_review","approved"].includes(revision.status))throw new HttpError(404,"Bild nicht gefunden.");
    }
    const [file,attachment]=await Promise.all([
      db.prepare("SELECT * FROM files WHERE campaign_id=? AND id=?").bind(a.campaignId,id).first<FileRow>(),
      db.prepare("SELECT id,audience_scope,audience_key FROM entity_revision_media WHERE campaign_id=? AND entity_id=? AND revision_id=? AND file_id=? AND purpose='hero'")
        .bind(a.campaignId,entityId,revisionId,id).first<{id:string;audience_scope:string;audience_key:string}>(),
    ]);
    const mayPreviewCandidate=preview&&candidate&&file&&file.visibility==="sl"&&(file.owner_id===a.id||cmsPublisher(a));
    if(!file||file.visibility!=="sl"||(!mayPreviewCandidate&&(!attachment||attachment.audience_scope!==revision.audience_scope||attachment.audience_key!==revision.audience_key))||
      !imageTypes.includes(file.mime)||!isPlayerSafeCanon(node.canon_status,JSON.parse(node.entity_content||"{}"),JSON.parse(node.attributes||"{}")))
      throw new HttpError(404,"Bild nicht gefunden.");
    if(!preview){
      const target=viewerId?"player":a.gm?"group":"player";
      const projection=await loadPersistedLocation(db,a,node.location_id,"player",target,{viewerId});
      const expected=`/api/cms/media?id=${encodeURIComponent(id)}&entityId=${encodeURIComponent(entityId)}&revisionId=${encodeURIComponent(revisionId)}${viewerId?"&viewerId="+encodeURIComponent(viewerId):""}`;
      const isReleasedRootImage=projection?.location.image===expected;
      const isReleasedAreaImage=projection?.location.areas.some(area=>!area.redacted&&area.image===expected)===true;
      if(!isReleasedRootImage&&!isReleasedAreaImage)throw new HttpError(404,"Bild nicht gefunden.");
    }
    if(!env.BUCKET)throw new HttpError(503,"Der private Bildspeicher ist nicht erreichbar.");
    const object=await env.BUCKET.get(file.key);if(!object)throw new HttpError(404,"Bild nicht gefunden.");
    return new Response(object.body,{headers:{"Content-Type":file.mime,"Content-Length":String(file.size),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox","Cross-Origin-Resource-Policy":"same-origin"}});
  }catch(error){return failure(error,req);}
}
