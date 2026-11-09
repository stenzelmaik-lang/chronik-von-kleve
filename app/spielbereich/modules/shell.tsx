"use client";
/* eslint-disable @next/next/no-location-assign-relative-destination -- Logout performs a full navigation to discard protected client state. */
import {useEffect,useState} from 'react';
import {Toaster} from '@/components/ui/sonner';
import {ChevronDown,Download,LogOut,Mail,MapPinned,Menu,Users,X} from 'lucide-react';
import type {Actor} from '@/domain/types';
import {menuSections,sections} from './navigation';
import {MessageCenter} from './message-center';
import {api} from './api-client';
import styles from './player-hub-shell.module.css';

/** Player menu (4c): one visible menu in groups; on narrow screens behind the menu button. */
function PlayerMenu({a,section,navigate,open,onClose}:{a:Actor;section:string;navigate:(id:string)=>void;open:boolean;onClose:()=>void}){
 const canManageLocations=a.status==='active'&&['campaign_owner','campaign_gm','campaign_editor'].includes(a.role);
 const go=(id:string)=>{navigate(id);onClose();};
 const current=section==='weltkarte'?'schauplaetze':section;
 return <nav className={styles.menu} data-open={open||undefined} aria-label="Hauptmenü">
  <div className={styles.menuHead}><strong>Menü</strong><button type="button" className={styles.menuClose} onClick={onClose} aria-label="Menü schließen"><X size={18}/></button></div>
  {menuSections(a.gm,canManageLocations).map(({group,items})=><section key={group} aria-label={group}>
   <h2>{group}</h2>
   <ul>
    {group==='Spielleitung'&&a.gm&&<li><a href="/sl/command-center"><MapPinned size={16} aria-hidden="true"/><span>Command Center</span></a></li>}
    {items.map(item=><li key={item.id}>{item.id==='ortscms'
     ?<a href="/sl/command-center?bereich=ortscms"><item.icon size={16} aria-hidden="true"/><span>{item.name}</span></a>
     :<button type="button" aria-current={current===item.id?'page':undefined} onClick={()=>go(item.id)}><item.icon size={16} aria-hidden="true"/><span>{item.name}</span>{item.wip&&<small className={styles.wip}>im Aufbau</small>}</button>}</li>)}
    {group==='Meine Seiten'&&a.status==='active'&&<li><button type="button" onClick={()=>{window.dispatchEvent(new CustomEvent('chroniplay:open-inbox'));onClose();}}><Mail size={16} aria-hidden="true"/><span>Postfach</span></button></li>}
   </ul>
  </section>)}
 </nav>;
}

export function WorkspaceShell({a,section,navigate,children}:{a:Actor;section:string;navigate:(id:string)=>void;children:React.ReactNode}){
 const [preferences,setPreferences]=useState({reducedMotion:false,compactView:false}),[campaignName,setCampaignName]=useState(a.campaignId==='chronik-von-kleve'?'Chronik von Kleve':a.campaignId),[menuOpen,setMenuOpen]=useState(false);
 useEffect(()=>{let live=true;api<{preferences:typeof preferences;campaigns:{id:string;name:string}[]}>('/api/profile').then(p=>{if(live){setPreferences(p.preferences);setCampaignName(p.campaigns.find(c=>c.id===a.campaignId)?.name||a.campaignId);}}).catch(()=>{});return()=>{live=false;};},[a.id,a.campaignId]);
 useEffect(()=>{if(!menuOpen)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenuOpen(false);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[menuOpen]);
 const world=section==='weltkarte'||sections.find(s=>s.id===section)?.group==='Die Welt';
 async function logout(){try{await api('/api/auth/logout','POST',{});window.location.assign('/anmelden');}catch{window.alert('Abmeldung fehlgeschlagen. Bitte erneut versuchen.');}}
 return <div className={`player-shell ${world?'worldShell':'tableShell'} ${preferences.reducedMotion?'user-reduced-motion':''} ${preferences.compactView?'user-compact-view':''}`}>
  {a.status==='active'&&<MessageCenter key={a.campaignId+a.id} a={a} showTrigger={false}/>}
  <header className={styles.header}>
   <button type="button" className={styles.menuButton} aria-expanded={menuOpen} aria-controls="player-menu" onClick={()=>setMenuOpen(o=>!o)}><Menu size={18} aria-hidden="true"/><span>Menü</span></button>
   <button className={styles.brand} type="button" onClick={()=>navigate('dashboard')} aria-label="ChroniPlay – Spielerzentrale">ChroniPlay</button><span className={styles.campaign}>{campaignName}</span>
   <nav className={styles.navigation} aria-label="Kopfleiste">
    <a href="/kampagne"><Users size={17} aria-hidden="true"/><span>Kampagnen</span></a>
    {a.gm&&<a href="/sl/command-center"><MapPinned size={17} aria-hidden="true"/><span>Command Center</span></a>}
   </nav>
   <details className={styles.account}><summary aria-label="Kontomenü"><span>{a.name?.slice(0,1).toUpperCase()}</span><ChevronDown size={14} aria-hidden="true"/></summary><div><strong>{a.name}</strong><a href="/profil">Profil & Einstellungen</a><button type="button" onClick={()=>void logout()}><LogOut size={16} aria-hidden="true"/>Abmelden</button></div></details>
  </header>
  <div className={styles.layout}>
   <div id="player-menu" className={styles.menuSlot}><PlayerMenu a={a} section={section} navigate={navigate} open={menuOpen} onClose={()=>setMenuOpen(false)}/></div>
   {menuOpen&&<button type="button" className={styles.scrim} aria-label="Menü schließen" onClick={()=>setMenuOpen(false)}/>}
   <main className="workspace-main">{children}</main>
  </div>
  <footer className="player-footer"><span>Spieler · {campaignName}</span><span className="player-footer-links"><a href="/api/export"><Download size={14}/>Meine Daten sichern</a></span></footer>
  <Toaster position="bottom-right" theme="dark"/>
 </div>;
}
