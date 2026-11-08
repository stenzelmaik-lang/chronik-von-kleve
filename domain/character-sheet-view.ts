// One read-only model of the V20 sheet for every reading place (player area, SL view, in-game menu).
// Built only from the existing projection (server/character-projection.ts); nothing is stored or derived for writing.
// Layout and wording follow the German V20 paper sheet (docs/design/4b-ABWEICHUNGSLISTE.md).
import {sheetNumber,dotSlots,dotLabel} from './sheet-values.ts';
import {readSpecialties,specialtyTargetKey,traitRating,SPECIALTY_MINIMUM_RATING,type Specialty} from './character-specialties.ts';
import {readVitals,vitalHealthLevels,damageMarks,damageLabels,type DamageType} from './character-vitals.ts';

export const SHEET_ATTRIBUTE_GROUPS=[
 ['Körperlich',['Körperkraft','Geschick','Widerstandsfähigkeit']],
 ['Gesellschaftlich',['Charisma','Manipulation','Erscheinungsbild']],
 ['Geistig',['Wahrnehmung','Intelligenz','Geistesschärfe']],
] as const;
export const SHEET_ABILITY_GROUPS=[
 ['Talente','Talent',['Aufmerksamkeit','Ausdruck','Ausflüchte','Einschüchtern','Empathie','Führungsqualitäten','Handgemenge','Magiegespür','Sportlichkeit','Szenekenntnis']],
 ['Fertigkeiten','Fertigkeit',['Diebstahl','Etikette','Fahren','Handwerk','Heimlichkeit','Nahkampf','Schusswaffen','Tierkunde','Überleben','Vortrag']],
 ['Kenntnisse','Kenntnis',['Akademisches Wissen','Computer','Finanzen','Gesetzeskenntnis','Medizin','Nachforschungen','Naturwissenschaften','Okkultismus','Politik','Technologie']],
] as const;
/** The paper sheet prints both names; a stored name (e.g. "Überzeugung" on a path) is shown as stored. */
const VIRTUES=[['Gewissen','Überzeugung'],['Selbstbeherrschung','Instinkt'],['Mut']] as const;

export type SheetRow={name:string;value:number|null;slots:number;label:string;specialties:string[];own?:boolean};
export type SheetGroup={title:string;rows:SheetRow[]};
export type SheetListRow={name:string;value:number|null;slots:number;label:string;note?:string};
export type SheetCostRow={name:string;cost:number|null};
export type SheetView={
 header:[string,string][];
 attributes:SheetGroup[];abilities:SheetGroup[];unassigned:SheetRow[];legacyText:string[];
 disciplines:SheetListRow[]|string;paths:SheetListRow[];backgrounds:SheetListRow[]|string;virtues:SheetRow[];
 merits:SheetCostRow[]|string;flaws:SheetCostRow[]|string;clanWeakness:string;
 humanity:{name:string;value:number|null};
 willpower:{permanent:number|null;temporary:number|null};
 blood:{current:number|null;max:number|null;perTurn:number|null};
 health:{levels:{name:string;penalty:string;mark:string;damage:string}[];level:string;status:string};
 experience:{free:number|null;total:number|null};
};

const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const rows=(v:unknown):Record<string,unknown>[]=>Array.isArray(v)?v.filter((r):r is Record<string,unknown>=>!!r&&typeof r==='object'):[];
const text=(v:unknown)=>typeof v==='string'?v.trim():typeof v==='number'?String(v):'';
const row=(name:string,raw:unknown,specialties:string[]=[],own=false):SheetRow=>{const value=sheetNumber(raw);return {name,value,slots:dotSlots(value),label:dotLabel(name,value),specialties,...(own?{own:true}:{})};};
const listRows=(v:unknown,metric:'value'|'level'='value'):SheetListRow[]|string=>typeof v==='string'?v.trim():rows(v).map(r=>{const name=text(r.name)||'Unbenannt',value=sheetNumber(r[metric]??r.value);return {name,value,slots:dotSlots(value),label:dotLabel(name,value)};});
const costRows=(v:unknown):SheetCostRow[]|string=>typeof v==='string'?v.trim():rows(v).map(r=>({name:text(r.name)||'Unbenannt',cost:sheetNumber(r.cost)}));

