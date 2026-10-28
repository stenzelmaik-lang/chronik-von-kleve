import {env} from 'cloudflare:workers';
import {actor,database,failure,HttpError} from '@/server/access';
import {readLiveRoom} from '@/server/live-game';
import {liveEventVisible,LIVE_MEDIA_TYPES,type LiveEvent} from '@/domain/live-game';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const a=await actor(),q=new URL(req.url).searchParams,sessionId=q.get('sessionId')||'',db=database();
 const {room}=await readLiveRoom(a,sessionId);if(!room.open)throw new HttpError(404,'Medium nicht verfügbar.');
 let fileId='';
 if(q.get('elementId')){fileId=room.elements.find(e=>e.id===q.get('elementId'))?.fileId||'';}
 else{
  const r=await db.prepare("SELECT body FROM records WHERE id=? AND campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table-event' AND json_extract(body,'$.sessionId')=?").bind('live-event:'+q.get('eventId'),a.campaignId,sessionId).first<{body:string}>();
  if(!r||!room.started)throw new HttpError(404,'Medium nicht verfügbar.');const e=JSON.parse(r.body) as LiveEvent;
  if(e.runId!==room.runId||!liveEventVisible(e,a.id,a.gm)||!(e.kind==='media'&&e.files?.some(file=>file.id===q.get('fileId'))||e.kind==='scene'&&e.scene?.imageFileId===q.get('fileId')))throw new HttpError(404,'Medium nicht verfügbar.');fileId=q.get('fileId')||'';
 }
 const file=await db.prepare('SELECT key,mime,name,size FROM files WHERE id=? AND campaign_id=?').bind(fileId,a.campaignId).first<{key:string;mime:string;name:string;size:number}>();
 if(!file||!LIVE_MEDIA_TYPES.includes(file.mime)||(q.get('elementId')&&!file.mime.startsWith('image/')))throw new HttpError(404,'Medium nicht verfügbar.');
 if(!env.BUCKET)throw new HttpError(503,'Medien nicht erreichbar.');
 const range=req.headers.get('range');let start=0,end=file.size-1;
 if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${file.size}`,'Cache-Control':'private, no-store'}});start=m[1]?Number(m[1]):Math.max(0,file.size-Number(m[2]));end=m[1]&&m[2]?Math.min(Number(m[2]),file.size-1):file.size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=file.size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${file.size}`,'Cache-Control':'private, no-store'}});}
 const obj=await env.BUCKET.get(file.key,range?{range:{offset:start,length:end-start+1}}:undefined);if(!obj)throw new HttpError(404,'Medium nicht verfügbar.');
 return new Response(obj.body,{status:range?206:200,headers:{'Content-Type':file.mime,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes',...(range?{'Content-Range':`bytes ${start}-${end}/${file.size}`} : {}),'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}catch(e){return failure(e,req);}}
