"use client";
import {useMemo,useState} from 'react';
import {Minus,Plus,Trash2,X} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {characterSheetFields,validateExistingSheet} from '@/domain/character-management';
import {generationLimits} from '@/domain/character-vitals';
import {hybridPreparationNote,newSpecialtyId,specialtyRatingError,specialtyTargetKey,SPECIALTY_MINIMUM_RATING,traitRating,type Specialty} from '@/domain/character-specialties';
import {W10_ABILITY_KEYS,W10_ATTRIBUTE_KEYS} from '@/domain/trait-ids';
import {CUSTOM_ABILITY_CATEGORIES,newCustomAbilityId,readCustomAbilities} from '@/domain/custom-abilities';
import {creationDeviation} from '@/domain/character-engine';
import {clansForCampaign} from '@/domain/clan-config';
import {attrsGroups,skillGroups} from './character';
import sheet from './character-sheet.module.css';

type Body=Record<string,unknown>;
type Row={id?:string;name:string;value?:number;cost?:number;category?:string;primary?:boolean;active?:boolean};
const map=(v:unknown):Record<string,number>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,number>:{};
const rows=(v:unknown):Row[]=>Array.isArray(v)?(v as Row[]).filter(r=>r&&typeof r==='object'):[];
const str=(v:unknown)=>typeof v==='string'?v:v===undefined||v===null?'':String(v);
const fieldLabels:Record<string,string>={player:'Spieler',chronicle:'Chronik',nature:'Wesen',demeanor:'Verhalten',concept:'Konzept',clan:'Clan',generation:'Generation',sire:'Erzeuger',attributes:'Attribute',skills:'Fähigkeiten',specialties:'Spezialisierungen',customAbilities:'Weitere Fähigkeiten',disciplines:'Disziplinen',backgrounds:'Hintergründe',virtues:'Tugenden',humanity:'Menschlichkeit / Pfad',humanityPath:'Pfad',willpower:'Willenskraft',bloodMax:'Blutvorrat',bloodPerRound:'Blut pro Runde',merits:'Vorzüge',flaws:'Schwächen',clanWeakness:'Clansschwäche',individualInfo:'Individuelle Angaben',text:'Geschichte',goals:'Ziele',characterPermissions:'Freigaben',paths:'Pfade',title:'Name',playGuide:'Spielhilfe',inventory:'Ausrüstung'};
const listFields=['customAbilities','disciplines','paths','backgrounds','merits','flaws'];
export const sheetFieldLabel=(key:string)=>fieldLabels[key]??key;
const allDisciplines=[...new Set(clansForCampaign('chronik-von-kleve').flatMap(c=>c.disciplines))].sort((a,b)=>a.localeCompare(b,'de'));
const commonBackgrounds=['Status','Ressourcen','Zuflucht','Herde','Mentor','Verbündete','Kontakte','Einfluss','Gefolgsleute','Generation','Ruhm'];

/** Paper-sheet rating: tap a dot to set the value, tap the highest dot again to lower by one. */
export function DotInput({value,onChange,max=5,label,high=false}:{value:number;onChange:(n:number)=>void;max?:number;label:string;high?:boolean}){
  const limit=Math.max(max,high?10:max,value);
  return <span className={sheet.dotInput} role="group" aria-label={label+': '+value}>
    {Array.from({length:limit},(_,i)=><button type="button" key={i} className={i<value?sheet.dotOn:sheet.dot} data-extra={i>=max||undefined} aria-label={`${label} auf ${i+1} setzen`} aria-pressed={i<value} onClick={()=>onChange(value===i+1?i:i+1)}/>)}
    <output aria-hidden>{value}</output>
  </span>;
}
/** Empty means "not recorded"; the first step starts at the fallback instead of inventing a stored value. */
function Stepper({value,onChange,min=0,max,label,fallback=min}:{value:number|null;onChange:(n:number)=>void;min?:number;max:number;label:string;fallback?:number}){
  return <span className={sheet.stepper}><button type="button" aria-label={label+' verringern'} disabled={value!==null&&value<=min} onClick={()=>onChange(value===null?fallback:value-1)}><Minus size={14}/></button><input aria-label={label} inputMode="numeric" placeholder="–" value={value??''} onChange={e=>{const digits=e.target.value.replace(/\D/g,'');if(!digits)return;onChange(Math.max(min,Math.min(max,Number(digits))));}}/><button type="button" aria-label={label+' erhöhen'} disabled={value!==null&&value>=max} onClick={()=>onChange(value===null?fallback:value+1)}><Plus size={14}/></button></span>;
}
const numberOrNull=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;

