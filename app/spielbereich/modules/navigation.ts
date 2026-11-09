"use client";
import {
  BookOpen,
  CalendarDays,
  Coins,
  Compass,
  Dices,
  Images,
  LayoutDashboard,
  Library,
  MapPin,
  Newspaper,
  NotebookPen,
  PanelTop,
  Radio,
  Scale,
  ScrollText,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";
type Section = {
  id: string;
  name: string;
  icon: LucideIcon;
  desc: string;
  group?: string;
  gmOnly?: boolean;
  cmsAccessOnly?: boolean;
  mainNav?: boolean;
  /** Planned area that stays in the menu with the note "im Aufbau". */
  wip?: boolean;
};

export const sections: Section[] = [
  // Mein Abend
  { id: "dashboard", name: "Zuflucht", icon: PanelTop, desc: "Alles Wichtige für deine nächste Nacht.", group: "Mein Abend" },
  { id: "sitzung", name: "Spieltisch", icon: Radio, desc: "Der Spielabend live: Bühne, Szenen und Würfel.", group: "Mein Abend" },
  { id: "termine", name: "Termine", icon: CalendarDays, desc: "Kalender, Spielabende und gemeinsame Terminabstimmung.", group: "Mein Abend" },
  { id: "rueckblick", name: "Rückblicke", icon: BookOpen, desc: "Freigegebene Zusammenfassungen vergangener Spielabende.", group: "Mein Abend" },
  // Mein Charakter
  { id: "charaktere", name: "Charakter", icon: Users, desc: "Dein Charakterbogen, dein Charakterprofil und deine Entwicklung.", group: "Mein Charakter" },
  { id: "inventar", name: "Inventar", icon: ShoppingBag, desc: "Ausrüstung, Waffen und Dinge mit Geschichte.", group: "Mein Charakter" },
  { id: "gefallen", name: "Gefallen", icon: Scale, desc: "Schulden und Versprechen der Nacht.", group: "Mein Charakter" },
  { id: "wirtschaft", name: "Wirtschaft", icon: Coins, desc: "Vermögen, Ausgaben und die Ökonomie der Nacht.", group: "Mein Charakter", wip: true },
  // Meine Seiten (das Postfach ist ein Fenster und steht als Aktion im Menü)
  { id: "notizen", name: "Notizbuch", icon: NotebookPen, desc: "Dein Notizbuch, deine Spielabendvorbereitung und dein persönliches Archiv.", group: "Meine Seiten" },
  { id: "galerie", name: "Galerie", icon: Images, desc: "Die Bilder, die eure Charaktere mit der Runde teilen.", group: "Meine Seiten" },
  // Die Welt
  { id: "chronik", name: "Chronik", icon: BookOpen, desc: "Die Ereignisse der Domäne Kleve.", group: "Die Welt" },
  { id: "schauplaetze", name: "Orte", icon: MapPin, desc: "Jeder Ort bewahrt seine Geschichte. Als Liste oder auf der Karte.", group: "Die Welt" },
  { id: "nscs", name: "Persönlichkeiten", icon: Users, desc: "Verbündete, Rivalen und unbekannte Absichten.", group: "Die Welt" },
  { id: "archiv", name: "Überlieferungen", icon: Library, desc: "Dokumente und Handouts, die die Spielleitung freigegeben hat.", group: "Die Welt" },
  { id: "regelwerk", name: "Codex Noctis", icon: ScrollText, desc: "Das Wissen für euren Spielabend.", group: "Die Welt" },
  { id: "neuigkeiten", name: "Neuigkeiten", icon: Newspaper, desc: "Nachrichten aus der Domäne.", group: "Die Welt", wip: true },
  { id: "haendler", name: "Händler", icon: Store, desc: "Angebote und Kontakte.", group: "Die Welt", wip: true },
  // Spielleitung
  { id: "vorbereitung", name: "Materialvorbereitung", icon: Library, desc: "Eigene Dokumente und Material für den Tisch vorbereiten.", group: "Spielleitung", gmOnly: true },
  { id: "cms", name: "Chronik-CMS", icon: LayoutDashboard, desc: "Inhalte kuratieren, freigeben und ordnen.", group: "Spielleitung", gmOnly: true },
  { id: "ortscms", name: "Ortsverwaltung", icon: MapPin, desc: "Bestehende Orte sicher bearbeiten und gezielt freigeben.", group: "Spielleitung", cmsAccessOnly: true },
  // Weiter per Link erreichbar, aber nicht im Menü
  { id: "weltkarte", name: "Orte", icon: Compass, desc: "Entdecke Kleve und seine verborgenen Wege.", mainNav: false },
  { id: "wuerfel", name: "Würfel", icon: Dices, desc: "Lass das Schicksal entscheiden. Gewürfelt wird am Spieltisch.", mainNav: false },
];

/** Menu groups in display order (4c). */
export const navGroups = ["Mein Abend", "Mein Charakter", "Meine Seiten", "Die Welt", "Spielleitung"];

/** "Die Welt" dropdown and world bar in the header (4c, version 3), in this order. */
export const worldSections = ["schauplaetze", "chronik", "nscs", "archiv", "regelwerk", "neuigkeiten", "haendler"].map(id => sections.find(s => s.id === id)!);

/** "Command Center" dropdown, only for the SL: jump straight into a work area. */
export const commandCenterLinks: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Spieltisch-Regie", href: "/sl/command-center?bereich=sitzung", icon: Radio },
  { label: "Charaktere", href: "/sl/command-center?bereich=charaktere", icon: Users },
  { label: "Persönlichkeiten (NSC)", href: "/sl/command-center?bereich=nscs", icon: Users },
  { label: "Ortsverwaltung", href: "/sl/command-center?bereich=ortscms", icon: MapPin },
  { label: "Materialvorbereitung", href: "/sl/command-center?bereich=vorbereitung", icon: Library },
  { label: "Galerie (Dateien)", href: "/sl/command-center?bereich=galerie", icon: Images },
  { label: "Chronik-CMS", href: "/spielbereich?bereich=cms", icon: LayoutDashboard },
];

export const personal = [
  "charaktere",
  "notizen",
  "gefallen",
  "wirtschaft",
  "inventar",
];
