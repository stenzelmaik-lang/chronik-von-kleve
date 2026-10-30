"use client";
import {useState} from 'react';
import {Check,FilePenLine,History,Mail,ShieldCheck,Sparkles,Undo2} from 'lucide-react';
import type {CharacterEngineView} from '@/domain/character-live';
import {CharacterSheetEditor,sheetFieldLabel} from './character-sheet-editor';
import admin from './character-admin.module.css';

type Command=(action:string,extra?:Record<string,unknown>)=>Promise<boolean>;
type Props={data:CharacterEngineView;busy:boolean;error:string;command:Command;onConfirm:()=>void};
const developmentLabels={direct:'Direkt mit XP steigern',approval:'Steigerung beantragen',blocked:'Gesperrt'} as const;
const kindLabels:Record<string,string>={historical:'Historische Übernahme',grant:'Vergabe durch SL',spend:'Ausgabe',correction:'SL-Korrektur'};
const actionLabels:Record<string,string>={edit_sheet:'Bogen bearbeitet',historical_import:'Bestand übernommen',permissions:'Freigaben geändert',xp_grant:'XP vergeben',xp_correction:'XP korrigiert',xp_purchase:'XP ausgegeben',xp_request:'Entwicklung beantragt',xp_decision:'Antrag entschieden',confirm:'Freigegeben',return_draft:'Zur Überarbeitung zurück',review:'Zur Prüfung eingereicht',sl_adjustment:'SL-Korrektur',resolve_request:'Antrag entschieden',grant_exception:'Ausnahme genehmigt',correction:'Text korrigiert',gm_notes:'SL-Notiz'};

/** One lifecycle for every sheet: captured → catch-up → SL review → released for play. */
export function lifecycleStep(data:CharacterEngineView){
  if(data.state==='confirmed')return 4;
  if(data.state==='review'||data.catchUpReadyAt)return 3;
  if(data.permissions.editing)return 2;
  return 1;
}

export function XpSummary({data,compact=false}:{data:CharacterEngineView;compact?:boolean}){
  const unknownHistory=data.historical&&(data.xp.historicalEarned===null||data.xp.historicalSpent===null);
  const value=(n:number|null)=>n===null?'?':String(n);
  return <div className={compact?admin.xpCompact:admin.xpSummary} aria-label="Erfahrungspunkte">
    <div><span>Erhalten</span><strong>{value(data.xp.received)}</strong></div>
    <div><span>Verbraucht</span><strong>{value(data.xp.spent)}</strong></div>
    <div data-main><span>Verfügbar</span><strong>{data.xp.available??'–'}</strong></div>
    {!compact&&unknownHistory&&<p>„?“ = vor der Übernahme nicht belegt. Seit der Übernahme: {data.xp.grants} XP vergeben, {data.xp.purchases} XP ausgegeben{data.xp.corrections?`, Korrekturen ${data.xp.corrections>0?'+':''}${data.xp.corrections} XP`:''}.</p>}
  </div>;
}

