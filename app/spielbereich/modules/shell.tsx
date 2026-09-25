"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Native Home links intentionally bypass the reproduced vinext cross-shell navigation failure. */
import { Toaster } from "@/components/ui/sonner";
import { ArrowRight, ArrowLeft, BookOpen, Compass, Download, Home, LogOut, ScrollText, Store, Users, MapPinned } from "lucide-react";

import type { Actor } from "@/domain/types";

import { sections } from "./navigation";
import shellStyles from "./world-shell.module.css";

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
  return <div className={`player-shell ${worldActive ? "worldShell" : ""}`}>
    <header className="player-topbar">
      <a href="/" className="brand" aria-label="Chronik von Kleve – Startseite">
        <span className="brand-mark">CVK</span>
        <span className="brand-copy">CHRONIK VON KLEVE</span>
      </a>
      <div className="player-top-actions">
        <a href="/" className="workspace-home-link"><Home size={15} /><span>Startseite</span></a>
        <span className="player-identity">
          <span className="player-avatar">{a.name?.slice(0, 1).toUpperCase()}</span>
          <span className="player-identity-copy"><strong>{a.name}</strong><small>{a.gm ? "Spielleitung" : "Spielerbereich"}</small></span>
        </span>
        <a href="/signout-with-chatgpt?return_to=/" target="_top" className="player-logout" aria-label="Abmelden"><LogOut size={16} /></a>
      </div>
    </header>
    {worldActive ? <nav className={`player-nav ${shellStyles.worldNav}`} data-world-navigation="world" aria-label="Spielwelt-Navigation">
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
          {canManageLocations&&<button type="button" className={section === "ortscms" ? shellStyles.worldNavActive : ""} aria-current={section === "ortscms" ? "page" : undefined} onClick={() => navigate("ortscms")}><MapPinned size={17} aria-hidden="true" /><span>Ortsverwaltung</span></button>}
          {plannedWorldSections.map(({ title, icon: Icon }) => <span className={shellStyles.worldNavPlanned} aria-disabled="true" key={title}><Icon size={16} aria-hidden="true" /><span>{title}</span><small>Demnächst</small></span>)}
        </div>
        <button type="button" className={shellStyles.worldNavReturn} onClick={() => navigate("dashboard")}><ArrowLeftIcon /><span>Zum Spieltisch</span></button>
      </div>
    </nav> : <nav className="player-nav" aria-label="Spieltisch-Navigation">
      <div className="player-nav-label">
        <span className="eyebrow">DEIN SPIELTISCH</span>
        <strong>Aktive Nacht</strong>
      </div>
      <div className="player-nav-links">
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
      </div>
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
      </button>
      {canManageLocations&&<button type="button" className={`world-switch ${shellStyles.tableWorldSwitch}`} aria-label="Ortsverwaltung öffnen" onClick={()=>navigate("ortscms")}><MapPinned size={17} aria-hidden="true" /><span className="nav-label-long">Ortsverwaltung</span><span className="nav-label-short" aria-hidden="true">CMS</span></button>}
    </nav>}
    <main className="workspace-main">{children}</main>
    <footer className="player-footer"><span>{a.gm ? "Spielleitung" : "Spieler"} · Domäne Kleve</span><span className="player-footer-links">{a.gm && <a href="/api/export?scope=campaign"><Download size={14}/> Kampagne sichern</a>}<a href="/api/export"><Download size={14}/> Meine Daten sichern</a></span></footer>
    <Toaster position="bottom-right" theme="dark" />
  </div>;
}

function ArrowLeftIcon() {
  return <ArrowLeft size={16} aria-hidden="true" />;
}
