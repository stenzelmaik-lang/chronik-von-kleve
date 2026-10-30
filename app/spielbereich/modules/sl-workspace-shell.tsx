"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Crossing player and SL surfaces deliberately clears client context. */
import { Clapperboard, Users, MapPin, Play } from 'lucide-react';
import type { Actor } from '@/domain/types';
import { Toaster } from '@/components/ui/sonner';
import styles from './sl-workspace-shell.module.css';

const preparationTools = [
  { name: 'Spielabende & Szenen', description: 'Abende planen und Geschichten vorbereiten', section: 'sitzung', icon: Clapperboard },
  { name: 'Spieler & Charaktere', description: 'Die Charaktere deiner Spielrunde einsehen', section: 'charaktere', icon: Users },
  { name: 'Orte', description: 'Schauplätze, Bereiche und Räume verwalten', section: 'ortscms', icon: MapPin },
];

export function SLWorkspaceShell({a,section,navigate,children,preparationDirty=false}:{a:Actor;section:string;navigate:(id:string)=>void;children:React.ReactNode;preparationDirty?:boolean}) {
  return <div className={`${styles.shell} ${styles.central}`}>
    <header className={styles.header}><a href="/">CHRONIPLAY</a><strong>COMMAND CENTER · VORBEREITUNG</strong><span>{a.name} · Kampagnenredaktion</span><a href="/spielbereich">Mein Spielerbereich ↗</a></header>
    <main className={styles.content}>
      <nav className={styles.managementNav} aria-label="Verwaltungsbereiche">
        {preparationTools.filter(tool=>a.role!=='campaign_editor'||tool.section==='ortscms').map(tool=>{
          const Icon=tool.icon;
          return <button key={tool.section} type="button" aria-current={section===tool.section?'page':undefined} disabled={preparationDirty} onClick={()=>{if(preparationDirty)return;if(tool.section==="sitzung"&&section==="sitzung"){window.history.pushState(null,"","/sl/command-center?bereich=sitzung");window.dispatchEvent(new PopStateEvent("popstate"));}else navigate(tool.section);}}>
            <Icon aria-hidden="true" size={20}/><span><strong>{tool.name}</strong><small>{tool.description}</small></span>
          </button>;
        })}
        {a.gm&&<a href="/spielbereich?bereich=sitzung"><Play aria-hidden="true" size={20}/><span><strong>Live-Spieltisch</strong><small>Zum laufenden Spielabend wechseln</small></span></a>}
      </nav>
      {preparationDirty&&<p className={styles.unsavedNotice} role="status">Offene Eingaben: vor dem Bereichswechsel speichern oder im Editor bewusst verwerfen.</p>}
      {section==='charaktere'&&<div className={styles.inspection} role="status"><strong>SL-INSPEKTION · KAMPAGNENCHARAKTERE</strong><span>Du prüfst fremde Charaktere als Spielleitung. Du spielst sie nicht; persönliche Spielerauswahl bleibt getrennt.</span></div>}
      {children}
    </main>
    <Toaster position="bottom-right" theme="dark"/>
  </div>;
}
