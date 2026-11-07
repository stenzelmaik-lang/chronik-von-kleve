'use client';
/* eslint-disable @next/next/no-img-element -- The portrait comes from the existing protected file endpoint. */
import type {ReactNode} from 'react';
import {attrsGroups,skillGroups,type CharacterDetailProjection} from '../../character';
import {RichTextView} from '../../rich-text';
import {W10_ABILITY_KEYS,W10_ATTRIBUTE_KEYS} from '@/domain/trait-ids';
import {readVitals,vitalHealthLevels,damageMarks,damageLabels,type CharacterVitals} from '@/domain/character-vitals';
import {sheetNumber,dotSlots,dotLabel} from '@/domain/journal';
import styles from './journal.module.css';

// The own character sheet as a book page after the German V20 paper sheet: ornamental frame, three-column groups,
// dot rows and boxes. Values come from the existing personal projection; current values from the running table.
// A missing value is shown as missing ("–"), a real zero as zero. Dots never cap the value: 7 shows seven dots.

const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const list=(v:unknown):Record<string,unknown>[]=>Array.isArray(v)?v.filter(x=>x&&typeof x==='object') as Record<string,unknown>[]:[];
const text=(v:unknown)=>v===null||v===undefined?'':String(v).trim();
const paperTitles:Record<string,string>={Körperlich:'Körperlich',Sozial:'Gesellschaftlich',Mental:'Geistig'};
const customCategory:Record<string,string>={Talente:'Talent',Fertigkeiten:'Fertigkeit',Kenntnisse:'Kenntnis'};

export function Dots({name,value,min=5,max}:{name:string;value:number|null;min?:number;max?:number}){
 const slots=Math.max(dotSlots(value,min),max??0);
 return <span className={styles.dots} role="img" aria-label={dotLabel(name,value)} data-missing={value===null||undefined}>{value===null?<span className={styles.missing} aria-hidden>–</span>:Array.from({length:slots},(_,i)=><i key={i} data-on={i<value||undefined} aria-hidden/>)}</span>;
}
export function Boxes({name,value,max,mark}:{name:string;value:number|null;max:number|null;mark?:(i:number)=>string|undefined}){
 const slots=Math.max(max??0,value??0);
 if(!slots)return <span className={styles.missing} role="img" aria-label={name+': nicht erfasst'}>–</span>;
 return <span className={styles.boxes} role="img" aria-label={dotLabel(name,value,max)}>{Array.from({length:slots},(_,i)=><i key={i} data-on={value!==null&&i<value||undefined} aria-hidden>{mark?.(i)}</i>)}</span>;
}
function Row({name,value,note,max}:{name:string;value:unknown;note?:string;max?:number}){
 return <div className={styles.row}><span className={styles.rowName}>{name}{note&&<em className={styles.specialty}> · {note}</em>}</span><Dots name={name} value={sheetNumber(value)} max={max}/></div>;
}
function Field({label,value}:{label:string;value:unknown}){const t=text(value);return <div className={styles.field}><span>{label}</span><b data-missing={!t||undefined}>{t||'–'}</b></div>;}
function Group({title,children,id}:{title:string;children:ReactNode;id?:string}){return <section className={styles.group} id={id}><h4><span>{title}</span></h4>{children}</section>;}
export function SheetHeading({children,id}:{children:ReactNode;id?:string}){return <h3 className={styles.sheetHeading} id={id}><span aria-hidden>❦</span>{children}<span aria-hidden>❦</span></h3>;}

/** Specialties by target name, so they appear on the paper row of their trait. */
function specialtyNames(sheet:Record<string,unknown>){
 const map=new Map<string,string[]>();
 for(const s of list(sheet.specialties)){
  if(s.active===false)continue;const target=obj(s.target),id=String(target.id||'');
  const key=target.kind==='attribute'?(W10_ATTRIBUTE_KEYS as Record<string,string>)[id]:target.kind==='ability'?(W10_ABILITY_KEYS as Record<string,string>)[id]:target.kind==='customAbility'?'custom:'+id:undefined;
  if(!key||!text(s.name))continue;map.set(key,[...(map.get(key)||[]),text(s.name)]);
 }
 return map;
}

export function sheetVitals(sheet:Record<string,unknown>,identity:Record<string,unknown>,table:CharacterVitals|null){
 if(table)return {vitals:table,live:true};
 const w=obj(sheet.willpower),b=obj(sheet.blood);
 return {vitals:readVitals({generation:identity.generation,blood:b.current,bloodMax:b.max,bloodPerRound:b.perRound,willpower:w.permanent,willpowerTemporary:w.temporary,health:sheet.health}),live:false};
}

