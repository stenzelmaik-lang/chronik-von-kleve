"use client";
import { useEffect, useState } from 'react';
import { ShieldCheck, NotebookPen, Mail } from 'lucide-react';
import type { CharacterEngineView } from '@/domain/character-live';
import styles from './character-studio.module.css';

const identityLabels:Record<string,string>={concept:'Konzept',nature:'Wesen',demeanor:'Verhalten',sire:'Erzeuger'};
type Props={data:CharacterEngineView;busy:boolean;command:(action:string,extra?:Record<string,unknown>)=>Promise<boolean>;onConfirm?:()=>void;onDirty?:(dirty:boolean)=>void};
export function CharacterManagement({data,busy,command,onDirty}:Props) {
  const [action,setAction]=useState('review');
  const [exceptionCategory,setExceptionCategory]=useState('appearance'),[exceptionTarget,setExceptionTarget]=useState(''),[exceptionRating,setExceptionRating]=useState(0),[exceptionMaximum,setExceptionMaximum]=useState(3),[exceptionReason,setExceptionReason]=useState('');
  const [decisionRating,setDecisionRating]=useState(0),[decisionMaximum,setDecisionMaximum]=useState(3);
  const [decisionReason,setDecisionReason]=useState(''),[decisionCost,setDecisionCost]=useState(1);
  const [noteDraft,setNotes]=useState<string|null>(null);
  const notes=noteDraft??data.gmNotes??'', notesDirty=notes!==(data.gmNotes||'');
  useEffect(()=>{onDirty?.(notesDirty);},[notesDirty,onDirty]);
  const pending=data.requests.filter(r=>r.status==='pending');
    return <>
    <nav className={styles.managementActions} aria-label="SL-Charakteraktionen">
      <button type="button" aria-pressed={action==='review'} onClick={()=>setAction('review')}><ShieldCheck size={16}/>Anträge {pending.length>0&&<b>{pending.length}</b>}</button>
      <button type="button" aria-pressed={action==='notes'} onClick={()=>setAction('notes')}><NotebookPen size={16}/>SL-Notiz{notesDirty&&<b>●</b>}</button>
      <button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('chroniplay:compose-message',{detail:data.ownerId}))}><Mail size={16}/>Persönlicher Brief</button>
    </nav>
    <div className={styles.managementPanel}>
      {action==='review'&&<>
        {pending.length>0?<div className={styles.requests}><h4>{pending.length} {pending.length===1?'offener Antrag':'offene Anträge'}</h4>{pending.map(r=><article key={r.id}><h4>{identityLabels[r.target]||r.target}</h4><p>{r.reason}</p>{r.value&&<blockquote>{r.value}</blockquote>}<label>Begründung der Entscheidung<input aria-label={`Entscheidungsbegründung ${r.id}`} value={decisionReason} onChange={e=>setDecisionReason(e.target.value)}/></label>{(r.category==='merit'||r.category==='flaw')&&<label>Belegte Punktkosten<input aria-label="Genehmigte Punktkosten" type="number" min={0} max={7} value={decisionCost} onChange={e=>setDecisionCost(Number(e.target.value))}/></label>}{(r.category==='appearance'||r.category==='foreignDiscipline')&&<><label>Gewünschter Wert<input aria-label="Genehmigter Eigenschaftswert" type="number" min={0} max={5} value={decisionRating} onChange={e=>setDecisionRating(Number(e.target.value))}/></label><label>Erlaubte Höchststufe<input aria-label="Genehmigte Höchststufe" type="number" min={1} max={5} value={decisionMaximum} onChange={e=>setDecisionMaximum(Number(e.target.value))}/></label><p>Bewusste SL-Korrektur mit Protokoll. XP und historische Erschaffungswerte bleiben unverändert. Ein Erschaffungsentwurf wird vor der Bestätigung nochmals geprüft.</p></>}<div className="actions"><button disabled={busy||decisionReason.trim().length<3} className="button primary" onClick={()=>void command(r.category==='development'?'xp_decision':'resolve_request',{...(r.category==='development'?{}:{asCorrection:true,cost:decisionCost,...(['appearance','foreignDiscipline'].includes(r.category)?{rating:decisionRating,maximum:decisionMaximum}:{})}),requestId:r.id,approved:true,reason:decisionReason})}>Genehmigen</button><button disabled={busy||decisionReason.trim().length<3} className="button" onClick={()=>void command(r.category==='development'?'xp_decision':'resolve_request',{requestId:r.id,approved:false,reason:decisionReason})}>Ablehnen</button></div></article>)}</div>:<p>Keine offenen Anträge.</p>}
      </>}
      {action==='notes'&&<><p>Nur die berechtigte Spielleitung erhält diesen Text. Er wird weder Spielern noch als Brief ausgeliefert.</p><textarea aria-label="Vertrauliche SL-Notiz" value={notes} rows={5} maxLength={30000} onChange={e=>{setNotes(e.target.value);}}/><button className="button primary" disabled={busy||!notesDirty} onClick={async()=>{await command('gm_notes',{text:notes});}}>SL-Notiz speichern</button><span className={styles.explanation}>{notesDirty&&notes!==data.gmNotes?'Ungespeicherte Notiz':'Gespeicherte Notiz'}</span></>}
    </div>
    {<details className={styles.fold}><summary>SL-Regelausnahme & Punkte eintragen</summary><p>Bewusste, protokollierte SL-Korrektur für diesen Charakter. XP und historische Erschaffungswerte bleiben unverändert. Entwürfe müssen vor ihrer Bestätigung weiterhin die Erschaffungsprüfung bestehen.</p><div className={styles.form}><label>Ausnahme<select aria-label="SL-Ausnahmeart" value={exceptionCategory} onChange={e=>setExceptionCategory(e.target.value)}><option value="appearance">Nosferatu · Erscheinungsbild</option><option value="foreignDiscipline">Clansfremde Disziplin</option></select></label>{exceptionCategory==='foreignDiscipline'&&<label>Disziplinname<input aria-label="SL-Ausnahmedisziplin" value={exceptionTarget} onChange={e=>setExceptionTarget(e.target.value)} maxLength={120}/></label>}<label>Einzutragender Wert<input aria-label="SL-Ausnahmewert" type="number" min={0} max={5} value={exceptionRating} onChange={e=>setExceptionRating(Number(e.target.value))}/></label><label>Erlaubte Höchststufe<input aria-label="SL-Ausnahmemaximum" type="number" min={1} max={5} value={exceptionMaximum} onChange={e=>setExceptionMaximum(Number(e.target.value))}/></label><label>Begründung der Ausnahme<input aria-label="SL-Ausnahmebegründung" value={exceptionReason} onChange={e=>setExceptionReason(e.target.value)}/></label><button className="button" disabled={busy||exceptionReason.trim().length<3||exceptionRating>exceptionMaximum||(exceptionCategory==='foreignDiscipline'&&!exceptionTarget.trim())} onClick={()=>void command('grant_exception',{asCorrection:!['draft','review'].includes(data.state),category:exceptionCategory,target:exceptionCategory==='appearance'?'Erscheinungsbild':exceptionTarget,rating:exceptionRating,maximum:exceptionMaximum,reason:exceptionReason})}>Ausnahme genehmigen & Wert speichern</button></div></details>}
    
    
  </>;
}
