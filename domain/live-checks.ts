/** Lifecycle of character checks at the live table. Pure presentation logic: no randomness, no rules, no writes.
 * A check is "ausstehend" for a target until a roll with its request id exists; a roll is final once stored.
 * Whether a result view is open is a per-client matter and never makes a roll "open" again. */
import {W10_ATTRIBUTE_KEYS,W10_ABILITY_KEYS} from './trait-ids.ts';

export type CheckLike={id:string;title:string;difficulty:number;attributeId?:string;abilityId?:string;recipients:string[]|null};
export type CheckRoll={id:string;authorId:string;checkRef?:{requestId:string;characterId:string}};
export type CheckTarget={playerId:string;rollId?:string};
export type CheckProgress={targets:CheckTarget[];rolled:number;done:boolean};

/** Rolls belonging to one check, keyed by the rolling player. */
function rollsOf(check:CheckLike,rolls:readonly CheckRoll[]){return rolls.filter(r=>r.checkRef?.requestId===check.id);}

/** Targets of a check: the named players, or every player at the table for "ganze Runde" (plus anyone who already rolled). */
export function checkProgress(check:CheckLike,rolls:readonly CheckRoll[],players:readonly string[]):CheckProgress{
 const own=rollsOf(check,rolls),ids=check.recipients??[...new Set([...players,...own.map(r=>r.authorId)])];
 const targets=ids.map(playerId=>({playerId,rollId:own.find(r=>r.authorId===playerId)?.id}));
 const rolled=targets.filter(t=>t.rollId).length;
 return {targets,rolled,done:!!targets.length&&rolled===targets.length};
}

/** Players at the table as the GM sees the crew. The stage labels the viewer's own entry "Spielleitung"; role codes are kept for older payloads. */
export const isTablePlayer=(m:{role:string})=>!['gm','campaign_gm','Spielleitung'].includes(m.role);

/** Number of rolls the round still owes across all issued checks (badge of the Regie area "Proben"). */
export function pendingTargets(checks:readonly CheckLike[],rolls:readonly CheckRoll[],players:readonly string[]){return checks.reduce((n,c)=>{const p=checkProgress(c,rolls,players);return n+p.targets.length-p.rolled;},0);}

/** Checks a player still has to roll, oldest first. The server already filters checks to the addressed player. */
export function pendingChecks<T extends CheckLike>(playerId:string,checks:readonly T[],rolls:readonly CheckRoll[]):T[]{
 return checks.filter(c=>(c.recipients===null||c.recipients.includes(playerId))&&!rolls.some(r=>r.checkRef?.requestId===c.id&&r.authorId===playerId));
}

/** The check a player should see first: the oldest pending one, otherwise the newest finished one. */
export function focusCheck<T extends CheckLike>(playerId:string,checks:readonly T[],rolls:readonly CheckRoll[]):T|undefined{
 return pendingChecks(playerId,checks,rolls)[0]||checks.at(-1);
}

const aliases:Record<string,string>={nachforschung:'investigation',taschendiebstahl:'larceny',schleichen:'stealth',wachsamkeit:'alertness',athletik:'athletics',einschüchterung:'intimidation'};
const words=(text:string)=>text.toLocaleLowerCase('de-DE');
function find(text:string,table:Readonly<Record<string,string>>,extra:Record<string,string>={}):string|undefined{
 const lower=words(text);let best:{id:string;at:number}|undefined;
 const entries=[...Object.entries(table).map(([id,label])=>[words(label),id]),...Object.entries(extra)];
 for(const [label,id] of entries){const at=lower.search(new RegExp('(^|[^\\p{L}])'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|[^\\p{L}])','u'));if(at>=0&&(!best||at<best.at))best={id,at};}
 return best?.id;
}

/** Reads "Geschick + Handgemenge (6)" or "Wahrnehmung + Aufmerksamkeit, SG 7" from a prepared scene check.
 * Only fills what is clearly written; the GM confirms everything before issuing. */
export function parsePreparedCheck(title:string,text=''):{attributeId?:string;abilityId?:string;difficulty?:number}{
 const out:{attributeId?:string;abilityId?:string;difficulty?:number}={};
 for(const source of [title,text]){
  if(!out.attributeId){const id=find(source,W10_ATTRIBUTE_KEYS);if(id)out.attributeId=id;}
  if(!out.abilityId){const id=find(source,W10_ABILITY_KEYS,aliases);if(id)out.abilityId=id;}
  if(out.difficulty===undefined){const m=/(?:\bSG|Schwierigkeit|Diff\.?)\s*:?\s*(\d{1,2})\b/i.exec(source)||/\((\d{1,2})\)/.exec(source);const n=m?Number(m[1]):NaN;if(n>=2&&n<=10)out.difficulty=n;}
 }
 return out;
}

export const attributeLabel=(id?:string)=>id?W10_ATTRIBUTE_KEYS[id as keyof typeof W10_ATTRIBUTE_KEYS]||id:'';
export const abilityLabel=(id?:string)=>id?W10_ABILITY_KEYS[id as keyof typeof W10_ABILITY_KEYS]||id:'';
/** "Geschick + Handgemenge", with "frei" for parts the player chooses. */
export function traitLine(check:{attributeId?:string;abilityId?:string}){return (attributeLabel(check.attributeId)||'Attribut frei')+' + '+(abilityLabel(check.abilityId)||'Fähigkeit frei');}

/** One check as the Regie issues it, prepared or spontaneous (GE-02). Both ways build this spec and send the same requestCheck. */
export type CheckSpec={title:string;difficulty:number;attributeId:string;abilityId:string;hints?:string;targetCharacterIds:string[];consequences?:{success:string;failure:string;botch:string};preparedId?:string;sceneId?:string};
/** A spontaneous check needs no name: it is called after its traits, or simply "Probe". */
export function defaultCheckTitle(spec:{attributeId?:string;abilityId?:string}){return [attributeLabel(spec.attributeId),abilityLabel(spec.abilityId)].filter(Boolean).join(' + ')||'Probe';}
/** The requestCheck body. Figures replace the audience: the server derives the players from the characters' owners. */
export function checkRequestBody(spec:CheckSpec,eventId:string):Record<string,unknown>{
 const consequences=spec.consequences&&(spec.consequences.success||spec.consequences.failure||spec.consequences.botch)?spec.consequences:undefined;
 return {action:'requestCheck',eventId,title:spec.title.trim()||defaultCheckTitle(spec),difficulty:spec.difficulty,...(spec.attributeId?{attributeId:spec.attributeId}:{}),...(spec.abilityId?{abilityId:spec.abilityId}:{}),...(spec.hints?.trim()?{gmHints:spec.hints.trim()}:{}),...(spec.sceneId?{sceneId:spec.sceneId}:{}),...(spec.targetCharacterIds.length?{targetCharacterIds:spec.targetCharacterIds}:{}),...(spec.preparedId?{preparedId:spec.preparedId}:{}),...(consequences?{consequences}:{})};
}
