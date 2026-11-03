import {env} from 'cloudflare:workers';
import {actor,database,failure,HttpError} from '@/server/access';
import {deliveryAsset} from '@/server/live-deliveries';
export const dynamic='force-dynamic';
// Pictures and sound of a vision or message: the server checks recipient, run and file before a single byte leaves R2.
export async function GET(req:Request){try{
 const a=await actor(),q=new URL(req.url).searchParams;
 const sessionId=q.get('sessionId')||'',runId=q.get('runId')||'',fileId=q.get('fileId')||'';
 if(!sessionId||sessionId.length>160||!/^[a-f0-9-]{36}$/.test(runId)||!fileId||fileId.length>100)throw new HttpError(400,'Ungültige Anfrage.');
 await deliveryAsset(a,sessionId,runId,fileId);
 const f=await database().prepare('SELECT key,mime,name,size FROM files WHERE campaign_id=? AND id=?').bind(a.campaignId,fileId).first<{key:string;mime:string;name:string;size:number}>();
 if(!f||!env.BUCKET||!/^(image\/(jpeg|png|webp|gif)$|audio\/)/.test(f.mime))throw new HttpError(404,'Medium nicht verfügbar.');
 let start=0,end=f.size-1;const range=req.headers.get('range');
 if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${f.size}`,'Cache-Control':'private, no-store'}});
  start=m[1]?Number(m[1]):Math.max(0,f.size-Number(m[2]));end=m[1]&&m[2]?Math.min(Number(m[2]),f.size-1):f.size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=f.size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${f.size}`,'Cache-Control':'private, no-store'}});}
 const obj=await env.BUCKET.get(f.key,range?{range:{offset:start,length:end-start+1}}:undefined);if(!obj)throw new HttpError(404,'Medium nicht verfügbar.');
 return new Response(obj.body,{status:range?206:200,headers:{'Content-Type':f.mime,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes',...(range?{'Content-Range':`bytes ${start}-${end}/${f.size}`}:{}),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}catch(e){return failure(e,req);}}
