import {database,gmOnly,HttpError,canRead,type Actor} from './access';
import {saveEngine} from './character-engine-service';
import {liveMembers,type LiveRoom} from './live-game';
import type {LegacyRecordRow} from '@/domain/legacy';
import {activeCharacterBody} from '@/domain/character-selection';
import {readVitals,applyVitals,mayOperate,allowedOperations,applyTableVitals,tableVitalsSchema,emptyTableVitals,stressBand,masqueradeView,masqueradeRisk,roundViewOf,damageByOf,VitalsError,type VitalsCommand,type TableCommand,type TableVitals,type CharacterVitals} from '@/domain/character-vitals';

const stateKey=(campaignId:string)=>'table-vitals:'+campaignId;
const personalStress=(state:TableVitals,id:string)=>{const value=state.personal?.[id]??0;return {value,label:stressBand(value).label};};
export async function readTableVitals(campaignId:string):Promise<TableVitals>{
 const row=await database().prepare('SELECT value FROM settings WHERE key=?').bind(stateKey(campaignId)).first<{value:string}>();
 if(!row)return emptyTableVitals();
 let value:unknown;try{value=JSON.parse(row.value);}catch{throw new HttpError(409,'Gespeicherte Zustandswerte nicht lesbar. Daten bleiben erhalten.');}
 const parsed=tableVitalsSchema.safeParse(value);if(!parsed.success)throw new HttpError(409,'Gespeicherte Zustandswerte nicht unterstützt. Daten bleiben erhalten.');
 return parsed.data;
}

type TableCharacter={row:LegacyRecordRow;body:Record<string,unknown>};
/**
 * Spielfähige Charaktere der Teilnehmenden dieses Abends: aktiv, nicht SL-geheim, kein Entwurf in Prüfung.
 * Hat eine Person eine aktive Figur gewählt, zählt nur diese.
 */
async function tableCharacters(a:Actor,room:LiveRoom):Promise<TableCharacter[]>{
 const db=database(),members=await liveMembers(a),participants=members.map(m=>m.id);
 if(!participants.length)return [];
 const marks=participants.map(()=>'?').join(',');
 const [rows,preferences]=await Promise.all([
  db.prepare(`SELECT r.* FROM records r JOIN entities e ON e.id=r.id AND e.campaign_id=r.campaign_id WHERE r.campaign_id=? AND r.kind='charaktere' AND e.canon_status<>'GM_SECRET' AND r.owner_id IN (${marks}) ORDER BY r.title`).bind(a.campaignId,...participants).all<LegacyRecordRow>(),
  db.prepare(`SELECT l.member_id AS memberId,p.preferences FROM auth_member_links l JOIN auth_profiles p ON p.user_id=l.auth_user_id WHERE l.member_id IN (${marks})`).bind(...participants).all<{memberId:string;preferences:string}>(),
 ]);
 const chosen=new Map<string,string>();
 for(const p of preferences.results){try{const id=JSON.parse(p.preferences||'{}').activeCharacters?.[a.campaignId];if(typeof id==='string')chosen.set(p.memberId,id);}catch{/* ignore malformed preferences */}}
 const playable=rows.results.flatMap(row=>{
  let body:Record<string,unknown>;try{const parsed=JSON.parse(row.body);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return [];body=parsed;}catch{return [];}
  if(!activeCharacterBody(body)||body.canonStatus==='GM_SECRET')return [];
  if(body.engineVersion===1&&['draft','review'].includes(String(body.characterState)))return [];
  return [{row,body}];
 });
 return playable.filter(c=>{const pick=chosen.get(c.row.owner_id);return !pick||!playable.some(p=>p.row.id===pick)||pick===c.row.id;});
}

/**
 * Live overview of the round: only blood, willpower and damage per character, nothing else of the sheet.
 * With the round setting „für alle sichtbar“ (default) every participant receives all table characters;
 * otherwise players only get their own and explicitly released ones. What a player may not see is not sent.
 */
