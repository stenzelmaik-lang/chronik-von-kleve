import {z} from 'zod';

// Zustandswerte am Spieltisch nach V:tM V20 (Regelwerk, Kap. 3 „Health“/„Blood Pool“, Kap. 6
// „Spending Willpower“, „Using Blood Pool“, Generationstabelle S. 270, „Applying Damage“ S. 284 f.).
// Gruppenstress folgt dem Kampagnen-Spielerhandout „Stress-Regel“. Die Maskerade-Stufe ist keine
// V20-Charaktereigenschaft, sondern die Eskalationsstufe der Kampagne; ihre Skala bleibt einstellbar.

/** V20-Gesundheitsstufen mit Würfelpoolabzug; die Namen entsprechen dem bestehenden Bogen. */
export const vitalHealthLevels=[
 {name:'Blaue Flecken',penalty:0},{name:'Verletzt',penalty:-1},{name:'Schwer verletzt',penalty:-1},
 {name:'Verwundet',penalty:-2},{name:'Schwer verwundet',penalty:-2},{name:'Verkrüppelt',penalty:-5},{name:'Außer Gefecht',penalty:null},
] as const;
export const healthTrackLength=vitalHealthLevels.length;
/** „unspecified“ kennzeichnet ältere Bögen, die nur eine Stufe ohne Schadensart gespeichert haben. */
export const damageTypes=['bashing','lethal','aggravated','unspecified'] as const;
export type DamageType=typeof damageTypes[number];
export const damageLabels:Record<DamageType,string>={bashing:'Wucht',lethal:'Tödlich',aggravated:'Schwer',unspecified:'Art nicht erfasst'};
export const damageMarks:Record<DamageType,string>={bashing:'/',lethal:'X',aggravated:'*',unspecified:'■'};
// Schwerer Schaden steht oben, Normalschaden wird zuletzt eingetragen und zuerst geheilt.
const severity:Record<DamageType,number>={aggravated:3,lethal:2,unspecified:1,bashing:0};
export type HealthStatus='active'|'torpor'|'final-death';

/** Generationstabelle V20 S. 270. Dritte Generation ist im Regelwerk unbestimmt („???“). */
const generationTable:Record<number,{maxTrait:number;bloodMax:number;perTurn:number}>={
 4:{maxTrait:9,bloodMax:50,perTurn:10},5:{maxTrait:8,bloodMax:40,perTurn:8},6:{maxTrait:7,bloodMax:30,perTurn:6},
 7:{maxTrait:6,bloodMax:20,perTurn:5},8:{maxTrait:5,bloodMax:15,perTurn:3},9:{maxTrait:5,bloodMax:14,perTurn:2},
 10:{maxTrait:5,bloodMax:13,perTurn:1},11:{maxTrait:5,bloodMax:12,perTurn:1},12:{maxTrait:5,bloodMax:11,perTurn:1},13:{maxTrait:5,bloodMax:10,perTurn:1},
};
export function generationLimits(generation:unknown){const g=Number(generation);if(!Number.isInteger(g)||g<4||g>20)return null;return generationTable[Math.min(g,13)];}

/** Gruppenstress laut Spielerhandout (0–10). */
export const stressMaximum=10;
export const stressBands=[
 {from:0,to:3,label:'Alltag',effect:'Alles normal.'},
 {from:4,to:6,label:'Angespannte Nerven',effect:'+1 SG auf Pflichtwürfe (Bericht, Polizei, Presse). NSC reagieren misstrauischer.'},
 {from:7,to:9,label:'Hochdruck',effect:'+2 SG auf Pflichtwürfe. Patzer kosten zusätzlich (laut Handout „1 Hunger oder −1 Willenskraft“).'},
 {from:10,to:10,label:'Bruchpunkt',effect:'Alle Charaktere verlieren 1 Willenskraft und würfeln Selbstbeherrschung SG 7 (Patzer: Raserei/Flucht).'},
] as const;
export function stressBand(value:number){return stressBands.find(b=>value>=b.from&&value<=b.to)??stressBands[0];}
/** Persönlicher Stress je Figur: gleiche Leiste und Stufennamen wie der Gruppenstress, ohne Regelautomatik (Wirkung legt die SL fest). */
export const personalStressEffect='Persönliche Belastung. Die Wirkung legt die SL fest; es wird nichts automatisch gewürfelt.';

