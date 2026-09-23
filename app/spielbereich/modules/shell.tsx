"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Native Home links intentionally bypass the reproduced vinext cross-shell navigation failure. */
import { Toaster } from "@/components/ui/sonner";
import { ArrowRight, BookOpen, Download, Home, LogOut } from "lucide-react";

import type { Actor } from "@/domain/types";

import { sections } from "./navigation";

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
  return <div className="player-shell">
    <header className="player-topbar"><a href="/" className="brand"><span className="brand-mark">CVK</span><span className="brand-copy">CHRONIK VON KLEVE</span></a><div className="player-top-actions"><a href="/" className="workspace-home-link"><Home size={15} /><span>Startseite</span></a><span className="player-identity"><span className="player-avatar">{a.name?.slice(0, 1).toUpperCase()}</span><span>{a.name}</span></span><a href="/signout-with-chatgpt?return_to=/" target="_top" className="player-logout" aria-label="Abmelden"><LogOut size={15} /></a></div></header>
    <nav className="player-nav" aria-label="Spieltisch-Navigation"><div className="player-nav-label"><span className="eyebrow">DEIN SPIELTISCH</span><strong>Aktive Nacht</strong></div><div className="player-nav-links">{table.map((s) => <button key={s.id} className={section === s.id ? "active" : ""} onClick={() => navigate(s.id)}><s.icon size={17} /><span>{s.name}</span></button>)}</div><button className="world-switch" onClick={() => navigate("schauplaetze")}><BookOpen size={17} /><span>Spielwelt öffnen</span><ArrowRight size={16} /></button></nav>
    <main className="workspace-main">{children}</main>
    <footer className="player-footer"><span>{a.gm ? "Spielleitung" : "Spieler"} · Domäne Kleve</span><span className="player-footer-links">{a.gm && <a href="/api/export?scope=campaign"><Download size={14}/> Kampagne sichern</a>}<a href="/api/export"><Download size={14}/> Meine Daten sichern</a></span></footer>
    <Toaster position="bottom-right" theme="dark" />
  </div>;
}