export type RoundEntry={id:string;title:string;ownerId:string;ownerName:string;own:boolean;blood:{current:number|null;max:number|null};willpower:{temporary:number|null;permanent:number|null};health:{track:CharacterVitals['health']['track'];level:string;status:CharacterVitals['health']['status'];penalty:number|null}};
export type TableCharacterView={id:string;title:string;ownerId:string;ownerName:string;own:boolean;shared:boolean;version:number;vitals:CharacterVitals;stress:{value:number;label:string}};
/** Snapshot-Teil der Zustandswerte. Spieler erhalten nur eigene und ausdrücklich freigegebene Figuren. */
function masqueradePart(gm:boolean,state:TableVitals){
 const view=masqueradeView(state),risk=masqueradeRisk(state.masquerade.value,state.masquerade.max),lage={level:risk.level,label:risk.label,hint:risk.hint};
 if(gm||view==='exact')return {masquerade:{value:state.masquerade.value,max:state.masquerade.max},masqueradeRisk:lage};
 return view==='risk'?{masqueradeRisk:lage}:{};
}
export async function vitalsSnapshot(a:Actor,room:LiveRoom){
 const [state,characters,members]=await Promise.all([readTableVitals(a.campaignId),tableCharacters(a,room),liveMembers(a)]);
 const name=(id:string)=>members.find(m=>m.id===id)?.name||'Teilnehmer';
 const visible=characters.filter(c=>a.gm?canRead(a,c.row):c.row.owner_id===a.id||state.shared.includes(c.row.id));
 const views:TableCharacterView[]=visible.map(c=>({id:c.row.id,title:c.row.title,ownerId:c.row.owner_id,ownerName:name(c.row.owner_id),own:c.row.owner_id===a.id,shared:state.shared.includes(c.row.id),version:c.row.version,vitals:readVitals(c.body),stress:personalStress(state,c.row.id)}));
 const band=stressBand(state.stress),view=masqueradeView(state),roundView=roundViewOf(state),playerDamage=damageByOf(state)==='player';
 const inRound=characters.filter(c=>a.gm?canRead(a,c.row):roundView==='all'||c.row.owner_id===a.id||state.shared.includes(c.row.id));
 const round:RoundEntry[]=inRound.map(c=>{const v=readVitals(c.body);return {id:c.row.id,title:c.row.title,ownerId:c.row.owner_id,ownerName:name(c.row.owner_id),own:c.row.owner_id===a.id,blood:{current:v.blood.current,max:v.blood.max},willpower:{...v.willpower},health:{track:v.health.track,level:v.health.level,status:v.health.status,penalty:v.health.penalty}};});
 let history:{id:string;at:string;actor:string;character:string;text:string}[]|undefined;
 if(a.gm&&views.length){
  const ids=views.map(v=>v.id);
  const events=await database().prepare(`SELECT id,entity_id,actor_id,payload,created_at FROM world_events WHERE campaign_id=? AND type='character.vitals' AND entity_id IN (${ids.map(()=>'?').join(',')}) ORDER BY created_at DESC,id DESC LIMIT 20`).bind(a.campaignId,...ids).all<{id:string;entity_id:string;actor_id:string;payload:string;created_at:string}>();
  history=events.results.map(e=>{let reason='';try{reason=String(JSON.parse(e.payload).reason||'');}catch{/* keep empty */}return {id:e.id,at:e.created_at,actor:name(e.actor_id),character:views.find(v=>v.id===e.entity_id)?.title||'',text:reason};});
 }
 return {
  profile:state.profile,operations:allowedOperations(state.profile,a.gm,playerDamage),version:state.version,
  round,roundView,damageBy:damageByOf(state),
  stress:{value:state.stress,label:band.label,effect:band.effect},
  // Die genaue Maskerade-Stufe erhalten Spieler nur bei „exact“; bei „risk“ nur die grobe Lage, bei „hidden“ nichts.
  ...masqueradePart(a.gm,state),
  characters:views,
  ...(a.gm?{settings:{masqueradeVisible:state.masquerade.visible,masqueradeView:view,nightlyWillpower:state.nightlyWillpower,shared:state.shared},log:state.log,history}:{}),
 };
}

async function characterOnTable(a:Actor,room:LiveRoom,id:string,state:TableVitals){
 const found=(await tableCharacters(a,room)).find(c=>c.row.id===id);
 // Figuren, die ein Spieler nicht sieht, sind für ihn nicht existent. Sichtbare fremde Figuren steuert er nicht.
 const seen=!!found&&(found.row.owner_id===a.id||roundViewOf(state)==='all'||state.shared.includes(found.row.id));
 if(!found||(a.gm&&!canRead(a,found.row))||(!a.gm&&!seen))throw new HttpError(404,'Charakter ist an diesem Tisch nicht verfügbar.');
 if(!a.gm&&found.row.owner_id!==a.id)throw new HttpError(403,'Diese Werte ändern nur der Spieler selbst oder die Spielleitung.');
 return found;
}
function domainError(error:unknown):never{if(error instanceof VitalsError)throw new HttpError(error.status,error.message);throw error;}

