"use client";
/* eslint-disable @next/next/no-location-assign-relative-destination -- Logout performs a full navigation to discard protected client state. */
import {useEffect,useState} from 'react';
import {Toaster} from '@/components/ui/sonner';
import {ArrowLeft,BookOpen,ChevronDown,Compass,Download,LogOut,MapPinned,Users} from 'lucide-react';
import type {Actor} from '@/domain/types';
import {sections} from './navigation';
import {MessageCenter} from './message-center';
import {api} from './api-client';
import styles from './player-hub-shell.module.css';

export function WorkspaceShell({a,section,navigate,children}:{a:Actor;section:string;navigate:(id:string)=>void;children:React.ReactNode}){
 const [preferences,setPreferences]=useState({reducedMotion:false,compactView:false}),[campaignName,setCampaignName]=useState(a.campaignId==='chronik-von-kleve'?'Chronik von Kleve':a.campaignId);
 useEffect(()=>{let live=true;api<{preferences:typeof preferences;campaigns:{id:string;name:string}[]}>('/api/profile').then(p=>{if(live){setPreferences(p.preferences);setCampaignName(p.campaigns.find(c=>c.id===a.campaignId)?.name||a.campaignId);}}).catch(()=>{});return()=>{live=false;};},[a.id,a.campaignId]);
 const world=sections.find(s=>s.id===section)?.group==='SPIELWELT';
 async function logout(){try{await api('/api/auth/logout','POST',{});window.location.assign('/anmelden');}catch{window.alert('Abmeldung fehlgeschlagen. Bitte erneut versuchen.');}}
 return <div className={`player-shell ${world?'worldShell':'tableShell'} ${preferences.reducedMotion?'user-reduced-motion':''} ${preferences.compactView?'user-compact-view':''}`}>
  {a.status==='active'&&<MessageCenter key={a.campaignId+a.id} a={a} showTrigger={false}/>}
  <header className={styles.header}>
   <button className={styles.brand} type="button" onClick={()=>navigate('dashboard')} aria-label="ChroniPlay – Spielerzentrale">ChroniPlay</button><span className={styles.campaign}>{campaignName}</span>
   <nav className={styles.navigation} aria-label="Hauptnavigation">
    {section!=='dashboard'&&<button type="button" onClick={()=>navigate('dashboard')}><ArrowLeft size={16} aria-hidden="true"/><span>Zur Spielerzentrale</span></button>}
    <a href="/kampagne"><Users size={17} aria-hidden="true"/><span>Kampagnen</span></a>
    <button type="button" onClick={()=>navigate('schauplaetze')} aria-current={world?'page':undefined}><Compass size={17} aria-hidden="true"/><span>Chronik erkunden</span></button>
    {a.gm&&<a href="/sl/command-center"><MapPinned size={17} aria-hidden="true"/><span>Command Center</span></a>}
    {!a.gm&&a.role==='campaign_editor'&&<a href="/sl/command-center?bereich=ortscms"><MapPinned size={17} aria-hidden="true"/><span>Ortsredaktion</span></a>}
   </nav>
   <details className={styles.account}><summary aria-label="Kontomenü"><span>{a.name?.slice(0,1).toUpperCase()}</span><ChevronDown size={14} aria-hidden="true"/></summary><div><strong>{a.name}</strong><a href="/profil">Profil & Einstellungen</a><button type="button" onClick={()=>void logout()}><LogOut size={16} aria-hidden="true"/>Abmelden</button></div></details>
  </header>
  {world&&<nav className={styles.world} aria-label="Spielwelt-Navigation">{[{id:'schauplaetze',label:'Orte',icon:Compass},{id:'chronik',label:'Chronik',icon:BookOpen},{id:'nscs',label:'Persönlichkeiten',icon:Users},{id:'regelwerk',label:'Codex Noctis',icon:BookOpen}].map(({id,label,icon:Icon})=><button key={id} type="button" aria-current={section===id?'page':undefined} onClick={()=>navigate(id)}><Icon size={16} aria-hidden="true"/>{label}</button>)}</nav>}
  <main className="workspace-main">{children}</main>
   <footer className="player-footer"><span>Spieler · {campaignName}</span><span className="player-footer-links"><a href="/api/export"><Download size={14}/>Meine Daten sichern</a></span></footer>
  <Toaster position="bottom-right" theme="dark"/>
 </div>;
}
