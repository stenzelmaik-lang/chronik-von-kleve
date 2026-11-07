'use client';
import {useEffect,useState} from 'react';
import {ATTRIBUTES,resolveFigure,typeById,type TierId} from '@/domain/standard-figures';
import {v20AbilityNames} from '@/domain/character-engine';
import {figureTemplateSchema,resolveFigureTemplate,type FigureTemplate,type FigureTemplateInput} from '@/domain/figure-templates';
import {api} from './api-client';
import styles from './figure-template-library.module.css';

type Props={typeId:string;tierId:TierId;selected:FigureTemplate|null;onSelect:(value:FigureTemplate|null)=>void;disabled?:boolean;onLoaded?:(templates:FigureTemplate[])=>void};
export function FigureTemplateLibrary({typeId,tierId,selected,onSelect,disabled=false,onLoaded}:Props){
  const [templates,setTemplates]=useState<FigureTemplate[]>([]),[draft,setDraft]=useState<FigureTemplateInput|null>(null);
  const [version,setVersion]=useState(0),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{
    let active=true;
    api<{templates:FigureTemplate[]}>('/api/figure-templates').then(result=>{if(active){setTemplates(result.templates);onLoaded?.(result.templates);setLoaded(true);}}).catch(issue=>{if(active)setError(issue.message);});
    return()=>{active=false;};
  },[onLoaded]);
  function begin(existing?:FigureTemplate){
    if(draft&&!window.confirm('Offene Änderungen an der Figurenvorlage verwerfen?'))return;
    const stats=existing?resolveFigureTemplate(existing):resolveFigure(typeId,tierId);
    if(!stats)return;
    setDraft({id:existing?.id||crypto.randomUUID(),name:existing?.name||typeById(typeId)?.name||'',typeId:existing?.typeId||typeId,tierId:existing?.tierId||tierId,
      attributes:{...stats.attributes},skills:{...stats.skills},willpower:stats.willpower,bloodMax:stats.bloodMax});
    setVersion(existing?.version||0);setError('');setNotice('');
  }
  async function save(){
    if(!draft)return;
    const parsed=figureTemplateSchema.safeParse(draft);
    if(!parsed.success){setError('Gib einen Namen und gültige ganze Werte ein. Attribute und Fähigkeiten liegen zwischen 0 und 10.');return;}
    setBusy(true);setError('');setNotice('');
    try{
      const result=await api<{template:FigureTemplate}>('/api/figure-templates','POST',{template:parsed.data,expectedVersion:version});
      setTemplates(current=>[...current.filter(item=>item.id!==result.template.id),result.template]);
      onLoaded?.([...templates.filter(item=>item.id!==result.template.id),result.template]);onSelect(result.template);setDraft(null);setNotice('Vorlage gespeichert und ausgewählt.');
    }catch(issue){setError((issue as Error).message);}finally{setBusy(false);}
  }
  const locked=disabled||busy;
  const skills=draft?[...new Set([...v20AbilityNames,...Object.keys(draft.skills)])]:[];
  return <section className={styles.library} aria-label="Gespeicherte Gegnervorlagen">
    <div className={styles.toolbar}>
      <label>Gespeicherte Gegnervorlage<select aria-label="Gespeicherte Gegnervorlage" value={selected?.id||''} disabled={locked||!loaded} onChange={event=>{onSelect(templates.find(item=>item.id===event.target.value)||null);setNotice('');}}>
        <option value="">{loaded?'Basisfigur verwenden':'Bibliothek wird geladen …'}</option>
        {[...templates].sort((a,b)=>a.name.localeCompare(b.name,'de')).map(template=><option key={template.id} value={template.id}>{template.name} · Version {template.version}</option>)}
      </select></label>
      <button type="button" className="button" disabled={locked} onClick={()=>begin()}>Neue Vorlage aus Basisfigur</button>
      {selected&&<button type="button" className="button" disabled={locked} onClick={()=>begin(selected)}>Werte der Vorlage bearbeiten</button>}
    </div>
    <p className={styles.hint}>{selected?`„${selected.name}“ wird mit den gespeicherten Werten eingesetzt. Laufende Figuren behalten ihre Werte bei späteren Vorlagenänderungen.`:'Speichere eigene Gegnertypen mit Namen und Werten. Sie stehen kampagnenweit in der Vorbereitung und Live-Regie zur Auswahl.'}</p>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {draft&&<fieldset className={styles.editor} disabled={locked}>
      <legend>{version?'Figurenvorlage bearbeiten':'Neue Figurenvorlage'}</legend>
      <label>Name der Vorlage<input maxLength={60} value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/></label>
      <p className={styles.hint}>Die Basisfigur legt die Schnellaktionen fest. Deren Würfelpools werden aus deinen Attributen und Fähigkeiten berechnet.</p>
      <fieldset><legend>Attribute</legend><div className={styles.ratings}>{ATTRIBUTES.map(name=><label key={name}>{name}<input aria-label={`Attribut ${name}`} type="number" min={0} max={10} step={1} value={Number.isNaN(draft.attributes[name])?'':draft.attributes[name]} onChange={event=>setDraft({...draft,attributes:{...draft.attributes,[name]:event.target.value===''?NaN:Number(event.target.value)}})}/></label>)}</div></fieldset>
      <details><summary>Fähigkeiten bearbeiten</summary><div className={styles.ratings}>{skills.map(name=><label key={name}>{name}<input aria-label={`Fähigkeit ${name}`} type="number" min={0} max={10} step={1} value={Number.isNaN(draft.skills[name])?'':draft.skills[name]??0} onChange={event=>setDraft({...draft,skills:{...draft.skills,[name]:event.target.value===''?NaN:Number(event.target.value)}})}/></label>)}</div></details>
      <div className={styles.ratings}>
        <label>Willenskraft<input type="number" min={0} max={10} step={1} value={Number.isNaN(draft.willpower)?'':draft.willpower} onChange={event=>setDraft({...draft,willpower:event.target.value===''?NaN:Number(event.target.value)})}/></label>
        <label>Blutvorrat<input type="number" min={0} max={30} step={1} placeholder="Kein Blutvorrat" value={draft.bloodMax===null||Number.isNaN(draft.bloodMax)?'':draft.bloodMax} onChange={event=>setDraft({...draft,bloodMax:event.target.value===''?null:Number(event.target.value)})}/></label>
      </div>
      <div className={styles.toolbar}><button type="button" className="button" onClick={()=>void save()}>Vorlage speichern</button><button type="button" className="button" onClick={()=>{if(window.confirm('Änderungen an der Vorlage verwerfen?'))setDraft(null);}}>Abbrechen</button></div>
    </fieldset>}
  </section>;
}
