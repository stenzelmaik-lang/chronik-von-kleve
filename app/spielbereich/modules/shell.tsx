"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Native Home links intentionally bypass the reproduced vinext cross-shell navigation failure. */
import { Toaster } from "@/components/ui/sonner";
import { ArrowRight, ArrowLeft, BookOpen, Compass, Download, Home, LogOut, ScrollText, Store, Users, MapPinned } from "lucide-react";

import type { Actor } from "@/domain/types";

import { sections } from "./navigation";
import shellStyles from "./world-shell.module.css";
import { MessageCenter } from "./message-center";
import { api } from "./api-client";
import { useEffect, useState } from "react";

const plannedWorldSections = [
  { title: "Persönlichkeiten", icon: Users },
  { title: "Händler", icon: Store },
  { title: "Archiv", icon: BookOpen },
  { title: "Chronikbuch", icon: ScrollText },
  { title: "Regelwerke", icon: Compass },
];

export function WorkspaceShell({
  a,
  section,
  navigate,
  children,
}: {
  a: Actor;
  section: string;
  navigate: (id: string) => void;
  children: React.ReactNode;
}) {
  const table = sections.filter((s) => s.group === "SPIELTISCH");
  const canManageLocations=a.status==="active"&&["campaign_owner","campaign_gm","campaign_editor"].includes(a.role);
  const worldActive = sections.find((s) => s.id === section)?.group === "SPIELWELT";
  const cmsActive=section==="ortscms";
  const [profilePreferences,setProfilePreferences]=useState({reducedMotion:false,compactView:false});
  useEffect(()=>{let active=true;void fetch('/api/profile',{cache:'no-store'}).then(async r=>r.ok?await r.json() as {preferences?:{reducedMotion:boolean;compactView:boolean}}:null).then(p=>{if(active&&p?.preferences)setProfilePreferences(p.preferences);}).catch(()=>{});return ()=>{active=false;};},[a.id]);
  async function logout() {
    try {
      await api("/api/auth/logout","POST",{});
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- A full navigation discards all protected client state after logout.
      window.location.assign("/anmelden");
    } catch { window.alert("Abmeldung fehlgeschlagen. Bitte erneut versuchen."); }
  }
  return <div className={`player-shell ${worldActive||cmsActive ? "worldShell" : ""} ${profilePreferences.reducedMotion?'user-reduced-motion':''} ${profilePreferences.compactView?'user-compact-view':''}`}>
    <header className="player-topbar">
      <a href="/" className="brand" aria-label="Chronik von Kleve – Startseite">
        <span className="brand-mark">CVK</span>
        <span className="brand-copy">CHRONIK VON KLEVE</span>
      </a>
      <div className="player-top-actions">
        {a.status === "active" && <MessageCenter key={a.campaignId + a.id} a={a}/>}
        <a href="/" className="workspace-home-link"><Home size={15} /><span>Startseite</span></a>
        {canManageLocations&&!cmsActive&&<a href="/spielbereich?bereich=ortscms" className="workspace-home-link" aria-label="SL-CMS öffnen" title="SL-CMS"><MapPinned size={15} /><span>SL-CMS</span></a>}
        <a href="/profil" className="player-identity" aria-label="Mein Profil öffnen" title="Mein Profil">
          <span className="player-avatar">{a.name?.slice(0, 1).toUpperCase()}</span>
          <span className="player-identity-copy"><strong>{a.name}</strong><small>{a.gm ? "Spielleitung" : "Spielerbereich"}</small></span>
        </a>
        <button type="button" className="player-logout" aria-label="Abmelden" onClick={()=>void logout()}><LogOut size={16} /></button>
      </div>
    </header>
    {cmsActive ? <nav className={`player-nav ${shellStyles.worldNav} ${shellStyles.cmsNav}`} data-world-navigation="sl-cms" aria-label="SL-CMS-Navigation">
      <div className={`player-nav-label ${shellStyles.worldNavLabel}`}>
        <span className="eyebrow">SPIELLEITUNG</span>
        <strong>SL-CMS</strong>
      </div>
      <div className={shellStyles.cmsNavLinks}>
        <span className={shellStyles.cmsNavActive}><MapPinned size={17} aria-hidden="true"/><span>Orte</span></span>
      </div>
      <button type="button" className={shellStyles.worldNavReturn} onClick={() => navigate("dashboard")}><ArrowLeftIcon /><span>Zum Spieltisch</span></button>
    </nav> : worldActive ? <nav className={`player-nav ${shellStyles.worldNav}`} data-world-navigation="world" aria-label="Spielwelt-Navigation">
      <div className={`player-nav-label ${shellStyles.worldNavLabel}`}>
        <span className="eyebrow">SPIELWELT</span>
        <strong>Domäne Kleve</strong>
      </div>
      <div className={shellStyles.worldNavRight}>
        <div className={shellStyles.worldNavLinks}>
          <button type="button" className={section === "schauplaetze" || section === "weltkarte" ? shellStyles.worldNavActive : ""} aria-current={section === "schauplaetze" || section === "weltkarte" ? "page" : undefined} onClick={() => navigate("schauplaetze")}>
            <Compass size={17} aria-hidden="true" /><span>Orte</span>
          </button>
          <button type="button" className={section === "chronik" ? shellStyles.worldNavActive : ""} aria-current={section === "chronik" ? "page" : undefined} onClick={() => navigate("chronik")}><BookOpen size={17} aria-hidden="true" /><span>Chronik</span></button>
          {plannedWorldSections.map(({ title, icon: Icon }) => <span className={shellStyles.worldNavPlanned} aria-disabled="true" key={title}><Icon size={16} aria-hidden="true" /><span>{title}</span><small>Demnächst</small></span>)}
        </div>
        <button type="button" className={shellStyles.worldNavReturn} onClick={() => navigate("dashboard")}><ArrowLeftIcon /><span>Zum Spieltisch</span></button>
      </div>
    </nav> : <nav className="player-nav" aria-label="Spieltisch-Navigation">
      <div className="player-nav-label">
        <span className="eyebrow">DEIN SPIELTISCH</span>
        <strong>Aktive Nacht</strong>
      </div>
      {section === "ortscms" ? <div className={shellStyles.cmsNavLinks}>
        <span className={shellStyles.cmsNavActive}><MapPinned size={17} aria-hidden="true"/><span>Orte</span></span>
      </div> : <div className="player-nav-links">
        {table.map((s) => {
          const compactName = ({ dashboard: "Start", charaktere: "Figur", inventar: "Tasche", sitzung: "Szene", wuerfel: "Würfel" } as Record<string, string>)[s.id] || s.name;
          return <button
            type="button"
            key={s.id}
            className={section === s.id ? "active" : ""}
            aria-current={section === s.id ? "page" : undefined}
            aria-label={`${s.name} öffnen`}
            onClick={() => navigate(s.id)}
          >
            <s.icon size={17} aria-hidden="true" />
            <span className="nav-label-long">{s.name}</span>
            <span className="nav-label-short" aria-hidden="true">{compactName}</span>
          </button>;
        })}
      </div>}
      {section === "ortscms" ? <button type="button" className={shellStyles.cmsReturn} onClick={() => navigate("dashboard")}><ArrowLeftIcon /><span>Zum Spieltisch</span></button> :
      <button
        type="button"
        className={`world-switch ${shellStyles.tableWorldSwitch}`}
        aria-label="Spielwelt öffnen: Orte"
        onClick={() => navigate("schauplaetze")}
      >
        <BookOpen size={17} aria-hidden="true" />
        <span className="nav-label-long">Spielwelt öffnen</span>
        <span className="nav-label-short" aria-hidden="true">Welt</span>
        <ArrowRight className="world-switch-arrow" size={16} aria-hidden="true" />
      </button>}
    </nav>}
    <main className="workspace-main">{children}</main>
    <footer className="player-footer"><span>{a.gm ? "Spielleitung" : "Spieler"} · Domäne Kleve</span><span className="player-footer-links">{a.gm && <a href="/api/export?scope=campaign"><Download size={14}/> Kampagne sichern</a>}<a href="/api/export"><Download size={14}/> Meine Daten sichern</a></span></footer>
    <Toaster position="bottom-right" theme="dark" />
  </div>;
}

function ArrowLeftIcon() {
  return <ArrowLeft size={16} aria-hidden="true" />;
}