/** Projection → sheet model. Missing values stay null ("–"), real zeros stay 0, values above five keep all dots. */
export function sheetView(identity:Record<string,unknown>,sheet:Record<string,unknown>,progression:Record<string,unknown>={}):SheetView{
 const attributes=object(sheet.attributes),abilities=object(sheet.abilities),virtues=object(sheet.virtues);
 const body={specialties:sheet.specialties,customAbilities:sheet.customAbilities};
 const specialties=readSpecialties(body);
 const ratingBody={attributes,skills:abilities,customAbilities:sheet.customAbilities};
 // Same wording as the previous sheet view: scope, deactivated, and the minimum rating at which a specialty applies.
 const describe=(s:Specialty)=>{const rating=traitRating(ratingBody,s.target)??0;return s.name+(s.scope?' – '+s.scope:'')+(s.active===false?' (deaktiviert)':rating<SPECIALTY_MINIMUM_RATING?` (wirkt erst ab ${SPECIALTY_MINIMUM_RATING} Punkten)`:'');};
 const specialtiesOf=(kind:Specialty['target']['kind'],key:string)=>specialties.filter(s=>s.target.kind===kind&&specialtyTargetKey(s.target,body)===key).map(describe);
 const custom=rows(sheet.customAbilities).filter(r=>r.active!==false);
 const known=new Set<string>([...SHEET_ATTRIBUTE_GROUPS.flatMap(([,n])=>n),...SHEET_ABILITY_GROUPS.flatMap(([,,n])=>n)]);
 const unassigned=[...Object.entries(attributes),...Object.entries(abilities)].filter(([name])=>!known.has(name)).map(([name,v])=>row(name,v));
 const ownWithoutGroup=custom.filter(r=>!SHEET_ABILITY_GROUPS.some(([,category])=>r.category===category)).map(r=>row(text(r.name)||'Unbenannt',r.value,[],true));
 const storedVirtues=Object.keys(virtues);
 const virtueRows=VIRTUES.map(names=>{const stored=names.find(n=>Object.hasOwn(virtues,n));return row(stored??names.join('/'),stored?virtues[stored]:undefined);});
 for(const extra of storedVirtues.filter(n=>!VIRTUES.some(names=>(names as readonly string[]).includes(n))))virtueRows.push(row(extra,virtues[extra]));
 const willpower=object(sheet.willpower),blood=object(sheet.blood);
 const vitals=readVitals({generation:identity.generation,bloodMax:blood.max,blood:blood.current,bloodPerRound:blood.perRound,willpower:willpower.permanent,willpowerTemporary:willpower.temporary,health:sheet.health});
 const track=vitals.health.track;
 return {
  header:([['Name',identity.name],['Spieler',identity.player],['Chronik',identity.chronicle],['Wesen',identity.nature],['Verhalten',identity.demeanor],['Konzept',identity.concept],['Clan',identity.clan],['Generation',identity.generation],['Erzeuger',identity.sire]] as [string,unknown][]).map(([k,v])=>[k,text(v)||'–']),
  attributes:SHEET_ATTRIBUTE_GROUPS.map(([title,names])=>({title,rows:names.map(n=>row(n,attributes[n],specialtiesOf('attribute',n)))})),
  abilities:SHEET_ABILITY_GROUPS.map(([title,category,names])=>({title,rows:[
   ...names.map(n=>row(n,abilities[n],specialtiesOf('ability',n))),
   ...custom.filter(r=>r.category===category).map(r=>row(text(r.name)||'Unbenannt',r.value,typeof r.id==='string'?specialties.filter(s=>s.target.kind==='customAbility'&&s.target.id===r.id).map(describe):[],true)),
  ]})),
  unassigned:[...unassigned,...ownWithoutGroup],
  legacyText:typeof sheet.customAbilities==='string'&&sheet.customAbilities.trim()?[sheet.customAbilities.trim()]:[],
  disciplines:listRows(sheet.disciplines),
  paths:(()=>{const list=listRows(sheet.paths),raw=rows(sheet.paths);return typeof list==='string'?[]:list.map((p,i)=>raw[i]?.primary===true?{...p,note:'Primärpfad'}:p);})(),
  backgrounds:listRows(sheet.backgrounds),
  virtues:virtueRows,
  merits:costRows(sheet.merits),flaws:costRows(sheet.flaws),
  clanWeakness:text(sheet.clanWeakness),
  humanity:{name:text(sheet.humanityPath)||'Menschlichkeit',value:sheetNumber(sheet.humanity)},
  willpower:{permanent:vitals.willpower.permanent,temporary:vitals.willpower.temporary},
  blood:{current:vitals.blood.current,max:vitals.blood.max,perTurn:vitals.blood.perTurn},
  health:{levels:vitalHealthLevels.map((l,i)=>{const t=track[i] as DamageType|undefined;return {name:l.name,penalty:l.penalty===null?'':l.penalty===0?'':String(l.penalty),mark:t?damageMarks[t]:'',damage:t?damageLabels[t]:''};}),level:vitals.health.level,status:vitals.health.status==='torpor'?'Starre':vitals.health.status==='final-death'?'Endgültiger Tod':''},
  experience:{free:sheetNumber(progression.freeXp),total:sheetNumber(progression.totalXp)},
 };
}
