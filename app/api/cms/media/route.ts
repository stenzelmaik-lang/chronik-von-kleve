import { env } from "cloudflare:workers";
import { actor,database,failure,HttpError,json,sameOrigin } from "@/server/access";
import { isPlayerSafeCanon } from "@/domain/location-cms";
import { loadPersistedLocation } from "@/server/location-repository";
import { getLocationNode,requireCmsEditor,requireCmsPublisher } from "@/server/location-cms-service";
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
    await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:file.type,cacheControl:"private, no-store"}});
    try{await database().prepare("INSERT INTO files(id,campaign_id,owner_id,visibility,name,mime,size,key,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
      .bind(id,a.campaignId,a.id,"sl",file.name.replace(/[\\/\u0000-\u001f]/g,"_").slice(0,160)||"Ortsbild",file.type,file.size,key,now).run();}
    catch(error){await env.BUCKET.delete(key);throw error;}
    return json({id,name:file.name.slice(0,160),mime:file.type,size:file.size},201);
  }catch(error){return failure(error,req);}
}

export async function GET(req:Request){
  try{
    const a=await actor();const url=new URL(req.url),id=url.searchParams.get("id"),entityId=url.searchParams.get("entityId"),revisionId=url.searchParams.get("revisionId"),preview=url.searchParams.get("preview")==="1";
    if(!id||!entityId||!revisionId)throw new HttpError(404,"Bild nicht gefunden.");
    const db=database();const node=await getLocationNode(db,a,entityId);
    const [file,revision,attachment]=await Promise.all([
      db.prepare("SELECT * FROM files WHERE campaign_id=? AND id=?").bind(a.campaignId,id).first<FileRow>(),
      db.prepare("SELECT audience_scope,audience_key,status FROM entity_revisions WHERE campaign_id=? AND entity_id=? AND id=?").bind(a.campaignId,entityId,revisionId).first<{audience_scope:string;audience_key:string;status:string}>(),
      db.prepare("SELECT id FROM entity_revision_media WHERE campaign_id=? AND entity_id=? AND revision_id=? AND file_id=? AND purpose='hero'").bind(a.campaignId,entityId,revisionId,id).first(),
    ]);
    if(!file||!revision||!attachment||!imageTypes.includes(file.mime)||!isPlayerSafeCanon(node.canon_status,JSON.parse(node.entity_content||"{}"),JSON.parse(node.attributes||"{}")))throw new HttpError(404,"Bild nicht gefunden.");
    if(preview){
      requireCmsEditor(a);
      if(revision.audience_scope==="gm")requireCmsPublisher(a);
      if(!["draft","in_review","approved"].includes(revision.status))throw new HttpError(404,"Bild nicht gefunden.");
    }else{
      const target=a.gm?"group":"player";
      const projection=await loadPersistedLocation(db,a,node.location_id,"player",target);
      const expected=`/api/cms/media?id=${encodeURIComponent(id)}&entityId=${encodeURIComponent(entityId)}&revisionId=${encodeURIComponent(revisionId)}`;
      if(projection?.location.image!==expected)throw new HttpError(404,"Bild nicht gefunden.");
    }
    if(!env.BUCKET)throw new HttpError(503,"Der private Bildspeicher ist nicht erreichbar.");
    const object=await env.BUCKET.get(file.key);if(!object)throw new HttpError(404,"Bild nicht gefunden.");
    return new Response(object.body,{headers:{"Content-Type":file.mime,"Content-Length":String(file.size),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox","Cross-Origin-Resource-Policy":"same-origin"}});
  }catch(error){return failure(error,req);}
}
