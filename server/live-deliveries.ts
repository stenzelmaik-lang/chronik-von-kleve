import {database,gmOnly,HttpError,type Actor} from './access';
import {readLiveRoom,liveMembers,roomCrew,isGmMembership} from './live-game';
import {readScene} from './story-scenes';
import {validatePreparationMedia} from './preparation-media';
import {readSetting,mutateSetting} from './settings-store';
import {richTextFileIds,richTextToPlainText} from '@/domain/location-rich-text';
import {visionFragments,resolveRecipients,playerDeliveries,presetById,type DeliveryRun,type RecipientChoice,type MessageLayoutId} from '@/domain/personal-delivery';

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

export type DeliveryCommand=
 |{action:'deliver';sessionId:string;requestId:string;sceneId:string;whisperId:string;sceneVersion?:number;recipients:RecipientChoice}
 |{action:'withdraw';sessionId:string;runId:string}
 |{action:'seen'|'ack';sessionId:string;runId:string};

export async function changeDeliveries(a:Actor,c:DeliveryCommand){
 const k=key(a.campaignId,c.sessionId);
 if(c.action==='deliver'){
  gmOnly(a);
  const eligible=await players(a,c.sessionId);
  const scene=await readScene(database(),a,c.sceneId);
  if(c.sceneVersion!==undefined&&c.sceneVersion!==scene.version)throw new HttpError(409,'Die Vorbereitung wurde inzwischen geändert. Lade die Regie neu.');
  const w=scene.document.whispers.find(x=>x.id===c.whisperId);
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
   title:w.title,sender:w.sender||'',fragments,html:w.text,imageFileIds,audioFileId:w.audioFileId||null,recipients,createdAt:stamp,createdBy:a.id,withdrawnAt:null,receipts:{}};
  const state=await mutate(k,s=>{
   if(s.requests.includes(c.requestId))return s; // double click, retry or a late duplicate: nothing new
   if(s.runs.length>=MAX_RUNS)throw new HttpError(409,`Höchstens ${MAX_RUNS} Zustellungen je Spielabend.`);
   return {rev:s.rev+1,runs:[...s.runs,run],requests:[...s.requests,c.requestId].slice(-60)};
  });
  return {runs:state.runs};
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