export async function changeCharacterVitals(a:Actor,room:LiveRoom,characterId:string,c:VitalsCommand){
 const state=await readTableVitals(a.campaignId),{row,body}=await characterOnTable(a,room,characterId,state);
 if(!mayOperate(state.profile,a,row.owner_id,c.op,damageByOf(state)==='player'))throw new HttpError(403,a.gm?'Nicht erlaubt.':'Diesen Wert steuert die Spielleitung.');
 let change;try{change=applyVitals(body,c,a);}catch(e){domainError(e);}
 await saveEngine(a,row,change.body,row.version,'vitals',change.summary+' · '+(a.gm?'SL am Spieltisch':'Spieler am Spieltisch'),row.visibility,row.gm_body,row.title,change.changes);
 return change.summary;
}
/** „Neue Nacht“: V20 verbraucht beim Erwachen 1 Blutpunkt; +1 Willenskraft nur als eingeschaltete SL-Option. */
export async function nightForAll(a:Actor,room:LiveRoom){
 gmOnly(a);const [characters,state]=await Promise.all([tableCharacters(a,room),readTableVitals(a.campaignId)]);
 const results:string[]=[];
 for(const {row,body} of characters.filter(c=>canRead(a,c.row))){
  let next=body;const changes:Record<string,{before:unknown;after:unknown}>={},parts:string[]=[];
  const v=readVitals(body);
  if(v.health.status!=='active'){results.push(row.title+': übersprungen (Starre/Tod)');continue;}
  if(v.blood.current!==null&&v.blood.current>0){const c=applyVitals(next,{op:'blood.spend',amount:1},a);next=c.body;Object.assign(changes,c.changes);parts.push('Erwachen −1 Blut');}
  if(state.nightlyWillpower&&v.willpower.temporary!==null&&v.willpower.permanent!==null&&v.willpower.temporary<v.willpower.permanent){const c=applyVitals(next,{op:'willpower.regain',amount:1},a);next=c.body;Object.assign(changes,c.changes);parts.push('+1 Willenskraft (SL-Option)');}
  if(!parts.length){results.push(row.title+': keine Änderung');continue;}
  await saveEngine(a,row,next,row.version,'vitals','Neue Nacht: '+parts.join(', ')+' · SL am Spieltisch',row.visibility,row.gm_body,row.title,changes);
  results.push(row.title+': '+parts.join(', '));
 }
 return results;
}
/** Bruchpunkt des Gruppenstress: alle Figuren verlieren 1 Willenskraft, nur auf ausdrückliche SL-Aktion. */
export async function willpowerForAll(a:Actor,room:LiveRoom){
 gmOnly(a);const results:string[]=[];
 for(const {row,body} of (await tableCharacters(a,room)).filter(c=>canRead(a,c.row))){
  const v=readVitals(body);if(!v.willpower.temporary){results.push(row.title+': keine Willenskraft');continue;}
  const c=applyVitals(body,{op:'willpower.spend',note:'Bruchpunkt Gruppenstress'},a);
  await saveEngine(a,row,c.body,row.version,'vitals',c.summary+' · SL am Spieltisch',row.visibility,row.gm_body,row.title,c.changes);results.push(row.title+': −1 Willenskraft');
 }
 return results;
}
export async function changeTableVitals(a:Actor,room:LiveRoom,expectedVersion:number,c:TableCommand){
 gmOnly(a);
 const target=c.op==='settings'?c.share?.characterId:c.op==='personalStress'?c.characterId:undefined;
 const character=target?(await tableCharacters(a,room)).find(x=>x.row.id===target):undefined;
 if(target&&!character)throw new HttpError(404,'Charakter ist an diesem Tisch nicht verfügbar.');
 const db=database(),key=stateKey(a.campaignId),state=await readTableVitals(a.campaignId);
 if(state.version!==expectedVersion)throw new HttpError(409,'Zustandswerte wurden inzwischen geändert. Bitte erneut versuchen.');
 const now=new Date().toISOString(),id=crypto.randomUUID();
 let next:TableVitals;try{next=applyTableVitals(state,c,a.name,now,id,character?.row.title);}catch(e){domainError(e);}
 const value=JSON.stringify(next),entry=next.log[0];
 const write=state.version===0
  ?db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING').bind(key,value)
  :db.prepare("UPDATE settings SET value=? WHERE key=? AND json_extract(value,'$.version')=?").bind(value,key,expectedVersion);
 const [result]=await db.batch([write,
  db.prepare("INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,NULL,?,'table.vitals',?,? WHERE EXISTS(SELECT 1 FROM settings WHERE key=? AND json_extract(value,'$.log[0].id')=?)").bind(id,a.campaignId,a.id,JSON.stringify({reason:entry.text,secret:entry.secret,version:next.version}),now,key,id)]);
 if(!result.meta.changes)throw new HttpError(409,'Zustandswerte wurden inzwischen geändert. Bitte erneut versuchen.');
}
