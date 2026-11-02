import {database,HttpError,gmOnly,canRead,type Actor} from '@/server/access';
import {liveMembers,readLiveRoom,liveFile,roomCrew,type LiveRoom} from './live-game';
import {liveAudience,liveRoll,LIVE_MEDIA_TYPES,type LiveEvent} from '@/domain/live-game';
import {readScene} from './story-scenes';
import {evaluateNormalV20,V20_NORMAL_RULES_VERSION} from '@/domain/w10';
export const LIVE_ACTIONS=['start','end','showScene','hideScene','showMedia','mediaIndex','hideMedia','roll','closeRoll'];
type Command={action:string;sessionId:string;runId?:string;eventId?:string;title?:string;create?:boolean;audience?:unknown;sceneId?:string;sceneVersion?:number;fileIds?:string[];pool?:number;target?:number;index?:number;expectedRevision?:number};
export async function liveEvents(a:Actor,sessionId:string,knownRoom?:LiveRoom){
 const room=knownRoom||(await readLiveRoom(a,sessionId)).room;if(!room.open||!room.started)return [];
 const rows=await Promise.all(['scene','media','roll','check'].map(kind=>database().prepare("SELECT body FROM records WHERE campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table-event' AND json_extract(body,'$.sessionId')=? AND json_extract(body,'$.kind')=? AND json_extract(body,'$.runId')=? AND (?=1 OR json_extract(body,'$.recipients') IS NULL OR EXISTS(SELECT 1 FROM json_each(records.body,'$.recipients') WHERE value=?)) ORDER BY created_at DESC,id DESC LIMIT ?").bind(a.campaignId,sessionId,kind,room.runId||'',a.gm?1:0,a.id,kind==='roll'?500:kind==='check'?100:1).all<{body:string}>()));
 return rows.flatMap(r=>r.results).map(r=>JSON.parse(r.body) as LiveEvent).sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id)).map(e=>{if(e.hidden)return {id:e.id,kind:e.kind,authorId:e.authorId,authorName:e.authorName,at:e.at,recipients:e.recipients,hidden:true};if(e.kind!=='check')return e;const {request:_internal,gmHints:_private,consequences:_outcomes,targetCharacterIds:_targets,preparedId:_origin,...visible}=e as LiveEvent&{request?:string};void _internal;
  // Players see only that a check is addressed to them, never other addressees, intended figures or the GM's consequences.
  if(a.gm)return {...visible,...(_private?{gmHints:_private}:{}),...(_outcomes?{consequences:_outcomes}:{}),...(_targets?{targetCharacterIds:_targets}:{}),...(_origin?{preparedId:_origin}:{})};
  const {sceneId:_scene,...check}=visible.check||{} as NonNullable<LiveEvent['check']>;void _scene;
  return {...visible,...(visible.check?{check}:{}),recipients:visible.recipients===null?null:[a.id]} as LiveEvent;});
}
export async function liveCommand(a:Actor,d:Command){
 const db=database(),stamp=new Date().toISOString(),id=`live-table:${a.campaignId}:${d.sessionId}`;
 if(d.action==='start'){
  gmOnly(a);if(typeof d.title!=='string'||!d.title.trim()||d.title.length>200)throw new HttpError(400,'Namen des Spielabends angeben.');
  const members=await liveMembers(a);const participants=[...new Set([a.id,...members.map(m=>m.id)])];
  const original=await db.prepare("SELECT * FROM records WHERE id=?").bind(d.sessionId).first<{owner_id:string;visibility:string;campaign_id:string;kind:string}>();
  if(original&&(original.campaign_id!==a.campaignId||original.kind!=='sitzungen'))throw new HttpError(404,'Sitzung nicht verfügbar.');
  if(original&&!canRead(a,original)&&original.visibility!=='private')throw new HttpError(404,'Sitzung nicht verfügbar.');
  if(!original&&d.create!==true)throw new HttpError(404,'Sitzung nicht verfügbar.');
  if(!original&&!/^[a-f0-9-]{36}$/.test(d.sessionId))throw new HttpError(400,'Ungültige neue Sitzung.');
  const previous=await db.prepare('SELECT body,campaign_id FROM records WHERE id=?').bind(id).first<{body:string;campaign_id:string}>();
  if(previous&&(previous.campaign_id!==a.campaignId||JSON.parse(previous.body).context!=='live-table'))throw new HttpError(409,'Spielraumkennung ist belegt.');
  if(previous&&JSON.parse(previous.body).started&&JSON.parse(previous.body).open)return {ok:true,sessionId:d.sessionId};
  const runId=crypto.randomUUID();const room:LiveRoom={context:'live-table',sessionId:d.sessionId,title:d.title.trim(),open:true,started:true,startedAt:stamp,runId,participants,epoch:0,elements:[],peers:{},screen:null};
  const started=await db.batch([
   ...(!original?[db.prepare("INSERT INTO records(id,campaign_id,owner_id,kind,visibility,title,body,gm_body,created_at,updated_at) VALUES(?,?,?,'sitzungen','group',?,?,'',?,?) ON CONFLICT(id) DO NOTHING").bind(d.sessionId,a.campaignId,a.id,d.title.trim(),JSON.stringify({scene:'',status:'Bereit',log:[]}),stamp,stamp)]:[]),
   db.prepare("UPDATE records SET body=json_set(body,'$.open',json('false'),'$.started',json('false'),'$.peers',json('{}'),'$.screen',json('null')),version=version+1,updated_at=? WHERE campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table' AND id<>? AND json_extract(body,'$.open')=1 AND EXISTS(SELECT 1 FROM records r WHERE r.id=? AND r.campaign_id=? AND r.kind='sitzungen')").bind(stamp,a.campaignId,id,d.sessionId,a.campaignId),
   db.prepare("INSERT INTO records(id,campaign_id,owner_id,kind,visibility,title,body,gm_body,created_at,updated_at) SELECT ?,?,?,'notizen','private','Gemeinsamer Spielraum',?,'',?,? WHERE EXISTS(SELECT 1 FROM records r WHERE r.id=? AND r.campaign_id=? AND r.kind='sitzungen') ON CONFLICT(id) DO UPDATE SET body=json_set(records.body,'$.open',json('true'),'$.started',json('true'),'$.startedAt',?,'$.runId',?,'$.title',?,'$.participants',json(?),'$.peers',json('{}'),'$.screen',json('null')),version=records.version+1,updated_at=excluded.updated_at WHERE records.campaign_id=excluded.campaign_id AND records.kind='notizen' AND json_extract(records.body,'$.context')='live-table' RETURNING id").bind(id,a.campaignId,a.id,JSON.stringify(room),stamp,stamp,d.sessionId,a.campaignId,stamp,runId,d.title.trim(),JSON.stringify(participants))
  ]);if(started.at(-1)?.results.length!==1)throw new HttpError(409,'Spielabend wurde inzwischen geändert oder entfernt.');return {ok:true,sessionId:d.sessionId};
 }
 const {room}=await readLiveRoom(a,d.sessionId);
 if(!d.runId||d.runId!==room.runId)throw new HttpError(409,'Spielabend inzwischen gewechselt. Bitte aktualisieren.');
 if(d.action==='end'){
  gmOnly(a);const ended=await db.prepare("UPDATE records SET body=json_set(body,'$.open',json('false'),'$.started',json('false'),'$.peers',json('{}'),'$.screen',json('null')),version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND json_extract(body,'$.runId')=?").bind(stamp,id,a.campaignId,d.runId).run();if(!ended.meta.changes)throw new HttpError(409,'Spielabend inzwischen gewechselt.');return {ok:true};
 }
 if(!room.started||!room.open)throw new HttpError(409,'Zuerst den Spielabend starten.');
 if(!d.eventId||!/^[a-f0-9-]{36}$/.test(d.eventId))throw new HttpError(400,'Ungültige Live-Aktion.');
 const eventId='live-event:'+d.eventId;
 if(d.action==='hideScene'){
  gmOnly(a);
  const latest=await db.prepare("SELECT id,created_at FROM records WHERE campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table-event' AND json_extract(body,'$.sessionId')=? AND json_extract(body,'$.runId')=? AND json_extract(body,'$.kind')='scene' ORDER BY created_at DESC,id DESC LIMIT 1").bind(a.campaignId,d.sessionId,room.runId).first<{id:string;created_at:string}>();
  if(!latest)throw new HttpError(404,'Keine veröffentlichte Erzählung vorhanden.');
  if(latest.id!==eventId)throw new HttpError(409,'Die Erzählung wurde inzwischen gewechselt. Bitte aktualisieren.');
  // Use the existing hidden event state. Clear all audiences in this run so
  // earlier individual releases cannot remain visible or reappear for players.
  // The newest-event guard is stable throughout the UPDATE and rejects stale
  // clicks if a newer publication was inserted after the read above.
  await db.prepare("UPDATE records SET body=json_set(body,'$.hidden',json('true')),version=version+1,updated_at=? WHERE campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table-event' AND json_extract(body,'$.sessionId')=? AND json_extract(body,'$.runId')=? AND json_extract(body,'$.kind')='scene' AND COALESCE(json_extract(body,'$.hidden'),0)<>1 AND NOT EXISTS(SELECT 1 FROM records newer WHERE newer.campaign_id=? AND newer.kind='notizen' AND json_valid(newer.body) AND json_extract(newer.body,'$.context')='live-table-event' AND json_extract(newer.body,'$.sessionId')=? AND json_extract(newer.body,'$.runId')=? AND json_extract(newer.body,'$.kind')='scene' AND (newer.created_at>? OR (newer.created_at=? AND newer.id>?))) AND EXISTS(SELECT 1 FROM records r WHERE r.id=? AND r.campaign_id=? AND json_extract(r.body,'$.runId')=? AND json_extract(r.body,'$.open')=1)").bind(stamp,a.campaignId,d.sessionId,room.runId,a.campaignId,d.sessionId,room.runId,latest.created_at,latest.created_at,latest.id,id,a.campaignId,d.runId).run();
  const current=await db.prepare("SELECT id FROM records WHERE campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table-event' AND json_extract(body,'$.sessionId')=? AND json_extract(body,'$.runId')=? AND json_extract(body,'$.kind')='scene' ORDER BY created_at DESC,id DESC LIMIT 1").bind(a.campaignId,d.sessionId,room.runId).first<{id:string}>();
  if(current?.id!==eventId)throw new HttpError(409,'Die Erzählung wurde inzwischen gewechselt. Bitte aktualisieren.');
  const after=(await readLiveRoom(a,d.sessionId)).room;
  if(!after.started||!after.open||after.runId!==d.runId)throw new HttpError(409,'Spielabend inzwischen gewechselt. Bitte aktualisieren.');
  return {ok:true};
 }
 if(d.action==='mediaIndex'||d.action==='hideMedia'){
  gmOnly(a);const r=await db.prepare("SELECT body,version FROM records WHERE id=? AND campaign_id=? AND json_valid(body) AND json_extract(body,'$.context')='live-table-event' AND json_extract(body,'$.sessionId')=?").bind(eventId,a.campaignId,d.sessionId).first<{body:string;version:number}>();
  if(!r)throw new HttpError(404,'Medienansicht nicht verfügbar.');const event=JSON.parse(r.body) as LiveEvent;
  if(event.kind!=='media'||event.runId!==room.runId)throw new HttpError(400,'Keine aktuelle Medienansicht.');
  if(d.action==='mediaIndex'&&(!Number.isInteger(d.index)||Number(d.index)<0||Number(d.index)>=(event.files?.length||0)))throw new HttpError(400,'Ungültige Medienposition.');
  const next=d.action==='hideMedia'?{...event,hidden:true}:{...event,index:d.index};
  const updated=await db.prepare("UPDATE records SET body=?,version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND version=? AND EXISTS(SELECT 1 FROM records r WHERE r.id=? AND r.campaign_id=? AND json_extract(r.body,'$.runId')=? AND json_extract(r.body,'$.open')=1)").bind(JSON.stringify(next),stamp,eventId,a.campaignId,r.version,id,a.campaignId,d.runId).run();if(!updated.meta.changes)throw new HttpError(409,'Medienansicht inzwischen geändert.');return {ok:true};
 }
 if(d.action==='closeRoll'){
  gmOnly(a);
  const current=await db.prepare("SELECT body,version FROM records WHERE id=? AND campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table-event' AND json_extract(body,'$.sessionId')=? AND json_extract(body,'$.runId')=? AND json_extract(body,'$.kind')='roll'").bind(eventId,a.campaignId,d.sessionId,room.runId).first<{body:string;version:number}>();
  if(!current)throw new HttpError(404,'Wurf nicht verfügbar.');const roll=JSON.parse(current.body) as LiveEvent;
  if(roll.closedShared)return {ok:true};
  if(d.expectedRevision!==(roll.revision||1))throw new HttpError(409,'Wurf inzwischen geändert.');
  const result=await db.prepare("UPDATE records SET body=json_set(body,'$.closedShared',json('true'),'$.revision',?),version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND version=? AND EXISTS(SELECT 1 FROM records r WHERE r.id=? AND r.campaign_id=? AND json_extract(r.body,'$.runId')=? AND json_extract(r.body,'$.open')=1)").bind((roll.revision||1)+1,stamp,eventId,a.campaignId,current.version,id,a.campaignId,room.runId).run();
  if(!result.meta.changes)throw new HttpError(409,'Wurf oder Sitzung inzwischen geändert.');return {ok:true};
 }
 const eligible=roomCrew(room,await liveMembers(a)).map(m=>m.id);let recipients;
 try{recipients=liveAudience(d.audience,eligible);}catch(e){throw new HttpError(400,(e as Error).message);}
 if(d.action!=='roll')gmOnly(a);
 const request=JSON.stringify({action:d.action,runId:d.runId,recipients,sceneId:d.sceneId,sceneVersion:d.sceneVersion,fileIds:d.fileIds,pool:d.pool,target:d.target});
 const previous=await db.prepare('SELECT body FROM records WHERE id=? AND campaign_id=?').bind(eventId,a.campaignId).first<{body:string}>();
 if(previous){const e=JSON.parse(previous.body);if(e.authorId!==a.id||e.request!==request)throw new HttpError(409,'Diese Live-Aktion wurde bereits anders verwendet.');return {ok:true,eventId:d.eventId,...(e.kind==='roll'&&(a.gm||e.recipients===null||e.recipients.includes(a.id))?{roll:e.roll}:{})};}
 const recent=await db.prepare("SELECT count(*) AS n FROM (SELECT id FROM records WHERE campaign_id=? AND owner_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table-event' AND created_at>? LIMIT 31)").bind(a.campaignId,a.id,new Date(Date.now()-60000).toISOString()).first<{n:number}>();if((recent?.n||0)>=30)throw new HttpError(429,'Zu viele Live-Aktionen. Bitte kurz warten.');
 const event:LiveEvent&{context:string;sessionId:string;request:string}={id:d.eventId,runId:d.runId,context:'live-table-event',sessionId:d.sessionId,request,kind:d.action==='roll'?'roll':d.action==='showScene'?'scene':'media',authorId:a.id,authorName:a.name,at:stamp,recipients};
 if(d.action==='showScene'){
  if(!d.sceneId)throw new HttpError(400,'Szene wählen.');const scene=await readScene(db,a,d.sceneId);
  if(scene.document.archived||scene.version!==d.sceneVersion)throw new HttpError(409,'Szene verändert oder archiviert. Bitte Vorschau aktualisieren.');
  // Deliberate publication snapshot: never copy atmosphere, GM notes, secrets or consequences.
  event.scene={id:scene.id,title:scene.document.title,narration:scene.document.narration};
  const image=scene.document.elements.find(e=>e.kind==='image'&&e.fileId);
  if(image){const file=await liveFile(a,image.fileId);if(!file.mime.startsWith('image/'))throw new HttpError(400,'Szenenbild ist kein Bild.');event.scene.imageFileId=file.id;}
 }else if(d.action==='showMedia'){
  if(!Array.isArray(d.fileIds)||!d.fileIds.length||d.fileIds.length>20||new Set(d.fileIds).size!==d.fileIds.length)throw new HttpError(400,'1–20 Medien wählen.');
  event.files=[];for(const fileId of d.fileIds){if(typeof fileId!=='string')throw new HttpError(400,'Ungültiges Medium.');const f=await liveFile(a,fileId);if(!LIVE_MEDIA_TYPES.includes(f.mime))throw new HttpError(400,'Dieses Medienformat wird nicht unterstützt.');event.files.push({id:f.id,name:f.name,mime:f.mime});}event.index=0;
 }else{try{event.roll=liveRoll(d.pool,d.target);event.report=evaluateNormalV20(event.roll.dice,event.roll.target);event.rulesVersion=V20_NORMAL_RULES_VERSION;event.animationSeed=Array.from(crypto.getRandomValues(new Uint32Array(4)));event.revision=1;}catch(e){throw new HttpError(400,(e as Error).message);}}
 const count=d.action==='roll'?await db.prepare("SELECT count(*) AS n FROM records WHERE campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table-event' AND json_extract(body,'$.sessionId')=? AND json_extract(body,'$.runId')=? AND json_extract(body,'$.kind')='roll'").bind(a.campaignId,d.sessionId,room.runId).first<{n:number}>():null;
 if((count?.n||0)>=500)throw new HttpError(429,'Sitzungsprotokoll voll; vorhandene Würfe bleiben erhalten.');
 const inserted=await db.prepare("INSERT INTO records(id,campaign_id,owner_id,kind,visibility,title,body,gm_body,created_at,updated_at) SELECT ?,?,?,'notizen','private','Live-Ereignis',json_set(?,'$.sequence',(SELECT COALESCE(MAX(json_extract(body,'$.sequence')),0)+1 FROM records WHERE campaign_id=? AND json_valid(body) AND json_extract(body,'$.context')='live-table-event' AND json_extract(body,'$.sessionId')=? AND json_extract(body,'$.runId')=? AND json_extract(body,'$.kind')='roll')),'',?,? WHERE EXISTS(SELECT 1 FROM records WHERE id=? AND campaign_id=? AND json_extract(body,'$.started')=1 AND json_extract(body,'$.open')=1 AND json_extract(body,'$.runId')=?) AND (?<>'showScene' OR EXISTS(SELECT 1 FROM entities e WHERE e.campaign_id=? AND e.id=? AND e.type='SCENE' AND e.version=? AND e.visibility='sl' AND e.canon_status='WORKING' AND e.legacy_record_id IS NULL AND json_extract(e.content,'$.documentKind')='story_scene' AND COALESCE(json_extract(CASE WHEN json_valid(e.gm_body) THEN e.gm_body ELSE '{}' END,'$.archived'),0)<>1)) AND (? <> 'roll' OR (SELECT count(*) FROM records WHERE campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table-event' AND json_extract(body,'$.sessionId')=? AND json_extract(body,'$.runId')=? AND json_extract(body,'$.kind')='roll')<500) ON CONFLICT(id) DO NOTHING").bind(eventId,a.campaignId,a.id,JSON.stringify(event),a.campaignId,d.sessionId,d.runId,stamp,stamp,id,a.campaignId,d.runId,d.action,a.campaignId,d.sceneId||'',d.sceneVersion||0,d.action,a.campaignId,d.sessionId,d.runId).run();
 if(!inserted.meta.changes){const r=await db.prepare('SELECT body FROM records WHERE id=? AND campaign_id=?').bind(eventId,a.campaignId).first<{body:string}>();if(!r||JSON.parse(r.body).request!==request||JSON.parse(r.body).authorId!==a.id)throw new HttpError(409,'Spielabend beendet oder Aktion kollidiert.');}
 const stored=await db.prepare('SELECT body FROM records WHERE id=? AND campaign_id=?').bind(eventId,a.campaignId).first<{body:string}>();
 return {ok:true,eventId:d.eventId,...(event.kind==='roll'&&(a.gm||event.recipients===null||event.recipients.includes(a.id))?{roll:JSON.parse(stored!.body).roll}:{})};
}
