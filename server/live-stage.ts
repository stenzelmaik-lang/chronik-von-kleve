import {richTextFileIds,richTextToPlainText} from '@/domain/location-rich-text';
import {validatePreparationMedia} from './preparation-media';
import {readMaterial} from './table-materials';
import {database,gmOnly,HttpError,type Actor} from './access';
import {readLiveRoom,liveMembers,liveFile} from './live-game';
import {liveEvents} from './live-commands';
import {loadEntities,loadEntitiesForIds} from './entities';
import {listScenes,readScene} from './story-scenes';
import {preparedSession} from './story-preparation';
import {emptyScenePager,type SceneSummary} from '@/domain/story-scene';
import {liveSceneChoice} from '@/domain/session-overview';
import {stageSchema,emptyStage,stageVisible,pagerVisible,changeStageObjects,stageSourceToken,stageMediaOf,startYoutube,youtubePlaylist,type StageCommand,type StageState,type StageObject,type StageBackdrop,type StageMusic} from '@/domain/live-stage';
import {evaluateNormalV20} from '@/domain/w10';
import {participantPresence} from '@/domain/live-participants';
import {vitalsSnapshot} from './live-vitals';
import {materialStageSource,regieMaterials} from './material-stage';
import {archivePocket,pocketHolders,pocketItem,pocketRow,pocketSnapshot,removePocket,restorePocket} from './material-pocket';

