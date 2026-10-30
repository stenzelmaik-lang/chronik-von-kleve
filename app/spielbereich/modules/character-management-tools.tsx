"use client";
import {useState} from 'react';
import type {CharacterEngineView} from '@/domain/character-live';
import {characterSheetFields} from '@/domain/character-management';
import {LegacyCharacterFields} from './character';
import type {Entry} from '@/domain/legacy';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Pencil,ShieldCheck,History} from 'lucide-react';
import styles from './character-studio.module.css';

type Props={data:CharacterEngineView;busy:boolean;manage:boolean;campaignId:string;error:string;command:(action:string,extra?:Record<string,unknown>)=>Promise<boolean>};
export function CharacterManagementTools({data,busy,manage,campaignId,error,command}:Props){
  const [editing,setEditing]=useState(false),[draft,setDraft]=useState<Entry|null>(null),[reason,setReason]=useState('');
  const [available,setAvailable]=useState(''),[earned,setEarned]=useState(''),[spent,setSpent]=useState(''),[source,setSource]=useState(''),[historicalReason,setHistoricalReason]=useState('');
  const [editPermission,setEditPermission]=useState(data.permissions.editing),[development,setDevelopment]=useState(data.permissions.development),[permissionReason,setPermissionReason]=useState('');
  const [correction,setCorrection]=useState(''),[reference,setReference]=useState(''),[correctionReason,setCorrectionReason]=useState('');
  const canEdit=manage||data.owner&&data.permissions.editing;
  const startEdit=()=>{setDraft({id:data.id,kind:'charaktere',title:data.title,body:structuredClone(data.sheet),visibility:'private',canEdit:true});setReason('');setEditing(true);};
  const patchBody=(key:string,value:unknown)=>setDraft(previous=>previous?{...previous,body:{...previous.body,[key]:value}}:null);
  const field=(label:string,key:string,large=false,type='text')=> draft&&<label className={large?'field wide':'field'}><span>{label}</span>{large?<textarea aria-label={label} value={String(draft.body[key]??'')} onChange={e=>patchBody(key,e.target.value)} maxLength={30000}/>:<input aria-label={label} type={type} value={String(draft.body[key]??'')} onChange={e=>patchBody(key,type==='number'?(e.target.value===''?null:Number(e.target.value)):e.target.value)}/>}</label>;
  async function saveSheet(){if(!draft)return;const patch=Object.fromEntries(characterSheetFields.filter(key=>JSON.stringify(draft.body[key])!==JSON.stringify(data.sheet[key])).map(key=>[key,draft.body[key]]));if(!Object.keys(patch).length)patch.concept=draft.body.concept??'';if(await command('edit_sheet',{patch,title:draft.title,reason}))setEditing(false);}
  return <section className={styles.managementTools} aria-label="Bogenverwaltung">
    {canEdit&&<button className="button" disabled={busy} onClick={startEdit}><Pencil size={16}/>{manage?'Bogen als SL bearbeiten':'Freigegebenen Bogen bearbeiten'}</button>}
    {!manage&&<p>Bearbeitung: {data.permissions.editing?'von der SL freigegeben':'geschützt'} · Entwicklung: {({direct:'Direktkauf',approval:'mit SL-Prüfung',blocked:'gesperrt'})[data.permissions.development]}</p>}
    {manage&&<>
      {(data.canAdopt||data.needsBaseline)&&<details className={styles.fold}><summary><History size={16}/>{data.needsBaseline?"Bestehenden XP-Verlauf und Ursprung prüfen":"Gespielten Charakter übernehmen"}</summary><p>Die bestehenden Werte bleiben erhalten. Keine Neucharakterbudgets und keine neue Belohnung. Die Bestätigung erfolgt danach gesondert. Gesamt und Verbrauch können unabhängig voneinander unbekannt bleiben.</p><div className={styles.form}>
        {data.needsBaseline&&<p>Der vorhandene XP-Verlauf und sein Saldo von {data.xp.available} XP bleiben unverändert. Hier wird nur der belegte Ursprungsbogen zur gesonderten SL-Bestätigung vorgemerkt.</p>}
        {!data.needsBaseline&&<><label>Verfügbare historische XP<input aria-label="Historische verfügbare XP" type="number" min={0} max={1000000} value={available} onChange={e=>setAvailable(e.target.value)}/></label>
        <label>Historisch erworben · optional<input aria-label="Historische Gesamt-XP" type="number" min={0} value={earned} placeholder="Unbekannt" onChange={e=>setEarned(e.target.value)}/></label>
        <label>Historisch verbraucht · optional<input aria-label="Historische verbrauchte XP" type="number" min={0} value={spent} placeholder="Unbekannt" onChange={e=>setSpent(e.target.value)}/></label></>}
        <label>Beleg / Originalbogen<input aria-label="Quelle der Übernahme" value={source} maxLength={1000} onChange={e=>setSource(e.target.value)}/></label>
        <label className={styles.wide}>Grund<textarea aria-label="Grund der Bestandsübernahme" value={historicalReason} maxLength={2000} onChange={e=>setHistoricalReason(e.target.value)}/></label>
        <button className="button primary" disabled={busy||!data.needsBaseline&&(available===''||Number(available)<0)||source.trim().length<3||historicalReason.trim().length<3} onClick={()=>void command('historical_import',{verifyOnly:data.needsBaseline,available:data.needsBaseline?data.xp.available:Number(available),earned:data.needsBaseline||earned===''?null:Number(earned),spent:data.needsBaseline||spent===''?null:Number(spent),source,reason:historicalReason})}>{data.needsBaseline?"Vorhandenen Verlauf erhalten · zur Prüfung vormerken":"Bestand übernehmen · zur Prüfung vormerken"}</button>
      </div></details>}
      <details className={styles.fold}><summary><ShieldCheck size={16}/>Bearbeitungs- und Entwicklungsrechte</summary><p>Diese Freigaben gelten nur für diesen Charakter. Kontorollen bleiben unverändert. Eine Spielerbearbeitung eines bestätigten Bogens legt ihn erneut der SL vor.</p><div className={styles.form}>
        <label><input type="checkbox" checked={editPermission} onChange={e=>setEditPermission(e.target.checked)}/>Spieler darf den Bogen nachtragen / bearbeiten</label>
        <label>Entwicklung<select aria-label="Entwicklungsfreigabe" value={development} onChange={e=>setDevelopment(e.target.value as typeof development)}><option value="direct">Reguläre XP-Käufe direkt</option><option value="approval">Entwicklung zuerst beantragen</option><option value="blocked">Entwicklung gesperrt</option></select></label>
        <label>Begründung<input aria-label="Grund der Rechteänderung" value={permissionReason} maxLength={2000} onChange={e=>setPermissionReason(e.target.value)}/></label><button className="button" disabled={busy||permissionReason.trim().length<3} onClick={()=>void command('permissions',{editing:editPermission,development,reason:permissionReason})}>Rechte speichern</button>
      </div></details>
      {data.state==='confirmed'&&<details className={styles.fold}><summary>XP korrigieren / gegenbuchen</summary><p>Eine Korrektur ergänzt den Verlauf. Vorherige Buchungen werden nicht gelöscht. Bei einer Gegenbuchung wird eine Gutschrift genau einmal aufgehoben. Eine Saldenkorrektur ändert keine Charakterwerte.</p><div className={styles.form}>
        <label>Gutschrift gegenbuchen · optional<select aria-label="XP-Gegenbuchung" value={reference} onChange={e=>{setReference(e.target.value);const row=data.ledger.find(row=>row.id===e.target.value);setCorrection(row?String(-row.amount):'');}}><option value="">Freie Saldenkorrektur</option>{data.ledger.filter(row=>row.kind==='grant'&&!data.ledger.some(e=>e.referenceId===row.id)).map(row=><option key={row.id} value={row.id}>{row.amount} XP · {row.reason}</option>)}</select></label>
        <label>Korrekturbetrag · mit Vorzeichen<input aria-label="XP-Korrekturbetrag" type="number" disabled={!!reference} value={correction} onChange={e=>setCorrection(e.target.value)}/></label><label>Grund<input aria-label="Grund der XP-Korrektur" value={correctionReason} maxLength={2000} onChange={e=>setCorrectionReason(e.target.value)}/></label>
        <button className="button" disabled={busy||!Number(correction)||correctionReason.trim().length<3} onClick={()=>void command('xp_correction',{amount:Number(correction),...(reference?{referenceId:reference}:{}),reason:correctionReason})}>Korrektur protokollieren</button>
      </div></details>}
    </>}
    <Dialog open={editing} onOpenChange={open=>{if(!busy)setEditing(open);}}><DialogContent className={styles.sheetEditor}><DialogHeader><DialogTitle>{manage?'Charakter als SL bearbeiten':'Charakter nachtragen'}</DialogTitle><DialogDescription>Bestehende Werte gezielt korrigieren. XP und Freigaben behalten ihren eigenen Ablauf. Abbrechen verwirft diese Eingaben.</DialogDescription></DialogHeader>{draft&&<><label className="field"><span>Charaktername</span><input aria-label="Charaktername" value={draft.title} maxLength={160} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><div className="record-form"><LegacyCharacterFields edit={draft} patchBody={patchBody} field={field} campaignId={campaignId} management/></div><label>Grund der Änderung<textarea aria-label="Grund der Bogenänderung" value={reason} maxLength={2000} onChange={e=>setReason(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<footer className="actions"><button className="button" disabled={busy} onClick={()=>setEditing(false)}>Abbrechen</button><button className="button primary" disabled={busy||reason.trim().length<3||!draft.title.trim()} onClick={()=>void saveSheet()}>Bogen speichern & protokollieren</button></footer></>}</DialogContent></Dialog>
  </section>;
}
