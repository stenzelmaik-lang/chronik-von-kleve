/** Character checks (GE-01C/GE-02). Gated per campaign and evening by checksAvailable/checksActive (protected live alpha);
 * without GE01_ALPHA_CAMPAIGNS outside the isolated local instance every command answers 404. */
import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {database,gmOnly,HttpError,type Actor} from './access';
import {liveMembers,isGmMembership} from './live-game';
import {stageRoom} from './live-stage';
import {previewCharacter,w10Preview} from './w10-preview';
import {readScene} from './story-scenes';
import {liveAudience,liveRoll} from '@/domain/live-game';
import {deriveW10Preview} from '@/domain/w10-selection';
import {resolveC1OrdinaryCheck} from '@/domain/w10-c1-ordinary';
import {W10_ATTRIBUTE_KEYS,W10_ABILITY_KEYS} from '@/domain/trait-ids';
import {registerEntry,unreleasedModifiers} from '@/domain/w10-modifier-register';
import {checksAvailable,checksActive,type ChecksGateEnv} from '@/domain/live-checks';

const gateEnv=()=>env as unknown as ChecksGateEnv;
export function liveChecksAvailable(a:Actor){return checksAvailable(gateEnv(),a.campaignId);}
export function liveChecksActive(a:Actor,room:Parameters<typeof checksActive>[2]){return checksActive(gateEnv(),a.campaignId,room);}
const uuid=z.string().uuid();
const common={sessionId:z.string().min(1).max(160),runId:uuid,eventId:uuid};
const requestSchema=z.object({...common,action:z.literal('requestCheck'),title:z.string().trim().min(1).max(160),attributeId:z.string().min(1).max(40).optional(),abilityId:z.string().min(1).max(80).optional(),difficulty:z.number().int().min(2).max(10),audience:z.union([z.object({scope:z.literal('all')}).strict(),z.object({scope:z.literal('players'),playerIds:z.array(z.string()).min(1).max(30)}).strict()]).optional(),sceneId:z.string().min(1).max(100).optional(),gmHints:z.string().max(2000).optional(),
 // GE-02: a check may name figures instead of players; the server derives the players from the characters' owners.
 targetCharacterIds:z.array(z.string().min(1).max(100)).min(1).max(30).refine(v=>new Set(v).size===v.length,'Figur doppelt.').optional(),preparedId:z.string().uuid().optional(),
 consequences:z.object({success:z.string().trim().max(1000),failure:z.string().trim().max(1000),botch:z.string().trim().max(1000)}).strict().optional()}).strict().refine(d=>!!d.audience!==!!d.targetCharacterIds,'Entweder Zielgruppe oder Zielfiguren angeben.');
const rollSchema=z.object({...common,action:z.literal('rollCheck'),requestId:uuid,characterId:z.string().min(1).max(100),selection:z.object({attributeId:z.string().min(1).max(40),abilityId:z.string().min(1).max(80).optional(),specialtyId:z.string().regex(/^spec_[A-Za-z0-9-]{8,64}$/).optional()}).strict()}).strict();
const roomKey=(a:Actor,sessionId:string)=>`live-table:${a.campaignId}:${sessionId}`;
const eventKey=(eventId:string)=>`live-event:${eventId}`;
type Row={body:string};
async function prior(a:Actor,eventId:string){return database().prepare('SELECT body FROM records WHERE id=? AND campaign_id=?').bind(eventKey(eventId),a.campaignId).first<Row>();}
function replay(row:Row|undefined|null,a:Actor,request:string){if(!row)return false;const old=JSON.parse(row.body);if(old.authorId!==a.id||old.request!==request)throw new HttpError(409,'Ereigniskennung bereits anders verwendet.');return true;}
async function rateLimit(a:Actor){const r=await database().prepare("SELECT count(*) n FROM (SELECT id FROM records WHERE campaign_id=? AND owner_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table-event' AND created_at>? LIMIT 31)").bind(a.campaignId,a.id,new Date(Date.now()-60000).toISOString()).first<{n:number}>();if((r?.n||0)>=30)throw new HttpError(429,'Zu viele Live-Aktionen. Bitte kurz warten.');}