export function sheetTraits({p}:{p:CharacterDetailProjection}){
 const s=p.sheet,id=p.identity,specs=specialtyNames(s),attrs=obj(s.attributes),skills=obj(s.abilities);
 const known=new Set(skillGroups.flatMap(([,names])=>[...names] as string[]));
 const extraSkills=Object.entries(skills).filter(([name])=>!known.has(name));
 const custom=list(s.customAbilities);
 return {left:<div className={styles.sheet}>
  <div className={styles.sheetTitle}><small>V20 · Charakterbogen nach der deutschen Papiervorlage</small><strong>{text(id.name)||'Charakterbogen'}</strong></div>
  <div className={styles.identity}>
   <div className={styles.identityGrid}>
    <div><Field label="Name" value={id.name}/><Field label="Spieler" value={id.player}/><Field label="Chronik" value={id.chronicle}/></div>
    <div><Field label="Wesen" value={id.nature}/><Field label="Verhalten" value={id.demeanor}/><Field label="Konzept" value={id.concept}/></div>
    <div><Field label="Clan" value={id.clan}/><Field label="Generation" value={id.generation}/><Field label="Erzeuger" value={id.sire}/></div>
   </div>
   {typeof id.portraitRef==='string'&&id.portraitRef?<img className={styles.portrait} src={id.portraitRef} alt={'Porträt von '+text(id.name)}/>:null}
  </div>
  <SheetHeading id="journal-attributes">Attribute</SheetHeading>
  {Object.keys(attrs).length===0&&<p className={styles.hint}>Attribute sind noch nicht erfasst.</p>}
  <div className={styles.columns}>{attrsGroups.map(([title,names])=><Group key={title} title={paperTitles[title]||title}>{names.map(name=><Row key={name} name={name} value={attrs[name]} note={specs.get(name)?.join(', ')}/>)}</Group>)}</div>
 </div>,
 right:<div className={styles.sheet}>
  <SheetHeading id="journal-abilities">Fähigkeiten</SheetHeading>
  {Object.keys(skills).length===0&&custom.length===0&&<p className={styles.hint}>Fähigkeiten sind noch nicht erfasst.</p>}
  <div className={styles.columns}>{skillGroups.map(([title,names])=><Group key={title} title={title}>
   {names.map(name=><Row key={name} name={name} value={skills[name]??0} note={specs.get(name)?.join(', ')}/>)}
   {custom.filter(c=>(c.category||'Kenntnis')===customCategory[title]).map((c,i)=><Row key={String(c.id||i)} name={text(c.name)||'Unbenannt'} value={c.value} note={[c.id?specs.get('custom:'+c.id)?.join(', '):'',c.active===false?'inaktiv':''].filter(Boolean).join(' · ')||undefined}/>)}
  </Group>)}</div>
  {extraSkills.length>0&&<Group title="Weitere gespeicherte Fähigkeiten">{extraSkills.map(([name,value])=><Row key={name} name={name} value={value}/>)}</Group>}
  {typeof s.customAbilities==='string'&&text(s.customAbilities)&&<Group title="Freie Fähigkeiten"><p className={styles.preserve}>{text(s.customAbilities)}</p></Group>}
  <p className={styles.hint}>Spezialisierungen stehen kursiv hinter ihrem Wert. Nicht gesetzte Fähigkeiten zählen als 0.</p>
 </div>};
}

function RatedList({title,value,metric='value'}:{title:string;value:unknown;metric?:'value'|'cost'}){
 if(typeof value==='string')return <Group title={title}>{text(value)?<p className={styles.preserve}>{text(value)}</p>:<p className={styles.empty}>Keine Einträge.</p>}</Group>;
 const rows=list(value);
 return <Group title={title}>{rows.length?rows.map((r,i)=>metric==='value'?<Row key={i} name={text(r.name)||'Unbenannt'} value={r.value}/>:<div key={i} className={styles.row}><span className={styles.rowName}>{text(r.name)||'Unbenannt'}</span><b className={styles.cost}>{sheetNumber(r.cost)??'–'} {sheetNumber(r.cost)===1?'Punkt':'Punkte'}</b></div>):<p className={styles.empty}>Keine Einträge.</p>}</Group>;
}