export function CharacterAdmin({data,busy,error,command,onConfirm}:Props){
  const step=lifecycleStep(data);
  const [editorOpen,setEditorOpen]=useState(false);
  const [editing,setEditing]=useState(data.permissions.editing),[development,setDevelopment]=useState(data.permissions.development),[permissionReason,setPermissionReason]=useState('');
  const [xpMode,setXpMode]=useState<'grant'|'correction'>('grant'),[amount,setAmount]=useState('3'),[xpReason,setXpReason]=useState(''),[reference,setReference]=useState('');
  const [available,setAvailable]=useState(''),[earned,setEarned]=useState(''),[spent,setSpent]=useState(''),[source,setSource]=useState(''),[adoptReason,setAdoptReason]=useState(''),[adoptConfirm,setAdoptConfirm]=useState(true),[closeEditing,setCloseEditing]=useState(true);
  const [feedback,setFeedback]=useState('');
  const permissionsDirty=editing!==data.permissions.editing||development!==data.permissions.development;
  const adoptable=data.canAdopt||data.needsBaseline;
  const openGrants=data.ledger.filter(row=>row.kind==='grant'&&!data.ledger.some(e=>e.referenceId===row.id));
  const amountNumber=Number(amount);
  const xpValid=xpMode==='grant'?Number.isInteger(amountNumber)&&amountNumber>=1&&amountNumber<=1000:Number.isInteger(amountNumber)&&amountNumber!==0;
  const historicalNumbersValid=available!==''&&Number(available)>=0&&(earned===''||spent===''||Number(earned)-Number(spent)===Number(available));
  async function saveSheet(patch:Record<string,unknown>,title:string,reason:string){return command('edit_sheet',{patch,title,reason});}
  const steps=['Erfasst','Nachtrag','SL-Prüfung','Im Spiel'];
  const next=data.catchUpReadyAt&&data.state!=='review'?`Spieler meldet den Nachtrag als abgeschlossen (${new Date(data.catchUpReadyAt).toLocaleDateString('de-DE')}). Werte prüfen, dann Bestand übernehmen und freigeben.`:step===1&&adoptable?'Spieler nachtragen lassen oder Bogen selbst übertragen, dann Bestand übernehmen.':step===2?'Der Spieler trägt nach. Danach Bestand übernehmen und freigeben.':step===3?'Bogen prüfen: freigeben oder mit Rückmeldung zurückgeben.':step===4?'Im Spielbetrieb. XP vergeben, korrigieren oder Bearbeitung gezielt öffnen.':'Bogen prüfen.';
  return <section className={admin.admin} aria-label="SL-Verwaltung der Charakterakte">
    <ol className={admin.lifecycle} aria-label="Status der Akte">{steps.map((label,index)=><li key={label} data-state={index+1<step?'done':index+1===step?'current':'open'}><b>{index+1<step?<Check size={13}/>:index+1}</b>{label}</li>)}</ol>
    <p className={admin.next}><strong>Nächster Schritt:</strong> {next}</p>
    {error&&<p role="alert" className={admin.error}>{error}</p>}
    <div className={admin.grid}>
      <div className={admin.column}>
        <article className={admin.card}><header><h3><FilePenLine size={17}/>Charakterbogen</h3><button className="button primary" disabled={busy} onClick={()=>setEditorOpen(true)}>Bogen bearbeiten</button></header>
          <p>Alle Werte direkt wie auf dem Papierbogen ändern: Attribute, Fähigkeiten, Disziplinen, Hintergründe, Tugenden, Menschlichkeit, Willenskraft, Blut. Jede Änderung wird mit Grund protokolliert.</p>
          <p className={admin.deviation} data-over={data.deviation.over>0||undefined}>{data.deviation.over>0?`${data.deviation.over} Punkte über dem V20-Erschaffungsrahmen – bei gespielten Bögen erwartbar.`:'Innerhalb des V20-Erschaffungsrahmens.'}</p>
        </article>
        {data.state==='review'&&<article className={admin.card} data-accent><header><h3><ShieldCheck size={17}/>Prüfung</h3></header><p>{data.historical?'Bestandsbogen mit belegtem XP-Stand. Keine Erschaffungsbudgets.':'Neu erschaffener Bogen. Die Erschaffungsregeln werden beim Freigeben geprüft.'}</p>
          <div className={admin.actions}><button className="button primary" disabled={busy} onClick={onConfirm}><Check size={15}/>Für das Spiel freigeben</button></div>
          <label className={admin.field}><span>Rückmeldung an den Spieler</span><input value={feedback} maxLength={2000} onChange={e=>setFeedback(e.target.value)} placeholder="Was soll überarbeitet werden?"/></label>
          <button className="button" disabled={busy||feedback.trim().length<3} onClick={()=>void command('return_draft',{reason:feedback})}><Undo2 size={15}/>Zur Überarbeitung zurückgeben</button>
        </article>}
        {adoptable&&<article className={admin.card} data-accent={step<3||undefined}><header><h3><History size={17}/>{data.needsBaseline?'Ursprung des bestätigten Bogens belegen':'Bestehenden Charakter übernehmen'}</h3></header>
          {data.needsBaseline?<p>Der vorhandene XP-Verlauf ({data.xp.available} XP verfügbar) bleibt unverändert. Der aktuelle Bogen wird als belegter Ausgangsstand festgehalten.</p>:<p>Für Charaktere, die schon auf Papier gespielt wurden. Die aktuellen Werte werden ohne Erschaffungsbudgets als Ausgangsstand festgehalten. Trage zuerst alle Werte nach (selbst über „Bogen bearbeiten“ oder per Spielerfreigabe unter „Freigaben“).</p>}
          <div className={admin.formGrid}>
            {!data.needsBaseline&&<><label className={admin.field}><span>Verfügbare XP laut Bogen</span><input inputMode="numeric" value={available} onChange={e=>setAvailable(e.target.value.replace(/\D/g,''))} aria-label="Historische verfügbare XP"/></label>
            <label className={admin.field}><span>Bisher erhalten · falls bekannt</span><input inputMode="numeric" value={earned} placeholder="unbekannt" onChange={e=>setEarned(e.target.value.replace(/\D/g,''))} aria-label="Historische Gesamt-XP"/></label>
            <label className={admin.field}><span>Bisher verbraucht · falls bekannt</span><input inputMode="numeric" value={spent} placeholder="unbekannt" onChange={e=>setSpent(e.target.value.replace(/\D/g,''))} aria-label="Historische verbrauchte XP"/></label></>}
            <label className={`${admin.field} ${admin.wide}`}><span>Beleg</span><input value={source} maxLength={1000} placeholder="z. B. Papierbogen, Stand September" onChange={e=>setSource(e.target.value)} aria-label="Quelle der Übernahme"/></label>
            <label className={`${admin.field} ${admin.wide}`}><span>Grund</span><input value={adoptReason} maxLength={2000} placeholder="z. B. Wechsel der Gruppe nach ChroniPlay" onChange={e=>setAdoptReason(e.target.value)} aria-label="Grund der Bestandsübernahme"/></label>
          </div>
          {!data.needsBaseline&&earned!==''&&spent!==''&&!historicalNumbersValid&&<p className={admin.error}>Erhalten minus verbraucht muss den verfügbaren XP entsprechen.</p>}
          <label className={admin.check}><input type="checkbox" checked={adoptConfirm} onChange={e=>setAdoptConfirm(e.target.checked)}/>Zugleich für den Spielbetrieb freigeben</label>
          {data.permissions.editing&&<label className={admin.check}><input type="checkbox" checked={closeEditing} onChange={e=>setCloseEditing(e.target.checked)}/>Spielerbearbeitung damit beenden</label>}
          <button className="button primary" disabled={busy||(!data.needsBaseline&&!historicalNumbersValid)||source.trim().length<3||adoptReason.trim().length<3} onClick={()=>void command('historical_import',{verifyOnly:data.needsBaseline,confirm:adoptConfirm,closeEditing:data.permissions.editing&&closeEditing,available:data.needsBaseline?data.xp.available:Number(available),earned:data.needsBaseline||earned===''?null:Number(earned),spent:data.needsBaseline||spent===''?null:Number(spent),source,reason:adoptReason})}>{adoptConfirm?'Bestand übernehmen und freigeben':'Bestand übernehmen · zur Prüfung'}</button>
          <p className={admin.hint}>Einmalig. Die XP werden als historische Übernahme gebucht, nicht als neue Belohnung.</p>
        </article>}
      </div>
      <div className={admin.column}>
        <article className={admin.card}><header><h3><ShieldCheck size={17}/>Freigaben</h3></header>
          <dl className={admin.permissions}>
            <div><dt>Spielbetrieb</dt><dd data-on={data.state==='confirmed'||undefined}>{data.state==='confirmed'?'Freigegeben':data.state==='review'?'Wartet auf Prüfung':'Noch nicht freigegeben'}</dd></div>
            <div><dt><label htmlFor={'edit-'+data.id}>Spieler darf Bogen bearbeiten</label><small>Für den Nachtrag vom Papierbogen. Ohne Punktebudget; Änderungen an einem freigegebenen Bogen gehen zurück in die Prüfung.</small></dt><dd><button id={'edit-'+data.id} type="button" role="switch" aria-checked={editing} className={admin.switch} onClick={()=>setEditing(v=>!v)}><span/>{editing?'Erlaubt':'Gesperrt'}</button></dd></div>
            <div><dt>Entwicklung mit XP<small>Wie der Spieler erspielte XP einsetzen darf.</small></dt><dd><div className={admin.segmented} role="radiogroup" aria-label="Entwicklungsfreigabe">{(['direct','approval','blocked'] as const).map(value=><button type="button" key={value} role="radio" aria-checked={development===value} onClick={()=>setDevelopment(value)}>{developmentLabels[value]}</button>)}</div></dd></div>
          </dl>
          {permissionsDirty&&<div className={admin.inlineSave}><input value={permissionReason} maxLength={2000} placeholder="Grund, z. B. Nachtrag Papierbogen" aria-label="Grund der Rechteänderung" onChange={e=>setPermissionReason(e.target.value)}/><button className="button primary" disabled={busy||permissionReason.trim().length<3} onClick={()=>void command('permissions',{editing,development,reason:permissionReason})}>Speichern</button><button className="button" disabled={busy} onClick={()=>{setEditing(data.permissions.editing);setDevelopment(data.permissions.development);}}>Verwerfen</button></div>}
        </article>
        <article className={admin.card}><header><h3><Sparkles size={17}/>Erfahrung</h3></header>
          {data.enrolled?<XpSummary data={data}/>:<p>Noch kein XP-Konto. Es entsteht mit der Bestandsübernahme.</p>}
          {data.state==='confirmed'?<>
            <div className={admin.segmented} role="tablist" aria-label="XP-Aktion"><button type="button" role="tab" aria-selected={xpMode==='grant'} onClick={()=>{setXpMode('grant');setReference('');setAmount('3');}}>XP vergeben</button><button type="button" role="tab" aria-selected={xpMode==='correction'} onClick={()=>{setXpMode('correction');setAmount('');}}>Korrigieren</button></div>
            <div className={admin.formGrid}>
              {xpMode==='correction'&&openGrants.length>0&&<label className={`${admin.field} ${admin.wide}`}><span>Vergabe zurücknehmen · optional</span><select value={reference} aria-label="XP-Gegenbuchung" onChange={e=>{setReference(e.target.value);const row=data.ledger.find(r=>r.id===e.target.value);setAmount(row?String(-row.amount):'');}}><option value="">Freie Korrektur (+/−)</option>{openGrants.map(row=><option key={row.id} value={row.id}>{row.amount} XP · {row.reason}</option>)}</select></label>}
              <label className={admin.field}><span>{xpMode==='grant'?'Punkte':'Betrag mit Vorzeichen'}</span><input inputMode="numeric" disabled={!!reference} value={amount} onChange={e=>setAmount(e.target.value.replace(xpMode==='grant'?/\D/g:/[^\d-]/g,''))} aria-label={xpMode==='grant'?'XP-Gutschrift':'XP-Korrekturbetrag'}/></label>
              <label className={admin.field}><span>Grund</span><input value={xpReason} maxLength={2000} placeholder={xpMode==='grant'?'z. B. Spielabend 12.11.':'z. B. Doppelt vergeben'} onChange={e=>setXpReason(e.target.value)} aria-label={xpMode==='grant'?'Grund der XP-Gutschrift':'Grund der XP-Korrektur'}/></label>
            </div>
            <button className="button primary" disabled={busy||!xpValid||xpReason.trim().length<3} onClick={async()=>{const ok=await command(xpMode==='grant'?'xp_grant':'xp_correction',{amount:amountNumber,...(reference?{referenceId:reference}:{}),reason:xpReason});if(ok){setXpReason('');setReference('');}}}>{xpMode==='grant'?`${xpValid?amountNumber:''} XP gutschreiben`:'Korrektur buchen'}</button>
            <p className={admin.hint}>Buchungen werden nie gelöscht. Jede Vergabe kann einmal vollständig zurückgenommen werden; der Saldo bleibt nicht negativ.</p>
          </>:data.enrolled&&<p className={admin.hint}>XP-Vergaben sind nach der Freigabe möglich.</p>}
          {data.ledger.length>0&&<ol className={admin.ledger}>{[...data.ledger].reverse().map(row=><li key={row.id}><span>{kindLabels[row.kind]??row.kind}<small>{new Date(row.createdAt).toLocaleDateString('de-DE')} · {row.reason}</small></span><b data-negative={row.kind==='spend'||row.amount<0||undefined}>{row.kind==='spend'?'−':row.amount>0?'+':''}{row.kind==='spend'?row.amount:row.amount}</b></li>)}</ol>}
        </article>
        <article className={admin.card}><header><h3><Mail size={17}/>Kontakt</h3><button className="button" onClick={()=>window.dispatchEvent(new CustomEvent('chroniplay:compose-message',{detail:data.ownerId}))}>Persönlicher Brief</button></header><p>Öffnet das vorhandene Nachrichtensystem mit dem Spieler als Empfänger. Es wird nichts automatisch versendet.</p></article>
      </div>
    </div>
    {data.history&&data.history.length>0&&<article className={`${admin.card} ${admin.historyCard}`}><header><h3><History size={17}/>Verlauf</h3></header><ol className={admin.history}>{data.history.map((event,index)=><li key={index}><span><b>{actionLabels[event.action]??event.action}</b><small>{new Date(event.createdAt).toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short'})} · Stand {event.version}</small></span><p>{event.reason}</p>{event.changes&&Object.keys(event.changes).length>0&&<details><summary>{Object.keys(event.changes).map(sheetFieldLabel).join(', ')}</summary>{Object.entries(event.changes).map(([field,change])=><p key={field}><b>{sheetFieldLabel(field)}:</b> {changeText(change.before,change.after)}</p>)}</details>}</li>)}</ol></article>}
    <CharacterSheetEditor open={editorOpen} onOpenChange={setEditorOpen} title={data.title} sheet={data.sheet} mode="sl" busy={busy} error={error} historical={data.historical||adoptable} onSave={saveSheet}/>
  </section>;
}

function describe(value:unknown):string{
  if(value===null||value===undefined||value==='')return '–';
  if(Array.isArray(value))return value.map(v=>v&&typeof v==='object'?`${(v as Record<string,unknown>).name??'?'} ${(v as Record<string,unknown>).value??(v as Record<string,unknown>).cost??''}`.trim():String(v)).join(', ')||'–';
  if(typeof value==='object')return Object.entries(value as Record<string,unknown>).map(([k,v])=>`${k} ${typeof v==='object'?JSON.stringify(v):v}`).join(', ');
  return String(value);
}

/** Only the changed entries of a value map are listed, not the whole sheet section. */
function changeText(before:unknown,after:unknown):string{
  const plain=(v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
  const b=plain(before),a=plain(after);
  if(a&&'editing' in a){const dev:Record<string,string>={direct:'XP direkt',approval:'XP per Antrag',blocked:'Entwicklung gesperrt'};const text=(v:Record<string,unknown>|null)=>v?`Bearbeitung ${v.editing?'erlaubt':'gesperrt'}, ${dev[String(v.development)]??v.development}`:'Standard';return `${text(b)} → ${text(a)}`;}
  if(b&&a){const keys=[...new Set([...Object.keys(b),...Object.keys(a)])].filter(k=>JSON.stringify(b[k])!==JSON.stringify(a[k]));return keys.map(k=>`${k} ${describe(b[k])} → ${describe(a[k])}`).join(' · ')||'unverändert';}
  return `${describe(before)} → ${describe(after)}`;
}
