import {database,HttpError,type Actor} from './access';
import {materialContext,materialSchema,materialMimeMatches,type TableMaterial} from '@/domain/table-material';
import type {LegacyRecordRow} from '@/domain/legacy';
import {richTextFileIds} from '@/domain/location-rich-text';

function material(row:LegacyRecordRow):TableMaterial{
 const body=JSON.parse(row.body);
 const d=materialSchema.safeParse({title:row.title,kind:body.materialKind,text:body.text,fileId:body.fileId,pages:body.pages});
 if(body.context!==materialContext||!d.success)throw new HttpError(409,'Diese Unterlage hat ein nicht unterstütztes Format. Sie bleibt unverändert.');
 return {...d.data,id:row.id,version:row.version,ownerId:row.owner_id,updatedAt:row.updated_at};
}
export async function readMaterial(a:Actor,id:string){
 const row=await database().prepare("SELECT * FROM records WHERE id=? AND campaign_id=? AND owner_id=? AND kind='notizen' AND visibility='private' AND json_valid(body) AND json_extract(body,'$.context')=?").bind(id,a.campaignId,a.id,materialContext).first<LegacyRecordRow>();
 if(!row)throw new HttpError(404,'Eigene Vorbereitung nicht gefunden.');return material(row);
}
export async function listMaterials(a:Actor){
 const rows=await database().prepare("SELECT * FROM records WHERE campaign_id=? AND owner_id=? AND kind='notizen' AND visibility='private' AND json_valid(body) AND json_extract(body,'$.context')=? ORDER BY updated_at DESC,id").bind(a.campaignId,a.id,materialContext).all<LegacyRecordRow>();
 return rows.results.map(material);
}
export async function saveMaterial(a:Actor,value:unknown,id?:string,version?:number){
 const parsed=materialSchema.safeParse(value);if(!parsed.success)throw new HttpError(400,parsed.error.issues[0].message);
 const d=parsed.data,db=database(),now=new Date().toISOString();
 // Inline private file URLs cannot be released safely with a text document. Images are separate table objects.
 if(richTextFileIds(d.text).length)throw new HttpError(400,'Bilder bitte als eigenes Bildmaterial anhängen; der Text bleibt unabhängig freigebbar.');
 if(d.fileId){const f=await db.prepare('SELECT mime FROM files WHERE id=? AND campaign_id=? AND owner_id=?').bind(d.fileId,a.campaignId,a.id).first<{mime:string}>();
  if(!f||!materialMimeMatches(d.kind,f.mime))throw new HttpError(400,'Bitte eine eigene, passende Datei auswählen.');}
 for(const page of d.pages){const f=await db.prepare('SELECT mime FROM files WHERE id=? AND campaign_id=? AND owner_id=?').bind(page.fileId,a.campaignId,a.id).first<{mime:string}>();if(!f?.mime.startsWith('image/'))throw new HttpError(400,'Jede Handoutseite muss ein eigenes Bild aus deiner Galerie sein.');}
 const body=JSON.stringify({context:materialContext,materialKind:d.kind,text:d.text,fileId:d.fileId,pages:d.pages});
 if(id){await readMaterial(a,id);const r=await db.prepare('UPDATE records SET title=?,body=?,version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND owner_id=? AND version=?').bind(d.title,body,now,id,a.campaignId,a.id,version??0).run();if(!r.meta.changes)throw new HttpError(409,'Die Vorbereitung wurde inzwischen geändert. Bitte neu laden.');}
 else{id=crypto.randomUUID();await db.prepare("INSERT INTO records (id,campaign_id,owner_id,kind,visibility,title,body,gm_body,version,created_at,updated_at) VALUES (?,?,?,'notizen','private',?,?,'',1,?,?)").bind(id,a.campaignId,a.id,d.title,body,now,now).run();}
 return readMaterial(a,id);
}
export async function deleteMaterial(a:Actor,id:string,version:number){
 await readMaterial(a,id);
 // Shared working copies must be withdrawn explicitly before the template can disappear.
 const used=await database().prepare("SELECT id FROM records WHERE campaign_id=? AND json_valid(body) AND json_extract(body,'$.context')='live-table' AND json_extract(body,'$.open')=1 AND instr(body,?)>0").bind(a.campaignId,id).first();
 if(used)throw new HttpError(409,'Diese Vorbereitung liegt noch auf einem Spieltisch. Nimm sie dort zuerst vom Tisch.');
 const r=await database().prepare("DELETE FROM records WHERE id=? AND campaign_id=? AND owner_id=? AND version=? AND NOT EXISTS (SELECT 1 FROM records room WHERE room.campaign_id=records.campaign_id AND json_valid(room.body) AND json_extract(room.body,'$.context')='live-table' AND json_extract(room.body,'$.open')=1 AND instr(room.body,records.id)>0)").bind(id,a.campaignId,a.id,version).run();
 if(!r.meta.changes)throw new HttpError(409,'Vorbereitung inzwischen geändert. Bitte neu laden.');
}
