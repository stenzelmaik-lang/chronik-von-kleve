import {database,gmOnly,canRead,HttpError,type Actor} from './access';
import type {LegacyRecordRow} from '@/domain/legacy';
import {displayAssetContext,displayAssetSchema,materialTypeInfo,mimeFits,type DisplayAsset} from '@/domain/material-system';
import type {SceneElement} from '@/domain/story-scene';

/**
 * Display assets (Darstellungs-Assets) are GM records in the existing records table: name, kind and one existing
 * file per state. Materials only reference the asset id, so the same envelope image is stored once and reused.
 * Visibility 'sl' keeps them with the GMs of the campaign; players never list or read them.
 */
const where="campaign_id=? AND kind='notizen' AND visibility='sl' AND json_valid(body) AND json_extract(body,'$.context')=?";
function asset(row:LegacyRecordRow):DisplayAsset{
 const body=JSON.parse(row.body);
 const d=displayAssetSchema.safeParse({title:row.title,kind:body.assetKind,states:body.states,tags:body.tags||[]});
 if(!d.success)throw new HttpError(409,'Diese Darstellung hat ein nicht unterstütztes Format. Sie bleibt unverändert.');
 return {...d.data,id:row.id,version:row.version,ownerId:row.owner_id,updatedAt:row.updated_at};
}
export async function listDisplayAssets(a:Actor){
 gmOnly(a);
 const rows=await database().prepare(`SELECT * FROM records WHERE ${where} ORDER BY updated_at DESC,id`).bind(a.campaignId,displayAssetContext).all<LegacyRecordRow>();
 return rows.results.flatMap(row=>{try{return [asset(row)];}catch{return [];}});
}
export async function readDisplayAsset(a:Actor,id:string){
 gmOnly(a);
 const row=await database().prepare(`SELECT * FROM records WHERE id=? AND ${where}`).bind(id,a.campaignId,displayAssetContext).first<LegacyRecordRow>();
 if(!row)throw new HttpError(404,'Darstellung nicht gefunden.');return asset(row);
}
/** Asset states for the stage; a missing or damaged asset simply yields no states (the material falls back). */
export async function displayAssetStates(a:Actor,id:string){
 if(!id)return null;
 try{return await readDisplayAsset(a,id);}catch{return null;}
}
async function checkImage(db:D1Database,a:Actor,fileId:string){
 const f=await db.prepare('SELECT owner_id,visibility,mime FROM files WHERE id=? AND campaign_id=?').bind(fileId,a.campaignId).first<{owner_id:string;visibility:string;mime:string}>();
 if(!f||!canRead(a,f))throw new HttpError(404,'Eine Datei der Darstellung ist nicht verfügbar.');
 if(!f.mime.startsWith('image/'))throw new HttpError(400,'Darstellungszustände müssen Bilder sein.');
}
export async function saveDisplayAsset(a:Actor,value:unknown,id?:string,version?:number){
 gmOnly(a);
 const parsed=displayAssetSchema.safeParse(value);if(!parsed.success)throw new HttpError(400,parsed.error.issues[0].message);
 const d=parsed.data,db=database(),now=new Date().toISOString();
 for(const s of d.states)await checkImage(db,a,s.fileId);
 const body=JSON.stringify({context:displayAssetContext,assetKind:d.kind,states:d.states,tags:d.tags});
 if(id){
  await readDisplayAsset(a,id);
  const r=await db.prepare(`UPDATE records SET title=?,body=?,version=version+1,updated_at=? WHERE id=? AND version=? AND ${where}`).bind(d.title,body,now,id,version??0,a.campaignId,displayAssetContext).run();
  if(!r.meta.changes)throw new HttpError(409,'Die Darstellung wurde inzwischen geändert. Bitte neu laden.');
 }else{
  id=crypto.randomUUID();
  await db.prepare("INSERT INTO records (id,campaign_id,owner_id,kind,visibility,title,body,gm_body,version,created_at,updated_at) VALUES (?,?,?,'notizen','sl',?,?,'',1,?,?)").bind(id,a.campaignId,a.id,d.title,body,now,now).run();
 }
 return readDisplayAsset(a,id);
}
/** Scenes whose materials use the asset. Scene documents live in entities.gm_body. */
export async function displayAssetUsage(a:Actor,id:string){
 gmOnly(a);await readDisplayAsset(a,id);
 const rows=await database().prepare("SELECT id,title FROM entities WHERE campaign_id=? AND type='SCENE' AND instr(gm_body,?)>0 ORDER BY title").bind(a.campaignId,'"assetId":"'+id+'"').all<{id:string;title:string}>();
 return rows.results;
}
/** Deletes only the asset definition; its image files stay in the media library. Used assets are refused. */
export async function deleteDisplayAsset(a:Actor,id:string,version:number){
 const usage=await displayAssetUsage(a,id);
 if(usage.length)throw Object.assign(new HttpError(409,'Diese Darstellung wird noch verwendet: '+usage.map(s=>s.title).join(', ')+'. Entferne zuerst dort die Zuordnung.'),{usage});
 const r=await database().prepare(`DELETE FROM records WHERE id=? AND version=? AND ${where}`).bind(id,version,a.campaignId,displayAssetContext).run();
 if(!r.meta.changes)throw new HttpError(409,'Darstellung inzwischen geändert. Bitte neu laden.');
}

/**
 * Checks the material blocks of a scene before it is saved: every file must be readable and fit the material type,
 * several pages must be images, the effect sound must be audio. An asset id that no longer exists is kept (the
 * material then shows its plain fallback), so older scene versions stay restorable.
 */
export async function validateSceneMaterials(db:D1Database,a:Actor,elements:SceneElement[]){
 for(const e of elements){
  const m=e.material;if(!m)continue;
  const info=materialTypeInfo[m.type],used=m.files.filter(f=>f.fileId);
  if(!info.multiple&&used.length>1)throw new HttpError(400,info.label+' nimmt nur eine Datei auf.');
  const mimes:string[]=[];
  for(const f of used){
   const row=await db.prepare('SELECT owner_id,visibility,mime FROM files WHERE id=? AND campaign_id=?').bind(f.fileId,a.campaignId).first<{owner_id:string;visibility:string;mime:string}>();
   if(!row||!canRead(a,row))throw new HttpError(404,'Eine Datei von „'+e.title+'“ ist nicht verfügbar.');
   if(!mimeFits(info.accept,row.mime))throw new HttpError(400,'Eine Datei passt nicht zur Materialart „'+info.label+'“.');
   mimes.push(row.mime);
  }
  if(mimes.length>1&&mimes.some(mime=>!mime.startsWith('image/')))throw new HttpError(400,'Mehrere Seiten von „'+e.title+'“ müssen Bilder sein. Ein PDF bitte als einzelne Datei verwenden.');
  if(m.effect.soundFileId){
   const row=await db.prepare('SELECT owner_id,visibility,mime FROM files WHERE id=? AND campaign_id=?').bind(m.effect.soundFileId,a.campaignId).first<{owner_id:string;visibility:string;mime:string}>();
   if(!row||!canRead(a,row)||!row.mime.startsWith('audio/'))throw new HttpError(400,'Der Effektton muss eine verfügbare Audiodatei sein.');
  }
 }
}
