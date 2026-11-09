"use client";
import {useState} from 'react';
import type {CharacterEngineView} from '@/domain/character-live';
import {Pencil,Send} from 'lucide-react';
import {CharacterSheetEditor} from './character-sheet-editor';
import styles from './character-studio.module.css';

type Props={data:CharacterEngineView;busy:boolean;manage:boolean;campaignId:string;error:string;command:(action:string,extra?:Record<string,unknown>)=>Promise<boolean>};
/** Player side of the sheet permissions. The SL works in CharacterAdmin. */
export function CharacterManagementTools({data,busy,manage,error,command}:Props){
  const [editing,setEditing]=useState(false);
  const canEdit=manage||data.owner&&data.permissions.editing;
  return <section className={styles.managementTools} aria-label="Bogenbearbeitung">
    {canEdit&&<div className={styles.catchUp}><div><strong>{data.state==='confirmed'?'Bearbeitung freigegeben':'Bogen nachtragen'}</strong><span>{data.state==='confirmed'?'Die Spielleitung hat dir die Bearbeitung geöffnet. Nach dem Speichern prüft sie den Bogen erneut.':'Übertrage die Werte deines Papierbogens. Erspielte Werte über dem Erschaffungsrahmen sind hier erlaubt.'}</span></div><div className={styles.catchUpActions}><button className="button primary" disabled={busy} onClick={()=>setEditing(true)}><Pencil size={16}/>Bogen bearbeiten</button>{!manage&&data.state!=='confirmed'&&(data.catchUpReadyAt?<span role="status">Nachtrag gemeldet am {new Date(data.catchUpReadyAt).toLocaleDateString('de-DE')} · die SL prüft</span>:<button className="button" disabled={busy} onClick={()=>void command('catch_up_done')}><Send size={16}/>Nachtrag fertig · SL informieren</button>)}</div></div>}
    {!manage&&<p style={{textAlign:"center"}}>Bearbeitung: {data.permissions.editing?'von der SL freigegeben':'geschützt'} · Entwicklung: {({direct:'direkt mit XP',approval:'mit SL-Antrag',blocked:'gesperrt'})[data.permissions.development]}</p>}
    <CharacterSheetEditor open={editing} onOpenChange={setEditing} title={data.title} sheet={data.sheet} mode={manage?'sl':'player'} busy={busy} error={error} historical={data.historical||data.canAdopt} onSave={(patch,title,reason)=>command('edit_sheet',{patch,title,reason})}/>
  </section>;
}
