import {database,gmOnly,HttpError,type Actor} from './access';
import {readLiveRoom,liveMembers,roomCrew,isGmMembership} from './live-game';
import {readScene,executeScene} from './story-scenes';
import {sceneCommandSchema,type SceneWhisper} from '@/domain/story-scene';
import {validatePreparationMedia} from './preparation-media';
import {readSetting,mutateSetting} from './settings-store';
import {richTextFileIds,richTextToPlainText} from '@/domain/location-rich-text';
import {visionFragments,resolveRecipients,playerDeliveries,presetById,tempoById,arrivalSoundOf,type DeliveryRun,type RecipientChoice,type MessageLayoutId,type PlayerDelivery} from '@/domain/personal-delivery';

/**
 * Delivery runs of one evening (visions & personal messages). Preparation stays in the scene; a trigger copies the
 * prepared content into a run, so later edits never change what a player already received. Each recipient has an
 * own receipt (seen, acknowledged). Stored in `settings`, scoped by campaign and evening.
 */
type State={rev:number;runs:DeliveryRun[];requests:string[]};
const key=(campaignId:string,sessionId:string)=>`live-deliveries:${campaignId}:${sessionId}`;
const empty=():State=>({rev:0,runs:[],requests:[]});
const parse=(raw:string|null):State=>{try{const s=raw?JSON.parse(raw):null;return s&&Array.isArray(s.runs)?{rev:Number(s.rev)||0,runs:s.runs,requests:Array.isArray(s.requests)?s.requests:[]}:empty();}catch{return empty();}};
const mutate=(k:string,apply:(s:State)=>State)=>mutateSetting(k,parse,apply,'Die Zustellung wurde gleichzeitig geändert. Bitte erneut versuchen.');
const MAX_RUNS=300;

async function players(a:Actor,sessionId:string){
 const {room}=await readLiveRoom(a,sessionId);
 return roomCrew(room,await liveMembers(a)).filter(m=>!isGmMembership(m.membershipRole)).map(m=>m.id);
}
async function runs(a:Actor,sessionId:string){return parse(await readSetting(key(a.campaignId,sessionId))).runs;}

/** GM overview: every run with its receipts. */
export async function listDeliveries(a:Actor,sessionId:string){gmOnly(a);await readLiveRoom(a,sessionId);return {runs:await runs(a,sessionId)};}

/** A player's own active deliveries for the stage snapshot. Nothing of other players, no internal title. */
export async function deliveriesForViewer(a:Actor,sessionId:string){
 if(a.gm)return undefined;
 return playerDeliveries(await runs(a,sessionId),a.id);
}

/**
 * GM preview relay: the Regie leaves the entry for the GM's own table, which plays it with the player's presentation.
 * Separate from delivery: no run, no receipt, never in a player's snapshot; one short-lived value per GM and evening.
 */
export type TablePreview={id:string;delivery:PlayerDelivery;recipientName:string;createdAt:string};
const previewKey=(campaignId:string,sessionId:string,memberId:string)=>`live-preview:${campaignId}:${sessionId}:${memberId}`;
const PREVIEW_MS=60_000;
function previewOf(w:SceneWhisper,id:string,createdAt:string):PlayerDelivery{
 const images=[...new Set([...w.fileIds,...richTextFileIds(w.text)])].slice(0,20);
 return {id,kind:w.kind,preset:presetById(w.preset).id,layout:(w.layout||'fax') as MessageLayoutId,sender:w.sender||'',
  fragments:w.kind==='vision'?visionFragments(w.fragments,richTextToPlainText(w.text)):[],html:w.text,images,audio:!!w.audioFileId,audioFileId:w.audioFileId||null,
  tempo:tempoById(w.tempo).id,arrivalSound:arrivalSoundOf(w.kind,w.layout||'fax',w.sound,w.audioFileId),createdAt,seen:true};
}
export async function previewForViewer(a:Actor,sessionId:string):Promise<TablePreview|undefined>{
 if(!a.gm)return undefined;
 try{const p=JSON.parse(await readSetting(previewKey(a.campaignId,sessionId,a.id))||'null') as TablePreview|null;return p&&Date.now()-Date.parse(p.createdAt)<PREVIEW_MS?p:undefined;}catch{return undefined;}
}

