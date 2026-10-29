"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Crossing player and SL surfaces deliberately clears client context. */
import { useState } from 'react';
import type { Actor } from '@/domain/types';
import { Toaster } from '@/components/ui/sonner';
import styles from './sl-workspace-shell.module.css';
const tools=[{name:'Story & Szenen',section:'sitzung'},{name:'Sitzung · Live',section:'live'},{name:'Spieler & Charaktere',section:'charaktere'},{name:'Personen',section:null},{name:'Orte',section:'ortscms'},{name:'Medien',section:null},{name:'Rätsel',section:null}];
export function SLWorkspaceShell({a,section,navigate,children,preparationDirty=false}:{a:Actor;section:string;navigate:(id:string)=>void;children:React.ReactNode;preparationDirty?:boolean}) {
  const [planned,setPlanned]=useState(''),[toolsOpen,setToolsOpen]=useState(false);
  const central=section==='sitzung';
  const toolsPanel=(<aside id="sl-tools" className={`${styles.tools} ${toolsOpen ? styles.toolsOpen : ""}`}><p>WERKZEUGE</p><nav aria-label="SL-Workspace-Werkzeuge">{tools.filter(t=>a.role!=='campaign_editor'||t.section==='ortscms'||!t.section).filter(t=>!!t.section).map(t=>t.section==='live'?<a key={t.name} className={styles.liveLink} href="/spielbereich?bereich=sitzung">{t.name}</a>:<button key={t.name} aria-current={!planned&&section===t.section?'page':undefined} aria-pressed={planned===t.name} onClick={()=>{if(preparationDirty)return;if(t.section){setPlanned('');setToolsOpen(false);navigate(t.section);}else setPlanned(t.name);}}>{t.name}{!t.section&&<small>Geplant</small>}</button>)}</nav><details><summary>Weitere / geplante Werkzeuge</summary>{tools.filter(t=>!t.section).map(t=><button key={t.name} onClick={()=>{if(preparationDirty)return;setPlanned(t.name);setToolsOpen(false);}}>{t.name} · geplant</button>)}</details><p role={preparationDirty?"status":undefined}>{preparationDirty?"Offene Eingaben: vor dem Bereichswechsel speichern oder im Editor bewusst verwerfen.":""}</p><p>Vorbereitung bleibt privat. Eine Freigabe erfolgt ausschließlich bewusst für die ausgewählte Zielgruppe.</p></aside>);
  return <div className={`${styles.shell} ${central?styles.central:""}`}>
    <header className={styles.header}><a href="/">CHRONIPLAY</a><strong>COMMAND CENTER · VORBEREITUNG</strong><span>{a.name} · Kampagnenredaktion</span><a href="/spielbereich?bereich=sitzung">SL Live-Sitzung ↗</a><a href="/spielbereich">Mein Spielerbereich ↗</a></header>
    {!central&&<><button className={styles.mobileMenu} aria-expanded={toolsOpen} aria-controls="sl-tools" onClick={()=>setToolsOpen(!toolsOpen)}>Werkzeuge</button>{toolsPanel}</>}
    <main className={styles.content}>{central&&<details className={styles.management}><summary>Weitere Verwaltungsbereiche</summary>{toolsPanel}</details>}{planned?<section className="panel"><h1>{planned}</h1><p>Dieser Arbeitsbereich ist als Erweiterung vorgesehen und in Phase 1 noch nicht implementiert.</p><button className="button" onClick={()=>setPlanned('')}>Zur vorhandenen Arbeitsfläche</button></section>:<>{section==='charaktere'&&<div className={styles.inspection} role="status"><strong>SL-INSPEKTION · KAMPAGNENCHARAKTERE</strong><span>Du prüfst fremde Charaktere als Spielleitung. Du spielst sie nicht; persönliche Spielerauswahl bleibt getrennt.</span></div>}{children}</>}</main>
    <Toaster position="bottom-right" theme="dark"/>
  </div>;
}