function RowList({label,value,onChange,metric,suggestions,high,primary=false,custom=false}:{label:string;value:unknown;onChange:(v:unknown)=>void;metric:'value'|'cost';suggestions?:string[];high:boolean;primary?:boolean;custom?:boolean}){
  if(typeof value==='string')return <div className={sheet.legacyText}><p>Historischer Freitext – bleibt erhalten, bis du ihn in Einträge umwandelst.</p><textarea aria-label={label} value={value} onChange={e=>onChange(e.target.value)}/><button type="button" className="button" onClick={()=>onChange(value.split(/[\n,;]/).map(s=>s.trim()).filter(Boolean).map(name=>({name,[metric]:0})))}>In Einträge umwandeln</button></div>;
  const list=rows(value),listId=suggestions?'sugg-'+label.replace(/\W/g,''):undefined;
  return <div className={sheet.rowList}>
    {listId&&<datalist id={listId}>{suggestions!.map(s=><option key={s} value={s}/>)}</datalist>}
    {list.map((row,i)=><div className={sheet.rowItem} key={i}>
      <input aria-label={`${label} ${i+1} Name`} list={listId} placeholder="Name" value={row.name??''} maxLength={120} onChange={e=>onChange(list.map((r,j)=>j===i?{...r,name:e.target.value}:r))}/>
      {metric==='value'?<DotInput label={row.name||label} value={Number(row.value??0)} high={high} onChange={n=>onChange(list.map((r,j)=>j===i?{...r,value:n}:r))}/>:<Stepper label={`${row.name||label} Punkte`} value={Number(row.cost??0)} max={99} onChange={n=>onChange(list.map((r,j)=>j===i?{...r,cost:n}:r))}/>}
      {custom&&row.id&&<select aria-label={`${row.name||label} Kategorie`} value={row.category??''} onChange={e=>onChange(list.map((r,j)=>j===i?{...r,category:e.target.value}:r))}><option value="">Kategorie wählen</option>{Object.keys(CUSTOM_ABILITY_CATEGORIES).map(c=><option key={c} value={c}>{c}</option>)}</select>}
      {custom&&row.id&&<label className={sheet.primaryToggle}><input type="checkbox" checked={row.active!==false} onChange={e=>onChange(list.map((r,j)=>{if(j!==i)return r;const next={...r};if(e.target.checked)delete next.active;else next.active=false;return next;}))}/>Aktiv</label>}
      {custom&&!row.id&&<p className={sheet.hint} style={{gridColumn:'1/-1'}}>Bestandseintrag ohne feste ID: bleibt unverändert erhalten, ist aber erst nach der Bestandsprüfung würfelbar.</p>}
      {primary&&<label className={sheet.primaryToggle}><input type="radio" name={'primary-'+label} checked={row.primary===true} onChange={()=>onChange(list.map((r,j)=>({...r,primary:j===i})))}/>Primär</label>}
      <button type="button" className={sheet.iconButton} aria-label={`${row.name||label} entfernen`} onClick={()=>onChange(list.filter((_,j)=>j!==i))}><Trash2 size={15}/></button>
    </div>)}
    <button type="button" className={sheet.addRow} onClick={()=>onChange([...list,{...(custom?{id:newCustomAbilityId(),category:''}:{}),name:'',[metric]:metric==='value'?1:1}])}><Plus size={14}/>{label} hinzufügen</button>
  </div>;
}