const previewSchema=z.object({action:z.literal('previewCheck'),sessionId:z.string().min(1).max(160),runId:uuid,requestId:uuid,characterId:z.string().min(1).max(100),selection:z.object({attributeId:z.string().min(1).max(40),abilityId:z.string().min(1).max(80).optional(),specialtyId:z.string().regex(/^spec_[A-Za-z0-9-]{8,64}$/).optional()}).strict()}).strict();
/** An issued check this player may roll right now, or 404/400; shared by the pool preview and the roll. */
function addressedCheck(a:Actor,body:string|undefined,d:{sessionId:string;runId:string;characterId:string;selection:{attributeId:string;abilityId?:string}}){
 if(!body)throw new HttpError(404,'Probenanforderung nicht verfügbar.');
 const issued=JSON.parse(body);
 if(issued.kind!=='check'||issued.sessionId!==d.sessionId||issued.runId!==d.runId||issued.hidden||issued.recipients!==null&&!issued.recipients.includes(a.id))throw new HttpError(404,'Probenanforderung nicht verfügbar.');
 if(Array.isArray(issued.targetCharacterIds)&&!issued.targetCharacterIds.includes(d.characterId))throw new HttpError(400,'Diese Probe gilt einer anderen Figur. Bitte die vorgesehene Figur auswählen.');
 if(issued.check.attributeId&&issued.check.attributeId!==d.selection.attributeId||issued.check.abilityId&&issued.check.abilityId!==d.selection.abilityId)throw new HttpError(400,'Bitte die von der SL vorgegebene Kombination wählen.');
 return issued as {check:{title:string;difficulty:number;attributeId?:string;abilityId?:string};recipients:string[]|null};
}
/** Read-only pool preview for exactly one issued, active, addressed check: the same server derivation as the roll.
 * Replaces the local-only W10 draft preview route for live checks, which stays behind its own local binding. */
async function previewCheck(a:Actor,userId:string,raw:unknown){
 if(a.gm)throw new HttpError(403,'Die Vorschau gilt der würfelnden Spielerin oder dem würfelnden Spieler.');
 const parsed=previewSchema.safeParse(raw);if(!parsed.success)throw new HttpError(400,'Ungültige Vorschau: '+parsed.error.issues[0].message);
 const d=parsed.data,{room}=await stageRoom(a,d.sessionId);
 if(room.runId!==d.runId)throw new HttpError(409,'Spielabend inzwischen gewechselt.');
 if(!liveChecksActive(a,room))throw new HttpError(409,'Charakterproben sind für diesen Spielabend ausgeschaltet.');
 const issued=addressedCheck(a,(await prior(a,d.requestId))?.body,d);
 return w10Preview(a,userId,d.sessionId,d.characterId,d.selection,{baseDifficulty:issued.check.difficulty});
}
const switchSchema=z.object({action:z.literal('setChecks'),sessionId:z.string().min(1).max(160),runId:uuid,enabled:z.boolean()}).strict();
/** The GM switches checks on or off for the running evening only. Stored rolls stay untouched either way. */
async function setChecks(a:Actor,raw:unknown){
 gmOnly(a);
 const parsed=switchSchema.safeParse(raw);if(!parsed.success)throw new HttpError(400,'Ungültiger Schalter: '+parsed.error.issues[0].message);
 const d=parsed.data,stamp=new Date().toISOString();
 const updated=await database().prepare("UPDATE records SET body=json_set(body,'$.checks',json(?)),version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table' AND json_extract(body,'$.runId')=? AND json_extract(body,'$.open')=1").bind(JSON.stringify({runId:d.runId,on:d.enabled}),stamp,roomKey(a,d.sessionId),a.campaignId,d.runId).run();
 if(!updated.meta.changes)throw new HttpError(409,'Spielabend beendet oder gewechselt.');
 return {ok:true,enabled:d.enabled};
}