/**
 * Maskerade-Risiko für Spieler: grobe Lage statt der genauen SL-Stufe. Reine Darstellung, keine Regel.
 * hidden = nur SL, risk = Spieler sehen die Lage, exact = Spieler sehen die Stufe.
 */
export const masqueradeViews=['hidden','risk','exact'] as const;
export type MasqueradeView=typeof masqueradeViews[number];
export const masqueradeViewLabels:Record<MasqueradeView,string>={hidden:'Nur SL',risk:'Spieler sehen die Lage',exact:'Spieler sehen die Stufe'};
const masqueradeRisks=[
 {level:0,label:'Gewahrt',hint:'Keine Aufmerksamkeit erkennbar.'},
 {level:1,label:'Aufmerksamkeit',hint:'Es wird geredet. Vorsicht ist angebracht.'},
 {level:2,label:'In Gefahr',hint:'Die Maskerade wackelt. Jeder Fehler kann sie brechen.'},
 {level:3,label:'Bruch droht',hint:'Die Maskerade steht kurz vor dem Bruch.'},
] as const;
export function masqueradeRisk(value:number,max:number){
 const ratio=max>0?value/max:0;
 return masqueradeRisks[value<=0?0:ratio>=1?3:ratio>.4?2:1];
}

/** Wer was buchen darf. Die SL darf immer alles, auch korrigieren. */
export const playerOperations=['blood.spend','willpower.spend','blood.gain','heal.blood'] as const;
export const controlProfiles={
 empfohlen:{label:'Empfohlen',description:'Spieler buchen eigene Blutausgabe und Willenskraftnutzung. Schaden, Heilung, Stress und Maskerade steuert die SL.',player:['blood.spend','willpower.spend']},
 offen:{label:'Erweitert',description:'Zusätzlich dürfen Spieler Nahrungsaufnahme eintragen und Normalschaden mit Blut heilen.',player:['blood.spend','willpower.spend','blood.gain','heal.blood']},
 sl:{label:'Nur SL',description:'Alle Zustandswerte bucht ausschließlich die Spielleitung.',player:[]},
} as const satisfies Record<string,{label:string;description:string;player:readonly typeof playerOperations[number][]}>;
export type ControlProfile=keyof typeof controlProfiles;
export const controlProfileIds=Object.keys(controlProfiles) as ControlProfile[];

const integer=(v:unknown)=>typeof v==='number'&&Number.isInteger(v)?v:typeof v==='string'&&/^\d+$/.test(v.trim())?Number(v):null;
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));

export type CharacterVitals={
 blood:{current:number|null;max:number|null;perTurn:number|null;maxSource:'bogen'|'generation'|null};
 willpower:{temporary:number|null;permanent:number|null};
 health:{track:DamageType[];status:HealthStatus;level:string;penalty:number|null};
 generation:number|null;
};
export function sortTrack(track:DamageType[]){return [...track].sort((x,y)=>severity[y]-severity[x]);}
export function healthLevelName(track:DamageType[]){return track.length?vitalHealthLevels[Math.min(track.length,healthTrackLength)-1].name:'Gesund';}
function storedTrack(health:Record<string,unknown>):DamageType[]{
 if(Array.isArray(health.track))return sortTrack(health.track.filter((t):t is DamageType=>damageTypes.includes(t as DamageType)).slice(0,healthTrackLength));
 // Älterer Bogen: nur die Stufe ist bekannt, nicht die Schadensart.
 const index=vitalHealthLevels.findIndex(l=>l.name===health.current);
 return index<0?[]:Array.from({length:index+1},()=>'unspecified' as const);
}
export function readVitals(body:Record<string,unknown>):CharacterVitals{
 const generation=integer(body.generation),limits=generationLimits(generation);
 const sheetMax=integer(body.bloodMax),max=sheetMax??limits?.bloodMax??null;
 const current=integer(body.blood),permanent=integer(body.willpower),temporary=integer(body.willpowerTemporary);
 const health=object(body.health),track=storedTrack(health);
 const status:HealthStatus=health.status==='torpor'||health.status==='final-death'?health.status:'active';
 return {
  blood:{current:current===null?null:max===null?current:clamp(current,0,max),max,perTurn:integer(body.bloodPerRound)||limits?.perTurn||null,maxSource:sheetMax!==null?'bogen':limits?'generation':null},
  willpower:{temporary:temporary===null?permanent:permanent===null?temporary:clamp(temporary,0,permanent),permanent},
  health:{track,status,level:healthLevelName(track),penalty:track.length?vitalHealthLevels[track.length-1].penalty:0},generation,
 };
}