type SpecialtyDraft=Omit<Specialty,'target'>&{target:{kind:Specialty['target']['kind'];id:string}};
const specialtyRows=(v:unknown):SpecialtyDraft[]=>Array.isArray(v)?(v as SpecialtyDraft[]).filter(r=>r&&typeof r==='object'):[];
/** Specialties per V20: bound to one attribute or ability by its stable ID; inactive instead of silently lost. */
function SpecialtyList({value,body,onChange}:{value:unknown;body:Body;onChange:(v:unknown)=>void}){
  const list=specialtyRows(value);
  const update=(i:number,patch:Partial<SpecialtyDraft>)=>onChange(list.map((r,j)=>j===i?{...r,...patch}:r));
  return <div className={sheet.rowList}>
    {list.map((row,i)=>{const key=specialtyTargetKey(row.target as Specialty['target'],body),rating=key?traitRating(body,row.target as Specialty['target'])??0:null;
      return <div className={sheet.rowItem} key={row.id}>
      <select aria-label={`Spezialisierung ${i+1} gehört zu`} value={row.target.id?row.target.kind+':'+row.target.id:''} onChange={e=>{const [kind,id]=e.target.value.split(':');update(i,{target:{kind:kind as Specialty['target']['kind'],id}});}}>
        <option value="">Eigenschaft oder Fähigkeit wählen</option>
        <optgroup label="Attribute">{Object.entries(W10_ATTRIBUTE_KEYS).map(([id,label])=><option key={id} value={'attribute:'+id}>{label}</option>)}</optgroup>
        <optgroup label="Fähigkeiten">{Object.entries(W10_ABILITY_KEYS).map(([id,label])=><option key={id} value={'ability:'+id}>{label}</option>)}</optgroup>
        {readCustomAbilities(body).length>0&&<optgroup label="Eigene Fähigkeiten">{readCustomAbilities(body).map(c=><option key={c.id} value={'customAbility:'+c.id}>{c.name}{c.active===false?' (deaktiviert)':''}</option>)}</optgroup>}
      </select>
      <button type="button" className={sheet.iconButton} aria-label={`${row.name||'Spezialisierung'} entfernen`} onClick={()=>onChange(list.filter((_,j)=>j!==i))}><Trash2 size={15}/></button>
      <input aria-label={`Spezialisierung ${i+1} Name`} placeholder="Spezialisierung, z. B. Säbel" value={row.name??''} maxLength={120} onChange={e=>update(i,{name:e.target.value})}/>
      <input aria-label={`Spezialisierung ${i+1} Geltungsbereich`} placeholder="Geltungsbereich (optional)" value={row.scope??''} maxLength={500} onChange={e=>update(i,{scope:e.target.value||undefined})}/>
      <label className={sheet.primaryToggle}><input type="checkbox" checked={row.active!==false} onChange={e=>update(i,{active:e.target.checked?undefined:false})}/>Aktiv</label>
      {key&&rating!==null&&rating<SPECIALTY_MINIMUM_RATING&&<p className={sheet.hint} style={{gridColumn:'1/-1'}}>{key} hat {rating} Punkte. Ab {SPECIALTY_MINIMUM_RATING} wirkt die Spezialisierung (jede 10 zählt doppelt).</p>}
    </div>;})}
    <button type="button" className={sheet.addRow} onClick={()=>onChange([...list,{id:newSpecialtyId(),target:{kind:'ability',id:''},name:''}])}><Plus size={14}/>Spezialisierung hinzufügen</button>
    <p className={sheet.hint}>Nur für Werte ab {SPECIALTY_MINIMUM_RATING}. Eine Pflicht-Fachrichtung (etwa bei Handwerk) ist keine Spezialisierung.</p>
  </div>;
}

