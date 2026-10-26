import {env} from 'cloudflare:workers';
import {actor,database,failure,HttpError,json,sameOrigin} from '@/server/access';
import {requireCmsPublisher} from '@/server/location-cms-service';
export const dynamic='force-dynamic';
const types=['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
export async function GET(req:Request){try{const a=await actor();requireCmsPublisher(a);const files=await database().prepare("SELECT id,name,mime,size FROM files WHERE campaign_id=? AND visibility='sl' ORDER BY created_at DESC LIMIT 250").bind(a.campaignId).all<{id:string;name:string;mime:string;size:number}>();return json({files:files.results.filter(f=>types.includes(f.mime))});}catch(error){return failure(error,req);}}
export async function POST(req:Request){try{
  sameOrigin(req);const a=await actor();requireCmsPublisher(a);
  if(Number(req.headers.get('content-length')||0)>25*1024*1024+65536)throw new HttpError(413,'Dateien dürfen höchstens 25 MB groß sein.');
  const form=await req.formData(),file=form.get('file');if(!(file instanceof File)||!types.includes(file.type)||!file.size||file.size>25*1024*1024)throw new HttpError(400,'Wähle ein Bild, PDF oder DOCX bis 25 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer()),sig=String.fromCharCode(...bytes.slice(0,12));
  const valid=file.type==='image/png'?bytes[0]===137&&sig.slice(1,4)==='PNG':file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:file.type==='image/webp'?sig.startsWith('RIFF')&&sig.slice(8)==='WEBP':file.type==='application/pdf'?sig.startsWith('%PDF-'):sig.startsWith('PK\x03\x04');
  if(!valid)throw new HttpError(400,'Dateityp und Dateiinhalt stimmen nicht überein.');
  if(!env.BUCKET)throw new HttpError(503,'Privater Medienspeicher nicht erreichbar.');
  const id=crypto.randomUUID(),key=`campaigns/${a.campaignId}/locations/${id}`,name=file.name.replace(/[\\/\u0000-\u001f]/g,'_').slice(0,160)||'Ortsunterlage';
  await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:file.type,cacheControl:'private, no-store'}});
  try{await database().prepare('INSERT INTO files(id,campaign_id,owner_id,visibility,name,mime,size,key,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,a.campaignId,a.id,'sl',name,file.type,file.size,key,new Date().toISOString()).run();}
  catch(error){await env.BUCKET.delete(key);throw error;}
  return json({id,name,mime:file.type,size:file.size},201);
}catch(error){return failure(error,req);}}