export async function liveCheckCommand(a:Actor,userId:string,raw:unknown){
 if(!liveChecksAvailable(a))throw new HttpError(404,'Nicht gefunden.');
 const action=(raw as {action?:unknown})?.action;
 if(action==='setChecks')return setChecks(a,raw);
 if(action==='previewCheck')return previewCheck(a,userId,raw);
 if(action!=='requestCheck'&&action!=='rollCheck')throw new HttpError(400,'Unbekannte Probe.');
 const parsed=(action==='requestCheck'?requestSchema:rollSchema).safeParse(raw);
 if(!parsed.success)throw new HttpError(400,'Ungültige Probenaktion: '+parsed.error.issues[0].message);
 const d=parsed.data, {room}=await stageRoom(a,d.sessionId);
 if(room.runId!==d.runId)throw new HttpError(409,'Spielabend inzwischen gewechselt.');
 if(!liveChecksActive(a,room))throw new HttpError(409,'Charakterproben sind für diesen Spielabend ausgeschaltet.');
 const stamp=new Date().toISOString();
 if(d.action==='requestCheck'){
  gmOnly(a);
  if(d.attributeId&&!Object.hasOwn(W10_ATTRIBUTE_KEYS,d.attributeId)||d.abilityId&&!Object.hasOwn(W10_ABILITY_KEYS,d.abilityId))throw new HttpError(400,'Unbekannte Eigenschaft oder Fähigkeit.');
  // Only players at the table can be addressed; a second GM never becomes a target (the roll would be refused anyway).
  const members=(await liveMembers(a)).filter(m=>room.participants?.includes(m.id)&&!isGmMembership(m.membershipRole)&&m.id!==a.id).map(m=>m.id);
  let recipients:string[]|null;
  if(d.targetCharacterIds){
   const rows=(await database().prepare(`SELECT id,owner_id FROM records WHERE campaign_id=? AND kind='charaktere' AND id IN (${d.targetCharacterIds.map(()=>'?').join(',')})`).bind(a.campaignId,...d.targetCharacterIds).all<{id:string;owner_id:string}>()).results;
   if(rows.length!==d.targetCharacterIds.length||rows.some(r=>!members.includes(r.owner_id)))throw new HttpError(400,'Eine gewählte Figur gehört zu keinem Spieler an diesem Spielabend.');
   recipients=[...new Set(d.targetCharacterIds.map(id=>rows.find(r=>r.id===id)!.owner_id))];
  }else{try{recipients=liveAudience(d.audience!,members);}catch(e){throw new HttpError(400,(e as Error).message);}}
  const consequences=d.consequences&&(d.consequences.success||d.consequences.failure||d.consequences.botch)?d.consequences:undefined;
  if(d.sceneId){const scene=await readScene(database(),a,d.sceneId);if(scene.document.archived)throw new HttpError(409,'Szene archiviert.');}
  const request=JSON.stringify({action:d.action,runId:d.runId,title:d.title,attributeId:d.attributeId,abilityId:d.abilityId,difficulty:d.difficulty,recipients,sceneId:d.sceneId,gmHints:d.gmHints,targetCharacterIds:d.targetCharacterIds,preparedId:d.preparedId,consequences});
  if(replay(await prior(a,d.eventId),a,request))return {ok:true,eventId:d.eventId};
  await rateLimit(a);
  const event={context:'live-table-event',kind:'check',id:d.eventId,sessionId:d.sessionId,runId:d.runId,authorId:a.id,authorName:a.name,at:stamp,recipients,request,check:{title:d.title,difficulty:d.difficulty,...(d.attributeId?{attributeId:d.attributeId}:{}),...(d.abilityId?{abilityId:d.abilityId}:{}),...(d.sceneId?{sceneId:d.sceneId}:{})},...(d.gmHints?{gmHints:d.gmHints}:{}),...(consequences?{consequences}:{}),...(d.targetCharacterIds?{targetCharacterIds:d.targetCharacterIds}:{}),...(d.preparedId?{preparedId:d.preparedId}:{})};
  const inserted=await database().prepare("INSERT INTO records(id,campaign_id,owner_id,kind,visibility,title,body,gm_body,created_at,updated_at) SELECT ?,?,?,'notizen','private','Probenanforderung',?,'',?,? WHERE EXISTS(SELECT 1 FROM records WHERE id=? AND campaign_id=? AND json_extract(body,'$.runId')=? AND json_extract(body,'$.open')=1) ON CONFLICT(id) DO NOTHING").bind(eventKey(d.eventId),a.campaignId,a.id,JSON.stringify(event),stamp,stamp,roomKey(a,d.sessionId),a.campaignId,d.runId).run();
  if(!inserted.meta.changes&&!replay(await prior(a,d.eventId),a,request))throw new HttpError(409,'Spielabend beendet oder Aktion kollidiert.');
  return {ok:true,eventId:d.eventId};
 }
 if(a.gm)throw new HttpError(403,'Die Spielerin oder der Spieler würfelt die eigene Probe.');
 const request=JSON.stringify({action:d.action,runId:d.runId,requestId:d.requestId,characterId:d.characterId,selection:d.selection});
 if(replay(await prior(a,d.eventId),a,request))return {ok:true,eventId:d.eventId};
 const issued=addressedCheck(a,(await prior(a,d.requestId))?.body,d);
 const {row,body}=await previewCharacter(a,userId,d.sessionId,d.characterId);
 let preview;try{preview=deriveW10Preview(body,d.selection,{baseDifficulty:issued.check.difficulty},row.version);}catch{throw new HttpError(400,'Ungültige Eigenschaftenauswahl.');}
 if(preview.status==='blocked')throw new HttpError(409,'message' in preview&&typeof preview.message==='string'?preview.message:'Diese Probe ist mit dem aktuellen Bogen nicht möglich.');
 // GE-02: only released register entries may shape the pool; anything else stops the roll instead of silently counting.
 const unreleased=unreleasedModifiers(preview.provenance);if(unreleased.length)throw new HttpError(409,'Diese Probe enthält noch nicht freigegebene Regeln: '+unreleased.map(p=>registerEntry(p)?.label||p.label||p.id).join(', ')+'.');
 if(preview.pool.effective>30)throw new HttpError(409,'Mehr als 30 Würfel sind in diesem Wurfpfad noch nicht freigegeben.');
 await rateLimit(a);
 const roll=liveRoll(preview.pool.effective,preview.difficulty.effective);
 const resolved=resolveC1OrdinaryCheck(body,d.selection,{baseDifficulty:issued.check.difficulty},{rollId:d.eventId,characterVersion:row.version,faces:roll.dice});
 if(resolved.status!=='resolved'||resolved.costIntentions.length)throw new HttpError(409,'Diese Probe braucht Regeln, die am Spieltisch noch nicht freigegeben sind.');
 const e=resolved.result.evaluation;
 const report={rule:'v20-normal',target:roll.target,dice:roll.dice,rawSuccesses:e.rawSuccesses,ones:e.ones,cancelled:e.cancelled,netSuccesses:e.totalSuccesses,outcome:e.outcome,cancelledSuccessIndices:e.cancelledSuccessIndices};
 const event={context:'live-table-event',kind:'roll',id:d.eventId,sessionId:d.sessionId,runId:d.runId,authorId:a.id,authorName:a.name,at:stamp,recipients:issued.recipients,request,roll,report,animationSeed:Array.from(crypto.getRandomValues(new Uint32Array(4))),revision:1,checkRef:{requestId:d.requestId,characterId:d.characterId,characterVersion:row.version,selection:d.selection,provenance:preview.provenance,title:issued.check.title}};
 // The INSERT is the linearization point: one roll per request and character, even across concurrent tabs.
 const inserted=await database().prepare("INSERT INTO records(id,campaign_id,owner_id,kind,visibility,title,body,gm_body,created_at,updated_at) SELECT ?,?,?,'notizen','private','Live-Ereignis',json_set(?,'$.sequence',(SELECT COALESCE(MAX(json_extract(body,'$.sequence')),0)+1 FROM records WHERE campaign_id=? AND json_valid(body) AND json_extract(body,'$.context')='live-table-event' AND json_extract(body,'$.sessionId')=? AND json_extract(body,'$.runId')=? AND json_extract(body,'$.kind')='roll')),'',?,? WHERE EXISTS(SELECT 1 FROM records WHERE id=? AND campaign_id=? AND json_extract(body,'$.runId')=? AND json_extract(body,'$.open')=1) AND EXISTS(SELECT 1 FROM records WHERE id=? AND campaign_id=? AND json_extract(body,'$.runId')=? AND json_extract(body,'$.kind')='check') AND EXISTS(SELECT 1 FROM records WHERE id=? AND campaign_id=? AND version=? AND owner_id=? AND kind='charaktere') AND EXISTS(SELECT 1 FROM auth_profiles WHERE user_id=? AND json_extract(preferences,?)=?) AND NOT EXISTS(SELECT 1 FROM records WHERE campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table-event' AND json_extract(body,'$.runId')=? AND json_extract(body,'$.checkRef.requestId')=? AND json_extract(body,'$.checkRef.characterId')=?) AND (SELECT count(*) FROM records WHERE campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table-event' AND json_extract(body,'$.sessionId')=? AND json_extract(body,'$.runId')=? AND json_extract(body,'$.kind')='roll')<500 ON CONFLICT(id) DO NOTHING").bind(eventKey(d.eventId),a.campaignId,a.id,JSON.stringify(event),a.campaignId,d.sessionId,d.runId,stamp,stamp,roomKey(a,d.sessionId),a.campaignId,d.runId,eventKey(d.requestId),a.campaignId,d.runId,d.characterId,a.campaignId,row.version,a.id,userId,'$.activeCharacters.'+JSON.stringify(a.campaignId),d.characterId,a.campaignId,d.runId,d.requestId,d.characterId,a.campaignId,d.sessionId,d.runId).run();
 if(!inserted.meta.changes){if(replay(await prior(a,d.eventId),a,request))return {ok:true,eventId:d.eventId};throw new HttpError(409,'Diese Probe wurde bereits gewürfelt oder der Spielabend wurde beendet.');}
 return {ok:true,eventId:d.eventId};
}
