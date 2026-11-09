"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Crossing player and SL surfaces deliberately clears client context. */
import {Clapperboard, Users, MapPin, Play, Images, FolderOpen, Download, UserRoundPlus, BookOpen, House } from 'lucide-react';
import type { Actor } from '@/domain/types';
import { Toaster } from '@/components/ui/sonner';
import {MessageCenter} from './message-center';
import styles from './sl-workspace-shell.module.css';
import { useLive } from './live-state';

const preparationTools = [
  { name: 'Spielabende & Szenen', description: 'Abende planen und Geschichten vorbereiten', section: 'sitzung', icon: Clapperboard },
  { name: 'Spieler & Charaktere', description: 'Charaktere einsehen und Spieler einladen', section: 'charaktere', icon: Users },
  { name: 'Galerie', description: 'Bilder und Dateien finden, sortieren und verwalten', section: 'galerie', icon: Images },
  { name: 'Material', description: 'Dokumente und Unterlagen zum Ausspielen vorbereiten', section: 'vorbereitung', icon: FolderOpen },
  { name: 'NPCs', description: 'Nichtspielercharaktere anlegen, bearbeiten und freigeben', section: 'nscs', icon: UserRoundPlus },
  { name: 'Orte', description: 'Schauplätze, Bereiche und Räume verwalten', section: 'ortscms', icon: MapPin },
  { name: 'Rückblicke & Chronik', description: 'Spielabende zusammenfassen, Ereignisse der Domäne festhalten', section: 'rueckblick', icon: BookOpen },
];

export function SLWorkspaceShell({a,section,navigate,children,preparationDirty=false}:{a:Actor;section:string;navigate:(id:string)=>void;children:React.ReactNode;preparationDirty?:boolean}) {
  const live = useLive();
  return <div className={`${styles.shell} ${styles.central}`}>
    {a.status==='active'&&a.gm&&<MessageCenter key={a.campaignId+a.id} a={a} showTrigger={false}/>}
    <header className={styles.header}><a href="/" className={styles.brand}>CHRONIPLAY</a><strong>COMMAND CENTER · VORBEREITUNG</strong><span>{a.name} · Kampagnenredaktion</span>
      <nav className={styles.headerActions} aria-label="Wechseln">
        {a.gm&&<a href="/spielbereich?bereich=sitzung" className={styles.tableLink}><Play aria-hidden="true" size={15}/>Zum Spieltisch{live!==null&&<small data-live={live||undefined}>{live?"live":"nicht live"}</small>}</a>}
        <a href="/spielbereich"><House aria-hidden="true" size={15}/>Zur Zuflucht</a>
        {a.gm&&<a href="/api/export?scope=campaign" title="Gesamte Kampagne als Sicherung herunterladen"><Download aria-hidden="true" size={15}/>Kampagne sichern</a>}
      </nav></header>
    <main className={styles.content}>
      <nav className={styles.managementNav} aria-label="Verwaltungsbereiche">
        {preparationTools.filter(tool=>a.role!=='campaign_editor'||tool.section==='ortscms').map(tool=>{
          const Icon=tool.icon;
          return <button key={tool.section} type="button" aria-current={section===tool.section?'page':undefined} disabled={preparationDirty} onClick={()=>{if(preparationDirty)return;if(tool.section==="sitzung"&&section==="sitzung"){window.history.pushState(null,"","/sl/command-center?bereich=sitzung");window.dispatchEvent(new PopStateEvent("popstate"));}else navigate(tool.section);}}>
            <Icon aria-hidden="true" size={20}/><span><strong>{tool.name}</strong><small>{tool.description}</small></span>
          </button>;
        })}
      </nav>
      {preparationDirty&&<p className={styles.unsavedNotice} role="status">Offene Eingaben: vor dem Bereichswechsel speichern oder im Editor bewusst verwerfen.</p>}
      {section==='charaktere'&&<div className={styles.inspection} role="status"><strong>SL-INSPEKTION · KAMPAGNENCHARAKTERE</strong><span>Du prüfst fremde Charaktere als Spielleitung. Du spielst sie nicht; persönliche Spielerauswahl bleibt getrennt.</span></div>}
      {section==='charaktere'&&a.gm&&<div className={styles.inviteEntry}><a href="/zugang/verwaltung"><UserRoundPlus size={17} aria-hidden="true"/> Spieler einladen und Einladungen verwalten</a></div>}
      {children}
    </main>
    <Toaster position="bottom-right" theme="dark"/>
  </div>;
}