export function sheetAdvantages({p,table,checkHint}:{p:CharacterDetailProjection;table:CharacterVitals|null;checkHint?:ReactNode}){
 const s=p.sheet,virtues=obj(s.virtues),prog=p.progression;
 const {vitals:v,live}=sheetVitals(s,p.identity,table);
 const virtueNames=Object.keys(virtues).length?Object.keys(virtues):['Gewissen','Selbstbeherrschung','Mut'];
 const track=v.health.track;
 return {left:<div className={styles.sheet}>
  <SheetHeading>Vorteile</SheetHeading>
  <div className={styles.columns}>
   <RatedList title="Disziplinen" value={s.disciplines}/>
   <RatedList title="Hintergründe" value={s.backgrounds}/>
   <Group title="Tugenden">{virtueNames.map(name=><Row key={name} name={name} value={virtues[name]??null}/>)}</Group>
  </div>
  <div className={styles.columns2}>
   <RatedList title="Vorzüge" value={s.merits} metric="cost"/>
   <RatedList title="Schwächen" value={s.flaws} metric="cost"/>
  </div>
  {list(s.paths).length>0&&<RatedList title="Pfade" value={s.paths}/>}
  <Group title="Clansschwäche">{text(s.clanWeakness)?<RichTextView value={String(s.clanWeakness)}/>:<p className={styles.empty}>Keine Angabe.</p>}</Group>
 </div>,
 right:<div className={styles.sheet}>
  <SheetHeading id="journal-states">Zustände</SheetHeading>
  {checkHint}
  <p className={styles.liveHint} data-live={live||undefined}>{live?'Aktuelle Werte live vom Spieltisch':'Gespeicherte Bogenwerte · der Tisch meldet für diese Figur keine Live-Werte'}</p>
  <div className={styles.columns2}>
   <Group title={text(s.humanityPath)||'Menschlichkeit'}><Dots name={text(s.humanityPath)||'Menschlichkeit'} value={sheetNumber(s.humanity)} min={10}/></Group>
   <Group title="Willenskraft">
    <div className={styles.stateLine}><small>Permanent</small><Dots name="Willenskraft permanent" value={v.willpower.permanent} min={10}/></div>
    <div className={styles.stateLine}><small>Temporär</small><Boxes name="Willenskraft temporär" value={v.willpower.temporary} max={Math.max(10,v.willpower.permanent??0)}/></div>
   </Group>
  </div>
  <Group title="Blutvorrat">
   <Boxes name="Blutvorrat" value={v.blood.current} max={v.blood.max}/>
   <p className={styles.stateText}>{v.blood.current??'–'} von {v.blood.max??'–'} · pro Runde {v.blood.perTurn??'–'}{v.blood.maxSource==='generation'?' · Maximum aus der Generation':''}</p>
  </Group>
  <Group title="Gesundheit">
   <ol className={styles.health}>{vitalHealthLevels.map((level,i)=><li key={level.name} data-hit={i<track.length||undefined}><span>{level.name}</span><small>{level.penalty===null?'':level.penalty===0?'':level.penalty}</small><i aria-label={i<track.length?damageLabels[track[i]]:'frei'}>{i<track.length?damageMarks[track[i]]:''}</i></li>)}</ol>
   <p className={styles.stateText}>{v.health.status==='torpor'?'Starre':v.health.status==='final-death'?'Endgültiger Tod':v.health.level}{v.health.penalty?' · Würfelabzug '+v.health.penalty:''}</p>
  </Group>
  <Group title="Erfahrung"><Field label="Freie EP" value={prog.freeXp}/><Field label="Erhaltene EP" value={prog.totalXp}/></Group>
 </div>};
}

export function sheetStory({p}:{p:CharacterDetailProjection}){
 const r=p.roleplay;
 return {left:<div className={styles.sheet}>
  <SheetHeading id="journal-story">Hintergrundgeschichte</SheetHeading>
  {text(r.backgroundStory)?<RichTextView value={String(r.backgroundStory)} readable/>:<p className={styles.empty}>Noch keine Geschichte hinterlegt. Gepflegt wird sie in der Charakterverwaltung.</p>}
 </div>,
 right:<div className={styles.sheet}>
  <SheetHeading>Spielweise & Ziele</SheetHeading>
  {text(r.playGuide)?<RichTextView value={String(r.playGuide)} readable/>:<p className={styles.empty}>Keine Angaben.</p>}
  <p className={styles.hint}>Porträt, Geschichte und reguläre Bogenänderungen bleiben in der Charakterverwaltung. Das Journal zeigt sie nur an.</p>
 </div>};
}