export function storedStage(room:{stage?:unknown}):StageState{
 if(room.stage===undefined)return emptyStage();
 const parsed=stageSchema.safeParse(room.stage);if(!parsed.success)throw new HttpError(409,'Bühnenstand nicht unterstützt. Vorhandene Daten bleiben erhalten.');return parsed.data;
}
export async function stageRoom(a:Actor,sessionId:string){const value=await readLiveRoom(a,sessionId);if(!value.room.started||!value.room.open)throw new HttpError(409,'Spielabend ist nicht aktiv.');return value;}
export async function stageSource(a:Actor,id:string,kind:'entity'|'file'|'record'){
 if(kind==='record'&&id.startsWith('scene-whisper:')){
  gmOnly(a);const split=id.lastIndexOf(':'),scene=await readScene(database(),a,id.slice(14,split)),w=scene.document.whispers.find(w=>w.id===id.slice(split+1));
  if(!w||!w.recipientIds.length)throw new HttpError(400,'Wähle Empfänger für diesen Inhalt in der Szenenvorbereitung.');
  const imageIds=[...new Set([...w.fileIds,...richTextFileIds(w.text)])];
  if(imageIds.length>20)throw new HttpError(400,'Höchstens 20 Bilder je persönlichem Inhalt.');
  if(!richTextToPlainText(w.text).trim()&&!imageIds.length)throw new HttpError(400,'Dieser persönliche Inhalt ist noch leer.');
  await validatePreparationMedia(database(),a,[w.text],imageIds.map(id=>({id,kind:'image'})));
  return {title:w.title,kind:'document' as const,sourceId:id,sourceKind:kind,sourceVersion:scene.version,ownerId:a.id,documentContent:w.text,presentation:w.kind,recipients:w.recipientIds,
   ...(imageIds.length?{media:'pages' as const,pages:imageIds.map((fileId,i)=>({id:crypto.randomUUID(),fileId,title:'Bild '+(i+1)}))}:{})};
 }
 if(kind==='record'&&id.startsWith('scene-material:')){gmOnly(a);const split=id.lastIndexOf(':'),scene=await readScene(database(),a,id.slice(15,split)),material=scene.document.elements.find(e=>e.id===id.slice(split+1)&&e.material);
  // Spielmaterial 3.0: one table object with all files, the display asset states and the effect.
  if(material)return materialStageSource(a,scene,material,id);
  const element=scene.document.elements.find(e=>e.id===id.slice(split+1)&&e.kind==='handout'&&!e.fileId&&!e.referenceId);if(!element)throw new HttpError(404,'Vorbereitetes Handout nicht verfügbar.');return {title:element.title,kind:'document' as const,sourceId:id,sourceKind:kind,sourceVersion:scene.version,ownerId:a.id,documentContent:element.text};}
 if(kind==='record'){const m=await readMaterial(a,id);return {title:m.title,kind:'document' as const,sourceId:id,sourceKind:kind,sourceVersion:m.version,ownerId:m.ownerId,...(m.pages.length?{media:'pages' as const,pages:m.pages,...(m.text?{documentContent:m.text}:{})}:m.fileId?{sourceFileId:m.fileId,media:stageMediaOf((await liveFile(a,m.fileId)).mime),...(m.text?{documentContent:m.text}:{})}:{documentContent:m.text})};}
 gmOnly(a);
 if(kind==='file'){const f=await liveFile(a,id);if(!/^(image\/(jpeg|png|webp|gif)|application\/pdf|audio\/|video\/)/.test(f.mime))throw new HttpError(400,'Nicht unterstütztes Bühnenmedium.');return {title:f.name,kind:'document' as const,sourceId:id,sourceKind:kind,media:stageMediaOf(f.mime)};}
 const e=(await loadEntitiesForIds(database(),a.campaignId,[id])).find(e=>e.id===id);
 if(!e||!['NPC','HANDOUT'].includes(e.type))throw new HttpError(404,'Originalobjekt nicht verfügbar.');
 return {title:e.title,kind:e.type==='NPC'?'npc' as const:'document' as const,sourceId:e.id,sourceKind:kind,sourceVersion:e.version,sourceToken:await stageSourceToken(e)};
}
/** Private SL direction context for one prepared scene. GM only; never part of a player snapshot. */
export async function stageRegie(a:Actor,sessionId:string,sceneId:string){
 gmOnly(a);await stageRoom(a,sessionId);
 const db=database(),scene=await readScene(db,a,sceneId),d=scene.document;
 const refs=[d.placeId,...d.npcIds,...d.clueIds,...d.elements.map(e=>e.referenceId)].filter(Boolean);
 const fileIds=[...new Set([d.backdropFileId,...d.elements.map(e=>e.fileId)].filter(Boolean))];
 const [entities,files]=await Promise.all([loadEntitiesForIds(db,a.campaignId,refs),fileIds.length?db.prepare(`SELECT id,name,mime FROM files WHERE campaign_id=? AND id IN (${fileIds.map(()=>'?').join(',')})`).bind(a.campaignId,...fileIds).all<{id:string;name:string;mime:string}>():Promise.resolve({results:[] as {id:string;name:string;mime:string}[]})]);
 const entity=(id:string)=>entities.find(e=>e.id===id),text=(v:unknown)=>typeof v==='string'?v:'';
 const npcIds=[...new Set([...d.npcIds,...d.elements.filter(e=>e.kind==='person'&&entity(e.referenceId)?.type==='NPC').map(e=>e.referenceId)])];
 const handoutIds=[...new Set([...d.clueIds,...d.elements.filter(e=>e.kind==='handout'&&e.referenceId).map(e=>e.referenceId)])];
 return {
  scene:{id:scene.id,version:scene.version,title:d.title,narration:d.narration,atmosphere:d.atmosphere,dialogueNotes:d.dialogueNotes,interactions:d.interactions,secrets:d.secrets,visions:d.visions,possibleConsequences:d.possibleConsequences,gmNotes:d.gmNotes,possibilities:d.possibilities},
  place:entity(d.placeId)?{id:d.placeId,title:entity(d.placeId)!.title}:null,
  backdrop:files.results.filter(f=>f.id===d.backdropFileId&&f.mime.startsWith('image/')).map(f=>({fileId:f.id,name:f.name}))[0]||null,
  npcs:npcIds.flatMap(id=>{const e=entity(id);return e&&e.type==='NPC'?[{id,title:e.title,summary:text(e.content.text),gmBody:e.gmBody||'',image:'/api/live-stage/asset?sessionId='+encodeURIComponent(sessionId)+'&catalogId='+encodeURIComponent(id),cue:d.elements.filter(x=>x.referenceId===id).map(x=>x.text).join('')}]:[];}),
  handouts:[...d.elements.filter(e=>e.kind==='handout'&&!e.material&&!e.fileId&&!e.referenceId&&e.text.trim()).map(e=>({id:'scene-material:'+scene.id+':'+e.id,title:e.title,stageable:true,sourceKind:'record' as const})),...handoutIds.flatMap(id=>{const e=entity(id);return e&&['HANDOUT','CLUE'].includes(e.type)?[{id,title:e.title,stageable:e.type==='HANDOUT',sourceKind:'entity' as const}]:[];})],
  media:d.elements.flatMap(e=>{const f=!e.material&&files.results.find(f=>f.id===e.fileId);return f?[{id:e.id,title:e.title,kind:e.kind,text:e.text,fileId:f.id,name:f.name,mime:f.mime}]:[];}),
  notes:d.elements.filter(e=>!e.fileId&&!e.material&&!['person','handout','pager'].includes(e.kind)).map(e=>({id:e.id,kind:e.kind,title:e.title,text:e.text})),
  // Prepared pager messages of this scene. Played from the Regie with the element id as message id, so each is sent once.
  pagers:d.elements.flatMap(e=>{if(e.kind!=='pager')return [];const p=e.pager||emptyScenePager();return [{id:e.id,title:e.title,sender:p.sender,text:p.text,priority:p.priority,recipientIds:p.recipientIds,cue:e.text}];}),
  // Prepared YouTube music (title and video id only).
  whispers:d.whispers,
  youtube:d.youtube||[],
  // Spielmaterial 3.0: every material of the scene as one object with its files, display asset and effect (GM only).
  materials:await regieMaterials(a,scene),
 };
}
export async function stageSnapshot(a:Actor,sessionId:string,includeCatalog=false){
 const {row,room}=await stageRoom(a,sessionId),stage=storedStage(room);
 const [events,members,vitals]=await Promise.all([liveEvents(a,sessionId,room),liveMembers(a),vitalsSnapshot(a,room)]);
 const rolls=events.filter(e=>e.kind==='roll'&&e.roll&&!e.hidden).sort((x,y)=>(x.sequence||0)-(y.sequence||0)||x.at.localeCompare(y.at)||x.id.localeCompare(y.id));
 const diceEvents=rolls.map((e,i)=>({id:e.id,sessionId:room.runId!,sequence:e.sequence||i+1,revision:e.revision||1,kind:'roll' as const,authorId:e.authorId,authorName:e.authorName,at:e.at,status:e.closedShared?'closed_shared' as const:'settled_open' as const,roll:e.roll!,result:evaluateNormalV20(e.roll!.dice,e.roll!.target),animationSeed:e.animationSeed||[...e.id.replaceAll('-','').matchAll(/.{8}/g)].map(m=>parseInt(m[0],16))}));
 const scene=events.findLast(e=>e.kind==='scene'&&!e.hidden),media=events.findLast(e=>e.kind==='media'&&!e.hidden);
 const catalog:{id:string;title:string;kind:string;sourceKind:'entity'|'file';image?:string;mime?:string}[]=[];
 let scenes:{id:string;title:string;image:string;version:number}[]=[],moreScenes:typeof scenes=[];
 if(a.gm&&includeCatalog){
  const [entities,files,availableScenes,preparation]=await Promise.all([loadEntities(database(),a.campaignId),database().prepare('SELECT id,name,mime FROM files WHERE campaign_id=? AND (owner_id=? OR visibility IN (\'group\',\'sl\')) ORDER BY name LIMIT 300').bind(a.campaignId,a.id).all<{id:string;name:string;mime:string}>(),listScenes(database(),a),preparedSession(database(),a,sessionId).catch(()=>null)]);
  for(const e of entities.filter(e=>['NPC','HANDOUT'].includes(e.type)))catalog.push({id:e.id,title:e.title,kind:e.type==='NPC'?'npc':'document',sourceKind:'entity',...(e.type==='NPC'?{image:'/api/live-stage/asset?sessionId='+encodeURIComponent(sessionId)+'&catalogId='+encodeURIComponent(e.id)}:{})});
  for(const f of files.results)if(/^(image\/|application\/pdf|audio\/|video\/)/.test(f.mime))catalog.push({id:f.id,title:f.name,kind:'document',sourceKind:'file',mime:f.mime});
  const split=liveSceneChoice(sessionId,preparation?.view.document.sceneIds||[],availableScenes),card=(s:SceneSummary)=>({id:s.id,title:s.title,image:'',version:s.version});
  scenes=split.session.map(card);moreScenes=split.more.map(card);
 }
 const version=stage.version,diceRevision=rolls.length+rolls.reduce((n,e)=>n+(e.revision||1),0);
 return {principal:{id:a.id,gm:a.gm,role:a.role},version,catalogIncluded:includeCatalog,cursor:row.version+':'+diceRevision+':'+(scene?.id||'')+':'+(media?.id||'')+':'+(media?.index||0),sessionId,runId:room.runId,title:room.title||'Spielabend',scene:scene?.scene?.id||'',sharedScene:scene?.scene?.id||'',preview:false,sceneInfo:scene?.scene,sceneEventId:scene?.id,media,
  // The backdrop belongs to the whole round; its file is only served through the stage asset route.
  // The key only changes with the image, so moving table objects never reloads or re-animates the backdrop.
  backdrop:stage.backdrop?{title:stage.backdrop.title,key:stage.backdrop.fileId.slice(0,12),...(stage.backdrop.transition?{transition:stage.backdrop.transition}:{}),...(a.gm?{fileId:stage.backdrop.fileId}:{})}:null,stageSceneId:a.gm?stage.sceneId||'':undefined,
  objects:stage.objects.filter(o=>stageVisible(o,a)),board:room.elements,boardEpoch:room.epoch,boardLocked:!!room.boardLocked,
  crew:members.filter(m=>room.participants?.includes(m.id)).map(m=>({...m,avatar:m.hasAvatar?'/api/live-participants?view=avatar&sessionId='+encodeURIComponent(sessionId)+'&memberId='+encodeURIComponent(m.id):null,presence:participantPresence(m.id,room.peers,room.away),initials:m.name.split(/\s+/).map(s=>s[0]).join('').slice(0,2),role:m.id===a.id?(a.gm?'Spielleitung':'Spieler'):'Teilnehmer'})),scenes,moreScenes,catalog,
  dice:{sessionId:room.runId!,revision:diceRevision,events:diceEvents},
  // Character condition values: own and explicitly released characters only; GM sees the whole table.
  vitals,
  // Table-wide atmosphere and pager messages. Players get only their own pagers, without the recipient list.
  effects:stage.effects||[],
  music:stage.music?{title:stage.music.title,key:stage.music.key,...(a.gm?{fileId:stage.music.fileId}:{})}:null,
  // YouTube music runs for the whole round; every viewer loads the embed only after their own consent.
  // Players get only the play state: current track, playlist ids for looping, play/pause and the base volume.
  youtube:stage.youtube?(()=>{const p=youtubePlaylist(stage.youtube);return {videoId:stage.youtube.videoId,title:stage.youtube.title,key:stage.youtube.key,tracks:p.tracks,index:p.index,playing:p.playing,volume:p.volume,label:p.label};})():null,
  // Players learn only whether they themselves read and acknowledged; GMs get recipients, all reads and acknowledgements.
  notice:stage.notice||null,
  pagers:(stage.pagers||[]).filter(p=>pagerVisible(p,a)).map(p=>a.gm?p:{id:p.id,text:p.text,at:p.at,...(p.title?{title:p.title}:{}),...(p.sender?{sender:p.sender}:{}),...(p.priority?{priority:p.priority}:{}),read:!!p.reads?.some(x=>x.id===a.id)||!!p.acks?.some(x=>x.id===a.id),acknowledged:!!p.acks?.some(x=>x.id===a.id)})};
}
export async function stageMutation(a:Actor,sessionId:string,runId:string,expectedVersion:number,c:StageCommand){
 const {row,room}=await stageRoom(a,sessionId),state=storedStage(room);
 if(runId!==room.runId||state.version!==expectedVersion)throw new HttpError(409,'Die Bühne wurde inzwischen geändert. Bitte aktualisieren.');
 if(c.action==='take'||c.action==='play'||c.action==='reclaim')return pocketMutation(a,row,runId,state,c);
 if(c.action==='add'&&c.sourceId?.startsWith('scene-whisper:'))gmOnly(a);
 // A prepared material exists once: while a player carries it, it cannot be laid out a second time.
 if(c.action==='add'&&c.sourceId?.startsWith('scene-material:')){const holder=(await pocketHolders(a,[c.sourceId])).get(c.sourceId);if(holder)throw new HttpError(409,'Dieses Material trägt gerade '+holder.name+' bei sich. Hol es in der Regie zurück, um es neu aufzulegen.');}
 if((c.action==='visibility'||c.action==='add'||c.action==='pager')&&c.recipients?.length){const eligible=(await liveMembers(a)).filter(m=>room.participants?.includes(m.id));if(c.recipients.some(id=>!eligible.some(m=>m.id===id)))throw new HttpError(400,'Zielperson ist nicht in dieser Runde.');}
 const source=c.action==='add'&&c.kind!=='note'?await stageSource(a,c.sourceId||'',c.sourceKind||'entity'):undefined;
 if(c.action==='add'&&source&&'presentation' in source&&source.presentation){
  if(c.sourceVersion!==source.sourceVersion)throw new HttpError(409,'Die Vorbereitung wurde geaendert. Lade die Regie neu.');
  c={...c,visible:true,recipients:source.recipients};
  const eligible=(await liveMembers(a)).filter(m=>room.participants?.includes(m.id));
  if(source.recipients.some(id=>!eligible.some(m=>m.id===id)))throw new HttpError(400,'Ein vorbereiteter Empfänger nimmt nicht an dieser Runde teil. Passe die Vorbereitung an.');
 }
 if(c.action==='add'&&source&&source.kind!==c.kind)throw new HttpError(400,'Objekttyp passt nicht zur Quelle.');
 let backdrop:StageBackdrop|null=null,scenePlaylist:{tracks:{videoId:string;title:string}[];label:string}|null=null;
 if(c.action==='backdrop'||c.action==='activateScene'){
  gmOnly(a);
  const sceneDocument=c.action==='activateScene'?(await readScene(database(),a,c.sceneId)).document:null;
  if(sceneDocument?.youtube?.length)scenePlaylist={tracks:sceneDocument.youtube.map(t=>({videoId:t.videoId,title:t.title||'Ambiente'})),label:sceneDocument.title};
  const fileId=c.action==='backdrop'?c.fileId:sceneDocument?.backdropFileId||null;
  const sceneId=c.action==='activateScene'?c.sceneId:state.sceneId||'';
  // The stage image always comes from the running scene: its Szenenbild or one of its prepared backdrop materials.
  if(c.action==='backdrop'&&fileId){
   const running=sceneId?(await readScene(database(),a,sceneId).catch(()=>null))?.document:null;
   const allowed=running?[running.backdropFileId,...running.elements.flatMap(e=>e.material?.type==='backdrop'?e.material.files.map(f=>f.fileId):[])].filter(Boolean):[];
   if(!allowed.includes(fileId))throw new HttpError(400,'Das Bühnenbild kommt immer aus der laufenden Szene. Starte die passende Szene oder lege das Bild als Szenenbild fest.');
  }
  if(fileId){const f=await liveFile(a,fileId);if(!f.mime.startsWith('image/'))throw new HttpError(400,'Das Szenenbild muss ein Bild sein.');backdrop={fileId:f.id,title:f.name,sceneId,...(c.action==='backdrop'&&c.transition&&c.transition!=='fade'?{transition:c.transition}:{})};}
 }
 let music:StageMusic|null=null;
 if(c.action==='music'&&c.fileId){
  gmOnly(a);const f=await liveFile(a,c.fileId);if(!f.mime.startsWith('audio/'))throw new HttpError(400,'Hintergrundmusik muss eine Audiodatei sein.');
  // A fresh key per start lets every player restart the track, even when the same file is chosen again.
  music={fileId:f.id,title:f.name,key:crypto.randomUUID().replaceAll('-','').slice(0,16)};
 }
 let next:StageState;try{next=changeStageObjects(state,a,c,source,backdrop,music);}catch(e){if(e instanceof Error&&'status' in e)throw new HttpError(Number(e.status),e.message);throw new HttpError(400,'Ungültige Bühnenaktion.');}
 // Starting a scene with a prepared playlist starts it for everyone (it loops); without one the current music keeps playing.
 if(c.action==='activateScene'&&scenePlaylist)next=startYoutube(next,scenePlaylist.tracks,{label:scenePlaylist.label,sceneId:c.sceneId});
 const sourceGuard=source?.sourceKind==='record'&&!source.sourceId.startsWith('scene-material:')&&!source.sourceId.startsWith('scene-whisper:')?" AND EXISTS (SELECT 1 FROM records prepared WHERE prepared.id=? AND prepared.campaign_id=? AND prepared.owner_id=? AND prepared.version=?)":"";
 const sourceBindings=sourceGuard&&source?[source.sourceId,a.campaignId,a.id,source.sourceVersion!]:[];
 const whisperGuard=source&&'presentation' in source&&source.presentation?" AND EXISTS (SELECT 1 FROM entities prepared WHERE prepared.id=? AND prepared.campaign_id=? AND prepared.version=?)":'';
 const whisperBindings=whisperGuard&&source?[source.sourceId.slice(14,source.sourceId.lastIndexOf(':')),a.campaignId,source.sourceVersion!]:[];
 const result=await database().prepare("UPDATE records SET body=json_set(body,'$.stage',json(?)),version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND version=? AND json_extract(body,'$.runId')=? AND json_extract(body,'$.open')=1"+sourceGuard+whisperGuard).bind(JSON.stringify(next),new Date().toISOString(),row.id,a.campaignId,row.version,runId,...sourceBindings,...whisperBindings).run();
 if(!result.meta.changes)throw new HttpError(409,'Spielstand inzwischen geändert. Deine Änderung wurde nicht überschreibend gespeichert.');
}
type StageRow=Awaited<ReturnType<typeof stageRoom>>['row'];
async function saveStage(a:Actor,row:StageRow,runId:string,next:StageState){
 const result=await database().prepare("UPDATE records SET body=json_set(body,'$.stage',json(?)),version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND version=? AND json_extract(body,'$.runId')=? AND json_extract(body,'$.open')=1").bind(JSON.stringify(next),new Date().toISOString(),row.id,a.campaignId,row.version,runId).run();
 if(!result.meta.changes)throw new HttpError(409,'Spielstand inzwischen geändert. Deine Änderung wurde nicht überschreibend gespeichert.');
}
/**
 * Pocketing (see material-pocket.ts). take: a player puts a released, pocketable material into their inventory and
 * it leaves the table. play: the holder lays it on the table again (owned by them, for the whole round). reclaim:
 * the GM takes a carried material back. Every step undoes its inventory part if the table could not be saved.
 */