export type DeliveryCommand=
 |{action:'deliver';sessionId:string;requestId:string;sceneId:string;whisperId:string;sceneVersion?:number;recipients:RecipientChoice}
 /** spontaneous entry from the Regie: delivered right away, optionally kept in the scene for later */
 |{action:'compose';sessionId:string;requestId:string;sceneId:string;entry:SceneWhisper;recipients:RecipientChoice;save:boolean}
 /** create or edit an entry of the scene from the Regie, without delivering it */
 |{action:'save-entry';sessionId:string;sceneId:string;entry:SceneWhisper}
 /** delete an entry: out of the scene (if it is there) and its runs out of the list; open runs end for the players */
 |{action:'remove-entry';sessionId:string;sceneId:string;whisperId:string}
 /** play an entry on the GM's own table only */
 |{action:'preview';sessionId:string;previewId:string;entry:SceneWhisper;recipientName:string}
 |{action:'withdraw';sessionId:string;runId:string}
 |{action:'seen'|'ack';sessionId:string;runId:string};

/** Replace the entry with the same id or append it; the rest of the scene stays as it is now on the server. */
async function saveEntry(a:Actor,sceneId:string,entry:SceneWhisper){
 const db=database(),scene=await readScene(db,a,sceneId);
 const list=scene.document.whispers;
 const whispers=list.some(w=>w.id===entry.id)?list.map(w=>w.id===entry.id?entry:w):[...list,entry];
 const command=sceneCommandSchema.safeParse({action:'save',id:scene.id,version:scene.version,document:{...scene.document,whispers}});
 if(!command.success)throw new HttpError(400,list.length>=100?'Diese Szene hat bereits 100 vorbereitete Inhalte.':'Dieser Inhalt kann so nicht gespeichert werden.');
 return executeScene(db,a,command.data);
}
const sceneView=(s:{id:string;version:number;document:{whispers:SceneWhisper[]}})=>({id:s.id,version:s.version,whispers:s.document.whispers});