export const vitalsCommandSchema=z.discriminatedUnion('op',[
 z.object({op:z.literal('blood.spend'),amount:z.number().int().min(1).max(50),note:z.string().trim().max(200).optional()}).strict(),
 z.object({op:z.literal('blood.gain'),amount:z.number().int().min(1).max(50),note:z.string().trim().max(200).optional()}).strict(),
 z.object({op:z.literal('willpower.spend'),note:z.string().trim().max(200).optional()}).strict(),
 z.object({op:z.literal('willpower.regain'),amount:z.number().int().min(1).max(10),note:z.string().trim().max(200).optional()}).strict(),
 z.object({op:z.literal('damage'),type:z.enum(['bashing','lethal','aggravated']),levels:z.number().int().min(1).max(10),note:z.string().trim().max(200).optional()}).strict(),
 z.object({op:z.literal('heal.blood'),aggravated:z.boolean().default(false),extraSameDay:z.boolean().default(false)}).strict(),
 z.object({op:z.literal('heal'),levels:z.number().int().min(1).max(7),note:z.string().trim().max(200).optional()}).strict(),
 z.object({op:z.literal('reset'),target:z.enum(['health','willpower','blood'])}).strict(),
 z.object({op:z.literal('set'),blood:z.number().int().min(0).max(100).optional(),willpowerTemporary:z.number().int().min(0).max(10).optional(),track:z.array(z.enum(damageTypes)).max(healthTrackLength).optional(),status:z.enum(['active','torpor','final-death']).optional(),note:z.string().trim().max(200).optional()}).strict(),
]);
export type VitalsCommand=z.infer<typeof vitalsCommandSchema>;
export class VitalsError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}

/** playerDamage: the round lets players enter damage to their own character themselves (setting „Schaden trägt ein“). */
export function mayOperate(profile:ControlProfile,principal:{gm:boolean;id:string},ownerId:string,op:VitalsCommand['op'],playerDamage=false){
 if(principal.gm)return true;
 if(ownerId!==principal.id)return false;
 return (controlProfiles[profile].player as readonly string[]).includes(op)||(op==='damage'&&playerDamage);
}
/** Die für Besitzer in diesem Profil erlaubten Vorgänge; die SL erhält alle. */
export function allowedOperations(profile:ControlProfile,gm:boolean,playerDamage=false):VitalsCommand['op'][]{return gm?['blood.spend','blood.gain','willpower.spend','willpower.regain','damage','heal.blood','heal','reset','set']:[...controlProfiles[profile].player,...(playerDamage?['damage' as const]:[])];}

