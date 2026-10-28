import {env} from 'cloudflare:workers';
import {actor,database,failure,HttpError,json} from '@/server/access';
import {stageAsset} from '@/server/live-stage';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const a=await actor(),q=new URL(req.url).searchParams;
 const asset=await stageAsset(a,q.get('sessionId')||'',q.get('objectId')||'',q.get('catalogId')||undefined);
 if(asset.text!==undefined)return json({title:asset.title,content:asset.text});
 if(asset.path){if(!('ASSETS' in env)||!env.ASSETS||typeof env.ASSETS!=='object'||!('fetch' in env.ASSETS)||typeof env.ASSETS.fetch!=='function')throw new HttpError(503,'Bildspeicher nicht erreichbar.');const result:Response=await env.ASSETS.fetch(new Request(new URL(asset.path,req.url)));const mime=result.headers.get('content-type')||'';if(!result.ok||!mime.startsWith('image/'))throw new HttpError(404,'Bild nicht verfügbar.');return new Response(result.body,{status:result.status,headers:{'Content-Type':mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});}
 const f=await database().prepare('SELECT key,mime,name,size FROM files WHERE campaign_id=? AND id=?').bind(a.campaignId,asset.fileId).first<{key:string;mime:string;name:string;size:number}>();
 if(!f||!env.BUCKET||!/^(image\/(jpeg|png|webp|gif)$|application\/pdf$|audio\/|video\/)/.test(f.mime))throw new HttpError(404,'Medium nicht verfügbar.');
 let start=0,end=f.size-1;const range=req.headers.get('range');
 if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${f.size}`,'Cache-Control':'private, no-store'}});start=m[1]?Number(m[1]):Math.max(0,f.size-Number(m[2]));end=m[1]&&m[2]?Math.min(Number(m[2]),f.size-1):f.size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=f.size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${f.size}`,'Cache-Control':'private, no-store'}});}
 const obj=await env.BUCKET.get(f.key,range?{range:{offset:start,length:end-start+1}}:undefined);if(!obj)throw new HttpError(404,'Medium nicht verfügbar.');
 return new Response(obj.body,{status:range?206:200,headers:{'Content-Type':f.mime,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes',...(range?{'Content-Range':`bytes ${start}-${end}/${f.size}`} : {}),'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(f.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}catch(e){return failure(e,req);}}