async function pocketMutation(a:Actor,row:StageRow,runId:string,state:StageState,c:Extract<StageCommand,{action:'take'|'play'|'reclaim'}>){
 const notice=(text:string)=>({id:crypto.randomUUID().replaceAll('-','').slice(0,16),text:text.slice(0,240),at:new Date().toISOString()});
 if(c.action==='reclaim'){gmOnly(a);await archivePocket(a,c.itemId);return;}
 if(c.action==='take'){
  const o=state.objects.find(x=>x.id===c.id&&stageVisible(x,a));
  if(!o||o.kind==='note'||!o.material)throw new HttpError(404,'Dieses Material liegt nicht mehr auf dem Tisch.');
  if(o.material.takeable===false)throw new HttpError(403,'Dieses Material kann man nicht einstecken.');
  if(o.visibility!=='group')throw new HttpError(403,'Dieses Material ist noch nicht freigegeben.');
  const {itemId,characterName}=await pocketItem(a,o);
  const next=stageSchema.parse({...state,version:state.version+1,objects:state.objects.filter(x=>x.id!==o.id),notice:notice(characterName+' hat „'+o.title+'“ eingesteckt.')});
  try{await saveStage(a,row,runId,next);}catch(e){await removePocket(a,itemId);throw e;}
  return;
 }
 if(a.gm)throw new HttpError(403,'Eingesteckte Gegenstände legt nur ihr Besitzer aus.');
 const item=await pocketRow(a,c.itemId);
 if(item.owner_id!==a.id)throw new HttpError(404,'Eingesteckter Gegenstand nicht gefunden.');
 const s=pocketSnapshot(item)!;
 const holder=(await database().prepare("SELECT title FROM records WHERE id=json_extract(?,'$.characterId') AND campaign_id=?").bind(item.body,a.campaignId).first<{title:string}>())?.title||'Jemand';
 const placed={...s,id:crypto.randomUUID(),rect:{x:.39,y:.28,w:.22,h:.36},visibility:'group' as const,recipients:null,ownerId:a.id};
 const next=stageSchema.parse({...state,version:state.version+1,objects:[...state.objects,placed],notice:notice(holder+' legt „'+s.title+'“ auf den Tisch.')});
 await archivePocket(a,c.itemId);
 try{await saveStage(a,row,runId,next);}catch(e){await restorePocket(a,c.itemId);throw e;}
}
export async function stageAsset(a:Actor,sessionId:string,objectId:string,catalogId?:string,page?:number,extra:{state?:string;sound?:boolean}={}):Promise<{fileId?:string;path?:string;text?:string;title:string;pages?:{title:string}[]}>{
 const {room}=await stageRoom(a,sessionId);let o:Exclude<StageObject,{kind:'note'}>|undefined;
 if(objectId==='backdrop'&&!catalogId){const b=storedStage(room).backdrop;if(!b)throw new HttpError(404,'Kein Szenenbild aktiv.');return {fileId:b.fileId,title:b.title};}
 // Background music belongs to the whole round, like the backdrop.
 if(objectId==='music'&&!catalogId){const m=storedStage(room).music;if(!m)throw new HttpError(404,'Keine Hintergrundmusik aktiv.');return {fileId:m.fileId,title:m.title};}
 if(catalogId){gmOnly(a);const s=await stageSource(a,catalogId,'entity');o={id:'preview',...s,rect:{x:0,y:0,w:.2,h:.4},visibility:'sl',recipients:null};}
 else {const found=storedStage(room).objects.find(o=>o.id===objectId&&stageVisible(o,a));if(found&&found.kind!=='note')o=found;}
 if(!o)throw new HttpError(404,'Bühnenobjekt nicht verfügbar.');
 // Display asset states and the effect sound of a material are served through the visible object only.
 if(extra.state!==undefined||extra.sound){
  const fileId=extra.sound?o.material?.soundFileId:o.material?.states.find(s=>s.key===extra.state)?.fileId;
  if(!fileId)throw new HttpError(404,'Darstellung nicht verfügbar.');return {fileId,title:o.title};
 }
 if(o.sourceKind==='record'){if(o.pages?.length){if(page===undefined)return {title:o.title,pages:o.pages.map(p=>({title:p.title})),text:o.documentContent};const p=o.pages[page];if(!p)throw new HttpError(404,'Handoutseite nicht verfügbar.');return {fileId:p.fileId,title:p.title||o.title};}if(page!==undefined)throw new HttpError(404,'Dieses Dokument hat keine Einzelseiten.');if(o.sourceFileId)return {fileId:o.sourceFileId,title:o.title};return {text:o.documentContent||'',title:o.title};}
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
