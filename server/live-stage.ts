import {database,gmOnly,HttpError,type Actor} from './access';
import {readLiveRoom,liveMembers,liveFile} from './live-game';
import {liveEvents} from './live-commands';
import {loadEntities,loadEntitiesForIds} from './entities';
import {listScenes} from './story-scenes';
import {stageSchema,emptyStage,stageVisible,changeStageObjects,stageSourceToken,type StageCommand,type StageState,type StageObject} from '@/domain/live-stage';
import {evaluateNormalV20} from '@/domain/w10';
import {participantPresence} from '@/domain/live-participants';

export function storedStage(room:{stage?:unknown}):StageState{
 if(room.stage===undefined)return emptyStage();
 const parsed=stageSchema.safeParse(room.stage);if(!parsed.success)throw new HttpError(409,'Bühnenstand nicht unterstützt. Vorhandene Daten bleiben erhalten.');return parsed.data;
}
export async function stageRoom(a:Actor,sessionId:string){const value=await readLiveRoom(a,sessionId);if(!value.room.started||!value.room.open)throw new HttpError(409,'Spielabend ist nicht aktiv.');return value;}
export async function stageSource(a:Actor,id:string,kind:'entity'|'file'){
 gmOnly(a);
 if(kind==='file'){const f=await liveFile(a,id);if(!/^(image\/(jpeg|png|webp|gif)|application\/pdf|audio\/|video\/)/.test(f.mime))throw new HttpError(400,'Nicht unterstütztes Bühnenmedium.');return {title:f.name,kind:'document' as const,sourceId:id,sourceKind:kind};}
 const e=(await loadEntitiesForIds(database(),a.campaignId,[id])).find(e=>e.id===id);
 if(!e||!['NPC','HANDOUT'].includes(e.type))throw new HttpError(404,'Originalobjekt nicht verfügbar.');
 return {title:e.title,kind:e.type==='NPC'?'npc' as const:'document' as const,sourceId:e.id,sourceKind:kind,sourceVersion:e.version,sourceToken:await stageSourceToken(e)};
}
export async function stageSnapshot(a:Actor,sessionId:string,includeCatalog=false){
 const {row,room}=await stageRoom(a,sessionId),stage=storedStage(room);
 const [events,members]=await Promise.all([liveEvents(a,sessionId,room),liveMembers(a)]);
 const rolls=events.filter(e=>e.kind==='roll'&&e.roll&&!e.hidden).sort((x,y)=>(x.sequence||0)-(y.sequence||0)||x.at.localeCompare(y.at)||x.id.localeCompare(y.id));
 const diceEvents=rolls.map((e,i)=>({id:e.id,sessionId:room.runId!,sequence:e.sequence||i+1,revision:e.revision||1,kind:'roll' as const,authorId:e.authorId,authorName:e.authorName,at:e.at,status:e.closedShared?'closed_shared' as const:'settled_open' as const,roll:e.roll!,result:evaluateNormalV20(e.roll!.dice,e.roll!.target),animationSeed:e.animationSeed||[...e.id.replaceAll('-','').matchAll(/.{8}/g)].map(m=>parseInt(m[0],16))}));
 const scene=events.findLast(e=>e.kind==='scene'&&!e.hidden),media=events.findLast(e=>e.kind==='media'&&!e.hidden);
 const catalog:{id:string;title:string;kind:string;sourceKind:'entity'|'file';image?:string}[]=[];
 let scenes:{id:string;title:string;image:string;version:number}[]=[];
 if(a.gm&&includeCatalog){
  const [entities,files,availableScenes]=await Promise.all([loadEntities(database(),a.campaignId),database().prepare('SELECT id,name,mime FROM files WHERE campaign_id=? AND (owner_id=? OR visibility IN (\'group\',\'sl\')) ORDER BY name LIMIT 300').bind(a.campaignId,a.id).all<{id:string;name:string;mime:string}>(),listScenes(database(),a)]);
  for(const e of entities.filter(e=>['NPC','HANDOUT'].includes(e.type)))catalog.push({id:e.id,title:e.title,kind:e.type==='NPC'?'npc':'document',sourceKind:'entity',...(e.type==='NPC'?{image:'/api/live-stage/asset?sessionId='+encodeURIComponent(sessionId)+'&catalogId='+encodeURIComponent(e.id)}:{})});
  for(const f of files.results)if(/^(image\/|application\/pdf|audio\/|video\/)/.test(f.mime))catalog.push({id:f.id,title:f.name,kind:'document',sourceKind:'file'});
  scenes=availableScenes.filter(s=>!s.archived).map(s=>({id:s.id,title:s.title,image:'',version:s.version}));
 }
 const version=stage.version,diceRevision=rolls.length+rolls.reduce((n,e)=>n+(e.revision||1),0);
 return {principal:{id:a.id,gm:a.gm,role:a.role},version,catalogIncluded:includeCatalog,cursor:row.version+':'+diceRevision+':'+(scene?.id||'')+':'+(media?.id||'')+':'+(media?.index||0),sessionId,runId:room.runId,title:room.title||'Spielabend',scene:scene?.scene?.id||'',sharedScene:scene?.scene?.id||'',preview:false,sceneInfo:scene?.scene,sceneEventId:scene?.id,media,
  objects:stage.objects.filter(o=>stageVisible(o,a)),board:room.elements,boardEpoch:room.epoch,
  crew:members.filter(m=>room.participants?.includes(m.id)).map(m=>({...m,avatar:m.hasAvatar?'/api/live-participants?view=avatar&sessionId='+encodeURIComponent(sessionId)+'&memberId='+encodeURIComponent(m.id):null,presence:participantPresence(m.id,room.peers,room.away),initials:m.name.split(/\s+/).map(s=>s[0]).join('').slice(0,2),role:m.id===a.id?(a.gm?'Spielleitung':'Spieler'):'Teilnehmer'})),scenes,catalog,
  dice:{sessionId:room.runId!,revision:diceRevision,events:diceEvents}};
}
export async function stageMutation(a:Actor,sessionId:string,runId:string,expectedVersion:number,c:StageCommand){
 const {row,room}=await stageRoom(a,sessionId),state=storedStage(room);
 if(runId!==room.runId||state.version!==expectedVersion)throw new HttpError(409,'Die Bühne wurde inzwischen geändert. Bitte aktualisieren.');
 if(c.action==='visibility'&&c.recipients?.length){const eligible=(await liveMembers(a)).filter(m=>room.participants?.includes(m.id));if(c.recipients.some(id=>!eligible.some(m=>m.id===id)))throw new HttpError(400,'Zielperson ist nicht in dieser Runde.');}
 const source=c.action==='add'&&c.kind!=='note'?await stageSource(a,c.sourceId||'',c.sourceKind||'entity'):undefined;
 if(c.action==='add'&&source&&source.kind!==c.kind)throw new HttpError(400,'Objekttyp passt nicht zur Quelle.');
 let next:StageState;try{next=changeStageObjects(state,a,c,source);}catch(e){if(e instanceof Error&&'status' in e)throw new HttpError(Number(e.status),e.message);throw new HttpError(400,'Ungültige Bühnenaktion.');}
 const result=await database().prepare("UPDATE records SET body=json_set(body,'$.stage',json(?)),version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND version=? AND json_extract(body,'$.runId')=? AND json_extract(body,'$.open')=1").bind(JSON.stringify(next),new Date().toISOString(),row.id,a.campaignId,row.version,runId).run();
 if(!result.meta.changes)throw new HttpError(409,'Spielstand inzwischen geändert. Deine Änderung wurde nicht überschreibend gespeichert.');
}
export async function stageAsset(a:Actor,sessionId:string,objectId:string,catalogId?:string):Promise<{fileId?:string;path?:string;text?:string;title:string}>{
 const {room}=await stageRoom(a,sessionId);let o:Exclude<StageObject,{kind:'note'}>|undefined;
 if(catalogId){gmOnly(a);const s=await stageSource(a,catalogId,'entity');o={id:'preview',...s,rect:{x:0,y:0,w:.2,h:.4},visibility:'sl',recipients:null};}
 else {const found=storedStage(room).objects.find(o=>o.id===objectId&&stageVisible(o,a));if(found&&found.kind!=='note')o=found;}
 if(!o)throw new HttpError(404,'Bühnenobjekt nicht verfügbar.');
 if(o.sourceKind==='file')return {fileId:o.sourceId,title:o.title};
 const e=(await loadEntitiesForIds(database(),a.campaignId,[o.sourceId])).find(e=>e.id===o!.sourceId);
 if(!e)throw new HttpError(404,'Originalobjekt nicht verfügbar.');
 // Publication applies to the reviewed original version. Later SL edits must
 // never silently release new private text or a newly attached secret image.
 if(o.sourceVersion!==e.version)throw new HttpError(409,'Original wurde geändert. Die SL muss es erneut auflegen und ausdrücklich freigeben.');
 // Legacy fallbacks can change independently of the Entity revision.
 if(o.sourceToken!==await stageSourceToken(e))throw new HttpError(409,'Aufgelegter Inhalt wurde geändert. Bitte erneut ausdrücklich freigeben.');
 if(o.kind==='document')return {text:typeof e.content.text==='string'?e.content.text:'',title:o.title};
 const image=String(e.content.image_primary||e.content.image||'');
 if(/^\/images\/[a-zA-Z0-9._-]+$/.test(image))return {path:image,title:o.title};
 const match=/^\/api\/files\?id=([a-zA-Z0-9_-]+)$/.exec(image);
 if(match){const f=await database().prepare('SELECT id,mime FROM files WHERE id=? AND campaign_id=?').bind(match[1],a.campaignId).first<{id:string;mime:string}>();if(f?.mime.startsWith('image/'))return {fileId:f.id,title:o.title};}
 throw new HttpError(404,'Für diese Figur ist kein Bühnenbild hinterlegt.');
}