function addDamage(track:DamageType[],type:DamageType,levels:number,blood:number|null,status:HealthStatus){
 let next=sortTrack([...track,...Array.from({length:levels},()=>type)]),nextStatus=status;
 if(next.length>healthTrackLength){
  // Über „Außer Gefecht“ hinaus: schwerer Schaden bedeutet den endgültigen Tod, sonst Starre (V20 S. 284 f.).
  nextStatus=type==='aggravated'?'final-death':status==='final-death'?status:'torpor';
  next=next.slice(0,healthTrackLength);
 }
 // Außer Gefecht ohne Blut im Körper: sofortige Starre (V20 S. 121).
 if(next.length===healthTrackLength&&blood===0&&nextStatus==='active')nextStatus='torpor';
 return {track:next,status:nextStatus};
}
export type VitalsChange={body:Record<string,unknown>;summary:string;changes:Record<string,{before:unknown;after:unknown}>};
/** Reine Regelanwendung. Rechteprüfung erfolgt vorher über mayOperate, die Speicherung serverseitig. */
export function applyVitals(body:Record<string,unknown>,c:VitalsCommand,principal:{gm:boolean}):VitalsChange{
 const v=readVitals(body),blood=v.blood.current,wp=v.willpower.temporary;
 let nextBlood=blood,nextWp=wp,track=v.health.track,status=v.health.status,summary='';
 const fail=(message:string,code=400):never=>{throw new VitalsError(code,message);};
 if(status==='final-death'&&!principal.gm)fail('Endgültiger Tod: nur die Spielleitung kann diesen Stand ändern.',409);
 const needBlood=()=>blood===null?fail('Blutvorrat ist im Bogen noch nicht erfasst.',409):blood;
 const needWp=()=>wp===null||v.willpower.permanent===null?fail('Willenskraft ist im Bogen noch nicht erfasst.',409):wp;
 if(c.op==='blood.spend'){
  const current=needBlood();
  if(status==='torpor'&&!principal.gm)fail('In der Starre kann kein Blut ausgegeben werden.',409);
  if(c.amount>current)fail('Nicht genug Blut im Vorrat.');
  if(!principal.gm&&v.blood.perTurn&&c.amount>v.blood.perTurn)fail(`Pro Runde höchstens ${v.blood.perTurn} Blutpunkt(e) laut Generation.`);
  nextBlood=current-c.amount;summary=`Blut −${c.amount}`;
 }else if(c.op==='blood.gain'){
  const current=needBlood();if(v.blood.max===null)fail('Blutmaximum fehlt: Generation oder Maximum im Bogen erfassen.',409);
  if(current>=v.blood.max!)fail('Blutvorrat ist bereits voll.');
  nextBlood=Math.min(v.blood.max!,current+c.amount);summary=`Blut +${nextBlood-current} (Nahrung)`;
 }else if(c.op==='willpower.spend'){
  const current=needWp();if(current<1)fail('Keine Willenskraft mehr im Vorrat.');
  if(status!=='active'&&!principal.gm)fail('Außer Gefecht oder in Starre ist keine Willenskraft einsetzbar.',409);
  nextWp=current-1;summary='Willenskraft −1';
 }else if(c.op==='willpower.regain'){
  const current=needWp();if(current>=v.willpower.permanent!)fail('Willenskraftvorrat ist bereits voll.');
  nextWp=Math.min(v.willpower.permanent!,current+c.amount);summary=`Willenskraft +${nextWp-current}`;
 }else if(c.op==='damage'){
  ({track,status}=addDamage(track,c.type,c.levels,blood,status));summary=`${c.levels} Stufe(n) ${damageLabels[c.type]}schaden`;
 }else if(c.op==='heal.blood'){
  const current=needBlood();
  if(status!=='active')fail('In Starre oder nach dem endgültigen Tod ist keine Heilung mit Blut möglich.',409);
  if(c.aggravated){
   if(!principal.gm)fail('Schweren Schaden heilt nur die Spielleitung (ganzer Tag Ruhe).',403);
   const index=track.indexOf('aggravated');if(index<0)fail('Kein schwerer Schaden vorhanden.');
   if(current<5)fail('Für schweren Schaden sind 5 Blutpunkte nötig.');
   if(c.extraSameDay)nextWp=needWp()<1?fail('Für eine weitere schwere Stufe am selben Tag fehlt 1 Willenskraft.'):needWp()-1;
   track=track.filter((_,i)=>i!==index);nextBlood=current-5;summary='Schwere Stufe geheilt: 5 Blut'+(c.extraSameDay?' und 1 Willenskraft':'');
  }else{
   const index=track.findLastIndex(t=>t!=='aggravated');if(index<0)fail('Kein Normalschaden vorhanden.');
   if(current<1)fail('Kein Blut zum Heilen.');
   track=track.filter((_,i)=>i!==index);nextBlood=current-1;summary='Normalschaden geheilt: 1 Blut';
  }
 }else if(c.op==='heal'){
  if(!track.length)fail('Kein Schaden eingetragen.');
  track=track.slice(0,Math.max(0,track.length-c.levels));summary=`${c.levels} Stufe(n) Schaden entfernt (SL)`;
 }else if(c.op==='reset'){
  if(c.target==='health'){track=[];status='active';summary='Gesundheit zurückgesetzt';}
  else if(c.target==='willpower'){needWp();nextWp=v.willpower.permanent;summary='Willenskraft voll (Ende der Geschichte)';}
  else{needBlood();if(v.blood.max===null)fail('Blutmaximum fehlt.',409);nextBlood=v.blood.max;summary='Blutvorrat voll';}
 }else{
  if(c.blood!==undefined){if(v.blood.max!==null&&c.blood>v.blood.max)fail('Blut über dem Maximum.');nextBlood=c.blood;}
  if(c.willpowerTemporary!==undefined){if(v.willpower.permanent===null||c.willpowerTemporary>v.willpower.permanent)fail('Willenskraft über dem permanenten Wert.');nextWp=c.willpowerTemporary;}
  if(c.track)track=sortTrack(c.track);if(c.status)status=c.status;summary='Korrektur durch die SL';
 }
 if('note' in c&&c.note)summary+=' · '+c.note;
 const next={...body},changes:VitalsChange['changes']={};
 if(nextBlood!==blood){changes.blood={before:blood,after:nextBlood};next.blood=nextBlood;}
 if(nextWp!==wp){changes.willpowerTemporary={before:wp,after:nextWp};next.willpowerTemporary=nextWp;}
 const oldLevel=v.health.level,level=healthLevelName(track);
 if(track.join()!==v.health.track.join()||status!==v.health.status){
  changes.health={before:{level:oldLevel,track:v.health.track,status:v.health.status},after:{level,track,status}};
  // health.current bleibt für Bogen und ältere Ansichten synchron.
  next.health={...object(body.health),current:level,track,status};
 }
 if(!Object.keys(changes).length)fail('Keine Änderung.',409);
 return {body:next,summary,changes};
}

