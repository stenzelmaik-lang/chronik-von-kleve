"use client";
/* eslint-disable @next/next/no-location-assign-relative-destination -- Logout performs a full navigation to discard protected client state. */
import {useEffect,useRef,useState} from 'react';
import {Toaster} from '@/components/ui/sonner';
import {ChevronDown,Compass,Download,House,LogOut,MapPinned,Radio,Users} from 'lucide-react';
import type {Actor} from '@/domain/types';
import {commandCenterLinks,worldSections} from './navigation';
import {MessageCenter} from './message-center';
import {api} from './api-client';
import {useLive} from './live-state';
import styles from './player-hub-shell.module.css';

/** A header dropdown (4c): sorted entries, closes on choice, Escape and click outside. */
function Dropdown({label,icon,current,children}:{label:string;icon:React.ReactNode;current?:boolean;children:React.ReactNode}){
 const ref=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{const close=(e:Event)=>{const d=ref.current;if(!d?.open)return;if(e instanceof KeyboardEvent?e.key==='Escape':!d.contains(e.target as Node))d.open=false;};document.addEventListener('click',close);document.addEventListener('keydown',close);return()=>{document.removeEventListener('click',close);document.removeEventListener('keydown',close);};},[]);
 return <details ref={ref} className={styles.dropdown} onClick={e=>{if((e.target as HTMLElement).closest('a,button[data-item]'))ref.current!.open=false;}}>
  <summary aria-current={current?'page':undefined}>{icon}<span>{label}</span><ChevronDown size={14} aria-hidden="true"/></summary>
  <div role="menu">{children}</div>
 </details>;
}

export function WorkspaceShell({a,section,navigate,children}:{a:Actor;section:string;navigate:(id:string)=>void;children:React.ReactNode}){
 const [preferences,setPreferences]=useState({reducedMotion:false,compactView:false}),[campaignName,setCampaignName]=useState(a.campaignId==='chronik-von-kleve'?'Chronik von Kleve':a.campaignId);
 useEffect(()=>{let live=true;api<{preferences:typeof preferences;campaigns:{id:string;name:string}[]}>('/api/profile').then(p=>{if(live){setPreferences(p.preferences);setCampaignName(p.campaigns.find(c=>c.id===a.campaignId)?.name||a.campaignId);}}).catch(()=>{});return()=>{live=false;};},[a.id,a.campaignId]);
 const live=useLive();
 const world=section==='weltkarte'||worldSections.some(s=>s.id===section);
 const editorOnly=!a.gm&&a.status==='active'&&a.role==='campaign_editor';
 async function logout(){try{await api('/api/auth/logout','POST',{});window.location.assign('/anmelden');}catch{window.alert('Abmeldung fehlgeschlagen. Bitte erneut versuchen.');}}
 return <div className={`player-shell ${world?'worldShell':'tableShell'} ${preferences.reducedMotion?'user-reduced-motion':''} ${preferences.compactView?'user-compact-view':''}`}>
  {a.status==='active'&&<MessageCenter key={a.campaignId+a.id} a={a} showTrigger={false}/>}
  <header className={styles.header}>
   <button className={styles.brand} type="button" onClick={()=>navigate('dashboard')} aria-label="ChroniPlay – Zuflucht">ChroniPlay</button><span className={styles.campaign}>{campaignName}</span>
   <nav className={styles.navigation} aria-label="Hauptnavigation">
    <button type="button" onClick={()=>navigate('dashboard')} aria-current={section==='dashboard'?'page':undefined}><House size={17} aria-hidden="true"/><span>Zuflucht</span></button>
    <button type="button" onClick={()=>navigate('sitzung')} aria-current={section==='sitzung'?'page':undefined}><Radio size={17} aria-hidden="true"/><span>Spieltisch</span>{live!==null&&<small className={styles.live} data-live={live||undefined}>{live?'live':'nicht live'}</small>}</button>
    <Dropdown label="Die Welt" icon={<Compass size={17} aria-hidden="true"/>} current={world}>
     {worldSections.map(s=><button type="button" role="menuitem" data-item key={s.id} aria-current={section===s.id||(s.id==='schauplaetze'&&section==='weltkarte')?'page':undefined} onClick={()=>navigate(s.id)}><s.icon size={16} aria-hidden="true"/>{s.name}{s.wip&&<small className={styles.wip}>im Aufbau</small>}</button>)}
    </Dropdown>
    <a href="/kampagne"><Users size={17} aria-hidden="true"/><span>Kampagnen</span></a>
    {a.gm&&<Dropdown label="Command Center" icon={<MapPinned size={17} aria-hidden="true"/>}>
     <a role="menuitem" href="/sl/command-center"><MapPinned size={16} aria-hidden="true"/>Übersicht</a>
     {commandCenterLinks.map(l=><a role="menuitem" key={l.href} href={l.href}><l.icon size={16} aria-hidden="true"/>{l.label}</a>)}
    </Dropdown>}
    {editorOnly&&<a href="/sl/command-center?bereich=ortscms"><MapPinned size={17} aria-hidden="true"/><span>Ortsverwaltung</span></a>}
   </nav>
   <details className={styles.account}><summary aria-label="Kontomenü"><span>{a.name?.slice(0,1).toUpperCase()}</span><ChevronDown size={14} aria-hidden="true"/></summary><div><strong>{a.name}</strong><a href="/profil">Profil & Einstellungen</a><button type="button" onClick={()=>void logout()}><LogOut size={16} aria-hidden="true"/>Abmelden</button></div></details>
  </header>
  {world&&<nav className={styles.world} aria-label="Spielwelt-Navigation">{worldSections.filter(s=>!s.wip).map(s=><button key={s.id} type="button" aria-current={section===s.id||(s.id==='schauplaetze'&&section==='weltkarte')?'page':undefined} onClick={()=>navigate(s.id)}><s.icon size={16} aria-hidden="true"/>{s.name}</button>)}</nav>}
  <main className="workspace-main">{children}</main>
  <footer className="player-footer"><span>Spieler · {campaignName}</span><span className="player-footer-links"><a href="/api/export"><Download size={14}/>Meine Daten sichern</a></span></footer>
  <Toaster position="bottom-right" theme="dark"/>
 </div>;
}