export async function changeDeliveries(a:Actor,c:DeliveryCommand){
 const k=key(a.campaignId,c.sessionId);
 if(c.action==='save-entry'){
  gmOnly(a);await readLiveRoom(a,c.sessionId);
  return {scene:sceneView(await saveEntry(a,c.sceneId,c.entry))};
 }
 if(c.action==='preview'){
  gmOnly(a);await readLiveRoom(a,c.sessionId);
  const stamp=new Date().toISOString();
  const preview:TablePreview={id:c.previewId,delivery:previewOf(c.entry,c.previewId,stamp),recipientName:c.recipientName,createdAt:stamp};
  await mutateSetting<TablePreview|null>(previewKey(a.campaignId,c.sessionId,a.id),()=>null,()=>preview);
  return {preview:{id:preview.id}};
 }
 if(c.action==='remove-entry'){
  gmOnly(a);await readLiveRoom(a,c.sessionId);
  const db=database(),scene=await readScene(db,a,c.sceneId);
  let saved:Awaited<ReturnType<typeof readScene>>|null=null;
  if(scene.document.whispers.some(w=>w.id===c.whisperId)){
   const command=sceneCommandSchema.safeParse({action:'save',id:scene.id,version:scene.version,document:{...scene.document,whispers:scene.document.whispers.filter(w=>w.id!==c.whisperId)}});
   if(!command.success)throw new HttpError(400,'Dieser Eintrag kann so nicht gelöscht werden.');
   saved=await executeScene(db,a,command.data);
  }
  const state=await mutate(k,s=>s.runs.some(r=>r.whisperId===c.whisperId)?{...s,rev:s.rev+1,runs:s.runs.filter(r=>r.whisperId!==c.whisperId)}:s);
  return {runs:state.runs,...(saved?{scene:sceneView(saved)}:{})};
 }
 if(c.action==='deliver'||c.action==='compose'){
  gmOnly(a);
  const eligible=await players(a,c.sessionId);
  let scene=await readScene(database(),a,c.sceneId),saved=false;
  let w:SceneWhisper|undefined;
  if(c.action==='compose'){
   // saved first: a retry with the same request id replaces the same entry and never delivers twice
   if(c.save){scene=await saveEntry(a,c.sceneId,c.entry);saved=true;}
   w=c.entry;
  }else{
   if(c.sceneVersion!==undefined&&c.sceneVersion!==scene.version)throw new HttpError(409,'Die Vorbereitung wurde inzwischen geändert. Lade die Regie neu.');
   w=scene.document.whispers.find(x=>x.id===c.whisperId);
  }
  if(!w)throw new HttpError(404,'Vorbereiteter Inhalt nicht gefunden.');
  let recipients:string[];
  try{recipients=resolveRecipients(c.recipients,w.recipientIds,eligible);}catch(e){throw new HttpError(400,(e as Error).message);}
  const imageFileIds=[...new Set([...w.fileIds,...richTextFileIds(w.text)])].slice(0,20);
  await validatePreparationMedia(database(),a,[w.text],[...w.fileIds.map(id=>({id,kind:'image'})),...(w.audioFileId?[{id:w.audioFileId,kind:'audio'}]:[])]);
  const plain=richTextToPlainText(w.text);
  const fragments=w.kind==='vision'?visionFragments(w.fragments,plain):[];
  if(w.kind==='vision'&&!fragments.length&&!imageFileIds.length)throw new HttpError(400,'Diese Vision ist noch leer.');
  if(w.kind==='letter'&&!plain.trim()&&!imageFileIds.length)throw new HttpError(400,'Diese Botschaft ist noch leer.');
  const stamp=new Date().toISOString();
  const run:DeliveryRun={id:crypto.randomUUID(),whisperId:w.id,sceneId:scene.id,sceneVersion:scene.version,kind:w.kind,preset:presetById(w.preset).id,layout:(w.layout||'fax') as MessageLayoutId,
   title:w.title,sender:w.sender||'',fragments,html:w.text,imageFileIds,audioFileId:w.audioFileId||null,...(w.kind==='vision'?{tempo:tempoById(w.tempo).id}:{sound:w.sound||'builtin'}),recipients,createdAt:stamp,createdBy:a.id,withdrawnAt:null,receipts:{}};
  const state=await mutate(k,s=>{
   if(s.requests.includes(c.requestId))return s; // double click, retry or a late duplicate: nothing new
   if(s.runs.length>=MAX_RUNS)throw new HttpError(409,`Höchstens ${MAX_RUNS} Zustellungen je Spielabend.`);
   return {rev:s.rev+1,runs:[...s.runs,run],requests:[...s.requests,c.requestId].slice(-60)};
  });
  return {runs:state.runs,...(saved?{scene:sceneView(scene)}:{})};
 }
 if(c.action==='withdraw'){
  gmOnly(a);await readLiveRoom(a,c.sessionId);
  const state=await mutate(k,s=>{
   const run=s.runs.find(r=>r.id===c.runId);if(!run)throw new HttpError(404,'Zustellung nicht gefunden.');
   return run.withdrawnAt?s:{...s,rev:s.rev+1,runs:s.runs.map(r=>r.id===c.runId?{...r,withdrawnAt:new Date().toISOString()}:r)};
  });
  return {runs:state.runs};
 }
 // seen / ack: only the addressed player, only for the own receipt; repeated calls change nothing.
 await readLiveRoom(a,c.sessionId);
 const stamp=new Date().toISOString();
 await mutate(k,s=>{
  const run=s.runs.find(r=>r.id===c.runId);
  if(!run||!run.recipients.includes(a.id))throw new HttpError(404,'Zustellung nicht gefunden.');
  const r=run.receipts[a.id]??{};
  if(c.action==='seen'?r.seenAt:r.ackAt)return s;
  const next={...r,seenAt:r.seenAt||stamp,...(c.action==='ack'?{ackAt:stamp}:{})};
  return {...s,rev:s.rev+1,runs:s.runs.map(x=>x.id===run.id?{...x,receipts:{...x.receipts,[a.id]:next}}:x)};
 });
 return {ok:true};
}

/** A picture or the sound of one delivery: GM, or the addressed player while the delivery is active for them. */
export async function deliveryAsset(a:Actor,sessionId:string,runId:string,fileId:string){
 await readLiveRoom(a,sessionId);
 const run=(await runs(a,sessionId)).find(r=>r.id===runId);
 if(!run)throw new HttpError(404,'Medium nicht verfügbar.');
 if(!a.gm&&(!run.recipients.includes(a.id)||run.withdrawnAt||run.receipts[a.id]?.ackAt))throw new HttpError(404,'Medium nicht verfügbar.');
 if(!run.imageFileIds.includes(fileId)&&run.audioFileId!==fileId)throw new HttpError(404,'Medium nicht verfügbar.');
 return {fileId};
}