/** Gemeinsamer Tischstand der Kampagne (settings-JSON, keine Schemamigration). */
export const tableVitalsSchema=z.object({
 format:z.literal(1),version:z.number().int().nonnegative(),profile:z.enum(controlProfileIds as [ControlProfile,...ControlProfile[]]),
 stress:z.number().int().min(0).max(stressMaximum),
 masquerade:z.object({value:z.number().int().min(0).max(10),max:z.number().int().min(1).max(10),visible:z.boolean(),view:z.enum(masqueradeViews).optional()}).strict(),
 nightlyWillpower:z.boolean(),shared:z.array(z.string().min(1).max(160)).max(60),
 personal:z.record(z.string().min(1).max(160),z.number().int().min(0).max(stressMaximum)).refine(r=>Object.keys(r).length<=60).optional(),
 log:z.array(z.object({id:z.string(),at:z.string(),actor:z.string().max(200),text:z.string().max(300),secret:z.boolean()}).strict()).max(40),
 // Round settings, optional so older table states stay valid: who sees blood, willpower and damage of the whole
 // round (default: everyone) and who enters damage (default: the player for the own character; the SL always may).
 roundView:z.enum(['all','shared']).optional(),damageBy:z.enum(['player','sl']).optional(),
}).strict();
export const roundViews=['all','shared'] as const;
export type RoundView=typeof roundViews[number];
export const roundViewLabels:Record<RoundView,string>={all:'Für alle sichtbar',shared:'Nur eigene und freigegebene Figuren'};
export const damageModes=['player','sl'] as const;
export type DamageMode=typeof damageModes[number];
export const damageModeLabels:Record<DamageMode,string>={player:'Spieler trägt eigenen Schaden selbst ein',sl:'Nur die SL trägt Schaden ein'};
export const roundViewOf=(state:Pick<TableVitals,'roundView'>):RoundView=>state.roundView??'all';
export const damageByOf=(state:Pick<TableVitals,'damageBy'>):DamageMode=>state.damageBy??'player';
export type TableVitals=z.infer<typeof tableVitalsSchema>;
/** Ältere Stände kennen nur „visible“; daraus folgt „exact“ oder „hidden“. */
export function masqueradeView(state:TableVitals):MasqueradeView{return state.masquerade.view??(state.masquerade.visible?'exact':'hidden');}
// Maskerade-Stufen 0–5 entsprechen den meisten vorhandenen Eskalationsmatrizen der Kampagne (offen, einstellbar).
export const emptyTableVitals=():TableVitals=>({format:1,version:0,profile:'empfohlen',stress:0,masquerade:{value:0,max:5,visible:false,view:'risk'},nightlyWillpower:false,shared:[],personal:{},log:[]});
export const tableCommandSchema=z.discriminatedUnion('op',[
 z.object({op:z.literal('stress'),delta:z.number().int().min(-10).max(10).optional(),value:z.number().int().min(0).max(stressMaximum).optional(),note:z.string().trim().max(200).optional()}).strict(),
 z.object({op:z.literal('masquerade'),delta:z.number().int().min(-10).max(10).optional(),value:z.number().int().min(0).max(10).optional(),note:z.string().trim().max(200).optional()}).strict(),
 z.object({op:z.literal('personalStress'),characterId:z.string().min(1).max(160),delta:z.number().int().min(-10).max(10).optional(),value:z.number().int().min(0).max(stressMaximum).optional(),note:z.string().trim().max(200).optional()}).strict(),
 z.object({op:z.literal('settings'),profile:z.enum(controlProfileIds as [ControlProfile,...ControlProfile[]]).optional(),masqueradeMax:z.number().int().min(1).max(10).optional(),masqueradeVisible:z.boolean().optional(),masqueradeView:z.enum(masqueradeViews).optional(),nightlyWillpower:z.boolean().optional(),share:z.object({characterId:z.string().min(1).max(160),shared:z.boolean()}).strict().optional(),roundView:z.enum(roundViews).optional(),damageBy:z.enum(damageModes).optional()}).strict(),
]);
export type TableCommand=z.infer<typeof tableCommandSchema>;
export function applyTableVitals(state:TableVitals,c:TableCommand,actor:string,at:string,id:string,characterTitle=''):TableVitals{
 const next=structuredClone(state);let text='',secret=false;
 if(c.op==='stress'){
  const value=c.value??clamp(state.stress+(c.delta??0),0,stressMaximum);if(value===state.stress)throw new VitalsError(409,'Stress unverändert.');
  next.stress=value;text=`Gruppenstress ${state.stress} → ${value} (${stressBand(value).label})`;
 }else if(c.op==='masquerade'){
  const value=c.value??clamp(state.masquerade.value+(c.delta??0),0,state.masquerade.max);
  if(value>state.masquerade.max)throw new VitalsError(400,'Maskerade-Stufe über dem eingestellten Maximum.');
  if(value===state.masquerade.value)throw new VitalsError(409,'Maskerade-Stufe unverändert.');
  next.masquerade.value=value;text=`Maskerade-Stufe ${state.masquerade.value} → ${value}`;secret=masqueradeView(state)!=='exact';
 }else if(c.op==='personalStress'){
  const before=state.personal?.[c.characterId]??0,value=c.value??clamp(before+(c.delta??0),0,stressMaximum);
  if(value===before)throw new VitalsError(409,'Persönlicher Stress unverändert.');
  next.personal={...(state.personal??{}),[c.characterId]:value};if(!value)delete next.personal[c.characterId];
  text=`Persönlicher Stress${characterTitle?' '+characterTitle:''} ${before} → ${value} (${stressBand(value).label})`;
 }else{
  if(c.profile)next.profile=c.profile;
  if(c.masqueradeMax!==undefined){next.masquerade.max=c.masqueradeMax;next.masquerade.value=Math.min(next.masquerade.value,c.masqueradeMax);}
  if(c.masqueradeVisible!==undefined){next.masquerade.visible=c.masqueradeVisible;next.masquerade.view=c.masqueradeVisible?'exact':'hidden';}
  if(c.masqueradeView){next.masquerade.view=c.masqueradeView;next.masquerade.visible=c.masqueradeView==='exact';}
  if(c.nightlyWillpower!==undefined)next.nightlyWillpower=c.nightlyWillpower;
  if(c.roundView)next.roundView=c.roundView;
  if(c.damageBy)next.damageBy=c.damageBy;
  if(c.share)next.shared=c.share.shared?[...new Set([...next.shared,c.share.characterId])]:next.shared.filter(id=>id!==c.share!.characterId);
  text='Einstellungen der Zustandswerte geändert';secret=true;
 }
 if('note' in c&&c.note)text+=' · '+c.note;
 next.version++;next.log=[{id,at,actor,text,secret},...next.log].slice(0,40);
 return tableVitalsSchema.parse(next);
}