export type SheetEditorProps={open:boolean;onOpenChange:(open:boolean)=>void;title:string;sheet:Body;mode:'sl'|'player';busy:boolean;error:string;historical:boolean;onSave:(patch:Body,title:string,reason:string)=>Promise<boolean>};
export function CharacterSheetEditor({open,onOpenChange,title,sheet:initial,mode,busy,error,historical,onSave}:SheetEditorProps){
  return <Dialog open={open} onOpenChange={next=>{if(!busy)onOpenChange(next);}}>{open&&<EditorBody key={title} title={title} initial={initial} mode={mode} busy={busy} error={error} historical={historical} onClose={()=>onOpenChange(false)} onSave={onSave}/>}</Dialog>;
}

function EditorBody({title:initialTitle,initial,mode,busy,error,historical,onClose,onSave}:{title:string;initial:Body;mode:'sl'|'player';busy:boolean;error:string;historical:boolean;onClose:()=>void;onSave:SheetEditorProps['onSave']}){
  const [body,setBody]=useState<Body>(()=>structuredClone(initial)),[title,setTitle]=useState(initialTitle),[reason,setReason]=useState(''),[high,setHigh]=useState(()=>[...Object.values(map(initial.attributes)),...Object.values(map(initial.skills))].some(v=>Number(v)>5)),[section,setSection]=useState('identity'),[showChanges,setShowChanges]=useState(false);
  const bloodLimits=generationLimits(body.generation);
  const set=(key:string,value:unknown)=>setBody(prev=>({...prev,[key]:value}));
  const setIn=(key:string,name:string,value:number)=>setBody(prev=>({...prev,[key]:{...map(prev[key]),[name]:value}}));
  // Freshly added rows without a name are drafts, not data: they are dropped instead of blocking the save.
  const cleaned=useMemo(()=>Object.fromEntries(Object.entries(body).map(([key,value])=>[key,(listFields.includes(key)||key==='specialties')&&Array.isArray(value)?(value as Row[]).filter(row=>String(row?.name??'').trim()):value])),[body]);
  const changed=useMemo(()=>characterSheetFields.filter(key=>JSON.stringify(cleaned[key]??null)!==JSON.stringify(initial[key]??null)),[cleaned,initial]);
  const deviation=useMemo(()=>creationDeviation(cleaned),[cleaned]);
  const invalid=useMemo(()=>{const error=validateExistingSheet(cleaned)??specialtyRatingError(cleaned,initial);return error&&error.replace(/: (\w+)/,(_,key:string)=>': '+sheetFieldLabel(key));},[cleaned,initial]);
  const dirty=changed.length>0||title.trim()!==initialTitle;
  async function save(){const patch=Object.fromEntries(changed.map(key=>[key,cleaned[key]]));if(!Object.keys(patch).length)patch.concept=cleaned.concept??'';if(await onSave(patch,title.trim(),reason))onClose();}
  function close(){if(dirty&&!window.confirm('Ungespeicherte Änderungen am Bogen verwerfen?'))return;onClose();}
  const text=(key:string,label:string,props:{wide?:boolean;area?:boolean}={})=><label className={props.wide?sheet.wide:undefined}><span>{label}</span>{props.area?<textarea aria-label={label} value={str(body[key])} maxLength={30000} onChange={e=>set(key,e.target.value)}/>:<input aria-label={label} value={str(body[key])} maxLength={300} onChange={e=>set(key,e.target.value)}/>}</label>;
  const virtues=map(body.virtues);
  const virtuePairs:Array<[string,string]>=[['Gewissen','Überzeugung'],['Selbstbeherrschung','Instinkt']];
  const sections=[['identity','Identität'],['attributes','Attribute'],['abilities','Fähigkeiten'],['advantages','Vorteile'],['state','Menschlichkeit & Blut'],['traits','Vorzüge & Notizen']];
  const jump=(id:string)=>{setSection(id);document.getElementById('cvk-sheet-'+id)?.scrollIntoView({behavior:'smooth',block:'start'});};
  const clans=clansForCampaign('chronik-von-kleve');
  return <DialogContent className={sheet.editor} showCloseButton={false} onEscapeKeyDown={e=>{if(dirty){e.preventDefault();close();}}} onInteractOutside={e=>e.preventDefault()}>
    <header className={sheet.editorHead}>
      <div><p className={sheet.eyebrow}>{mode==='sl'?'Spielleitung · Bogen korrigieren':historical?'Bestandsbogen nachtragen':'Freigegebene Bearbeitung'}</p><DialogTitle className={sheet.title}>{title.trim()||'Charakterbogen'}</DialogTitle>
        <DialogDescription>{mode==='sl'?'Werte wie auf dem Papierbogen übernehmen oder korrigieren. Keine Erschaffungsbudgets, XP bleiben unverändert.':'Trage die Werte deines gespielten Papierbogens ein. Die Spielleitung prüft die Übernahme danach.'}</DialogDescription></div>
      <button type="button" className={sheet.iconButton} aria-label="Bogen schließen" onClick={close}><X size={20}/></button>
    </header>
    <nav className={sheet.sectionNav} aria-label="Bogenbereiche">{sections.map(([id,label])=><button type="button" key={id} aria-current={section===id||undefined} onClick={()=>jump(id)}>{label}</button>)}<label className={sheet.highToggle}><input type="checkbox" checked={high} onChange={e=>setHigh(e.target.checked)}/>Werte über 5 zulassen</label></nav>
    <div className={sheet.editorScroll}>
      <section id="cvk-sheet-identity" className={sheet.block}><h3>Identität</h3><div className={sheet.identityGrid}>
        <label className={sheet.wide}><span>Name</span><input aria-label="Charaktername" value={title} maxLength={160} onChange={e=>setTitle(e.target.value)}/></label>
        {text('player','Spieler')}{text('nature','Wesen')}
        <label><span>Clan</span><select aria-label="Clan" value={str(body.clan)} onChange={e=>set('clan',e.target.value)}><option value="">Nicht angegeben</option>{!clans.some(c=>c.label===str(body.clan))&&str(body.clan)&&<option value={str(body.clan)}>{str(body.clan)} (gespeichert)</option>}{clans.map(c=><option key={c.id} value={c.label}>{c.label}</option>)}</select></label>
        {text('chronicle','Chronik')}{text('demeanor','Verhalten')}
        <label><span>Generation</span><Stepper label="Generation" value={numberOrNull(body.generation)} fallback={13} min={3} max={20} onChange={n=>set('generation',n)}/></label>
        {text('concept','Konzept')}{text('sire','Erzeuger')}
      </div></section>
      <section id="cvk-sheet-attributes" className={sheet.block}><h3>Attribute</h3><div className={sheet.columns}>{attrsGroups.map(([group,names])=><div key={group}><h4>{group==='Sozial'?'Gesellschaftlich':group==='Mental'?'Geistig':group}</h4>{names.map(name=><div className={sheet.ratingRow} key={name}><span>{name}</span><DotInput label={name} high={high} value={Number(map(body.attributes)[name]??(name==='Erscheinungsbild'&&str(body.clan).toLowerCase()==='nosferatu'?0:1))} onChange={n=>setIn('attributes',name,n)}/></div>)}</div>)}</div></section>
      <section id="cvk-sheet-abilities" className={sheet.block}><h3>Fähigkeiten</h3><div className={sheet.columns}>{skillGroups.map(([group,names])=><div key={group}><h4>{group}</h4>{names.map(name=><div className={sheet.ratingRow} key={name}><span>{name}</span><DotInput label={name} high={high} value={Number(map(body.skills)[name]??0)} onChange={n=>setIn('skills',name,n)}/></div>)}</div>)}</div>
        {Object.keys(map(body.skills)).filter(name=>!skillGroups.some(([,names])=>(names as readonly string[]).includes(name))).length>0&&<div className={sheet.subBlock}><h4>Weitere gespeicherte Fähigkeiten</h4>{Object.keys(map(body.skills)).filter(name=>!skillGroups.some(([,names])=>(names as readonly string[]).includes(name))).map(name=><div className={sheet.ratingRow} key={name}><span>{name}</span><DotInput label={name} high={high} value={Number(map(body.skills)[name]??0)} onChange={n=>setIn('skills',name,n)}/></div>)}</div>}
        <div className={sheet.subBlock}><h4>Spezialisierungen</h4>{hybridPreparationNote()&&<p className={sheet.hint} data-hybrid-preparation>{hybridPreparationNote()}</p>}<SpecialtyList value={body.specialties??[]} body={body} onChange={v=>set('specialties',v)}/></div>
        <div className={sheet.subBlock}><h4>Zusätzliche Fähigkeiten (freie Zeilen des Bogens)</h4>{hybridPreparationNote()&&<p className={sheet.hint} data-hybrid-preparation>Kategorie und „Aktiv“: {hybridPreparationNote()}</p>}<RowList label="Fähigkeit" value={body.customAbilities??[]} onChange={v=>set('customAbilities',v)} metric="value" high={high} custom/></div>
      </section>
      <section id="cvk-sheet-advantages" className={sheet.block}><h3>Vorteile</h3><div className={sheet.columns}>
        <div><h4>Disziplinen</h4><RowList label="Disziplin" value={body.disciplines??[]} onChange={v=>set('disciplines',v)} metric="value" suggestions={allDisciplines} high={high}/>
          {(rows(body.disciplines).some(r=>['Thaumaturgie','Nekromantie'].includes(r.name))||rows(body.paths).length>0)&&<div className={sheet.subBlock}><h4>Pfade</h4><RowList label="Pfad" value={body.paths??[]} onChange={v=>set('paths',v)} metric="value" high={high} primary/><p className={sheet.hint}>Der Primärpfad entspricht dem Disziplinwert. Sekundärpfade dürfen ihn nicht übersteigen.</p></div>}</div>
        <div><h4>Hintergründe</h4><RowList label="Hintergrund" value={body.backgrounds??[]} onChange={v=>set('backgrounds',v)} metric="value" suggestions={commonBackgrounds} high={high}/></div>
        <div><h4>Tugenden</h4>{virtuePairs.map(([classic,alt])=>{const name=alt in virtues&&!(classic in virtues)?alt:classic;return <div className={sheet.ratingRow} key={classic}><select aria-label={`Tugend ${classic} oder ${alt}`} value={name} onChange={e=>{const next={...virtues};const v=next[name]??1;delete next[name];next[e.target.value]=v;set('virtues',next);}}><option value={classic}>{classic}</option><option value={alt}>{alt}</option></select><DotInput label={name} value={Number(virtues[name]??1)} onChange={n=>setIn('virtues',name,n)}/></div>;})}
          <div className={sheet.ratingRow}><span>Mut</span><DotInput label="Mut" value={Number(virtues.Mut??1)} onChange={n=>setIn('virtues','Mut',n)}/></div>
          {!body.virtues&&<p className={sheet.hint}>Noch keine Tugenden gespeichert – die angezeigten Startwerte werden erst beim Ändern übernommen.</p>}</div>
      </div></section>
      <section id="cvk-sheet-state" className={sheet.block}><h3>Menschlichkeit, Willenskraft & Blut</h3><div className={sheet.columns}>
        <div><h4>Menschlichkeit / Pfad</h4><label className={sheet.compact}><span>Pfad (leer = Menschlichkeit)</span><input aria-label="Pfad" value={str(body.humanityPath)} maxLength={120} onChange={e=>set('humanityPath',e.target.value)}/></label><DotInput label="Menschlichkeit oder Pfad" max={10} value={Number(body.humanity??0)} onChange={n=>set('humanity',n)}/></div>
        <div><h4>Willenskraft (permanent)</h4><DotInput label="Willenskraft" max={10} value={Number(body.willpower??0)} onChange={n=>set('willpower',n)}/><p className={sheet.hint}>Die temporäre Willenskraft wird am Spieltisch geführt{typeof initial.willpowerTemporary==='number'?` (aktuell ${initial.willpowerTemporary})`:''}.</p></div>
        <div><h4>Blutvorrat</h4>{bloodLimits ? <p className={sheet.hint}>Maximum {bloodLimits.bloodMax} · {bloodLimits.perTurn} pro Runde · aus Generation</p> :
            <><label className={sheet.compact}><span>Maximum</span><Stepper label="Blutvorrat Maximum" value={numberOrNull(body.bloodMax)} fallback={10} max={100} onChange={n=>set('bloodMax',n)}/></label><label className={sheet.compact}><span>Pro Runde</span><Stepper label="Blut pro Runde" value={numberOrNull(body.bloodPerRound)} fallback={1} max={100} onChange={n=>set('bloodPerRound',n)}/></label></>}</div>
      </div></section>
      <section id="cvk-sheet-traits" className={sheet.block}><h3>Vorzüge, Schwächen & Angaben</h3><div className={sheet.columns}>
        <div><h4>Vorzüge</h4><RowList label="Vorzug" value={body.merits??[]} onChange={v=>set('merits',v)} metric="cost" high={false}/></div>
        <div><h4>Schwächen</h4><RowList label="Schwäche" value={body.flaws??[]} onChange={v=>set('flaws',v)} metric="cost" high={false}/></div>
        <div>{text('clanWeakness','Clansschwäche',{area:true})}</div>
      </div><div className={sheet.identityGrid}>{text('individualInfo','Individuelle Angaben (Rückseite des Bogens)',{wide:true,area:true})}</div></section>
    </div>
    <footer className={sheet.editorFoot}>
      <details className={sheet.deviation}><summary>{deviation.over>0?`${deviation.over} Punkte über dem Erschaffungsrahmen`:'Innerhalb des Erschaffungsrahmens'}</summary><div className={sheet.popover}><p>Nur zur Orientierung: erspielte Entwicklung ist bei Bestandsbögen erlaubt und wird nicht in XP umgerechnet.</p><ul>{deviation.lines.map(l=><li key={l.key} data-over={l.over>0||undefined}><span>{l.label}</span><b>{l.spent} / {l.limit}</b></li>)}</ul></div></details>
      <button type="button" className={sheet.changeCount} aria-expanded={showChanges} onClick={()=>setShowChanges(v=>!v)} disabled={!changed.length}>{changed.length} {changed.length===1?'Bereich':'Bereiche'} geändert</button>
      {showChanges&&changed.length>0&&<p className={sheet.changeList}>{changed.map(sheetFieldLabel).join(' · ')}</p>}
      <label className={sheet.reason}><span>Grund der Änderung</span><input aria-label="Grund der Bogenänderung" value={reason} maxLength={2000} placeholder={mode==='sl'?'z. B. Übernahme Papierbogen, Seite 1':'z. B. Werte vom Papierbogen nachgetragen'} onChange={e=>setReason(e.target.value)}/></label>
      {(invalid||error)&&<p role="alert" className={sheet.error}>{invalid||error}</p>}
      <div className={sheet.footActions}><button type="button" className="button" disabled={busy} onClick={close}>Abbrechen</button><button type="button" className="button primary" disabled={busy||!dirty||!!invalid||reason.trim().length<3||!title.trim()} title={reason.trim().length<3?'Bitte kurz begründen.':undefined} onClick={()=>void save()}>{busy?'Speichert …':'Bogen speichern'}</button></div>
    </footer>
  </DialogContent>;
}
