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
};

export const sections: Section[] = [
  {
    id: "dashboard",
    name: "Übersicht",
    icon: PanelTop,
    desc: "Alles Wichtige für deine nächste Nacht.",
    group: "SPIELTISCH",
  },
  {
    id: "charaktere",
    name: "Charaktere",
    icon: Users,
    desc: "Deine Kainskinder und ihre Geschichten.",
    group: "SPIELTISCH",
  },
  {
    id: "inventar",
    name: "Inventar",
    icon: ShoppingBag,
    desc: "Ausrüstung, Waffen und Dinge mit Geschichte.",
    group: "SPIELTISCH",
  },
  {
    id: "sitzung",
    name: "Sitzung",
    icon: Radio,
    desc: "Live-Szenen, Initiative und der Spieltisch.",
    group: "SPIELTISCH",
  },
  {
    id: "wuerfel",
    name: "Würfel",
    icon: Dices,
    desc: "Lass das Schicksal entscheiden.",
    group: "SPIELTISCH",
  },
  {
    id: "chronik",
    name: "Chronik",
    icon: BookOpen,
    desc: "Die Ereignisse der Domäne Kleve.",
    group: "SPIELWELT",
  },
  {
    id: "schauplaetze",
    name: "Schauplätze",
    icon: MapPin,
    desc: "Jeder Ort bewahrt seine Geschichte.",
    group: "SPIELWELT",
  },
  {
    id: "weltkarte",
    name: "Weltkarte",
    icon: Compass,
    desc: "Entdecke Kleve und seine verborgenen Wege.",
    group: "SPIELWELT",
  },
  {
    id: "nscs",
    name: "Persönlichkeiten",
    icon: Users,
    desc: "Verbündete, Rivalen und unbekannte Absichten.",
    group: "SPIELWELT",
  },
  {
    id: "archiv",
    name: "Archiv",
    icon: Library,
    desc: "Dokumente und Überlieferungen.",
    group: "SPIELWELT",
  },
  {
    id: "regelwerk",
    name: "Codex Noctis",
    icon: ScrollText,
    desc: "Das Wissen für euren Spielabend.",
    group: "SPIELWELT",
  },
  {
    id: "haendler",
    name: "Händler",
    icon: Store,
    desc: "Angebote und Kontakte.",
    group: "SPIELWELT",
  },
  {
    id: "termine",
    name: "Termine",
    icon: CalendarDays,
    desc: "Die nächste Zusammenkunft.",
    group: "SPIELWELT",
  },
  {
    id: "neuigkeiten",
    name: "Neuigkeiten",
    icon: Newspaper,
    desc: "Nachrichten aus der Domäne.",
    group: "SPIELWELT",
  },
  {
    id: "notizen",
    name: "Meine Notizen",
    icon: NotebookPen,
    desc: "Was du weißt. Was du vermutest. Was bleibt.",
    group: "DEINE SPUREN",
  },
  {
    id: "gefallen",
    name: "Gefallen",
    icon: Scale,
    desc: "Schulden und Versprechen der Nacht.",
    group: "DEINE SPUREN",
  },
  {
    id: "wirtschaft",
    name: "Wirtschaft",
    icon: Coins,
    desc: "Vermögen, Ausgaben und die Ökonomie der Nacht.",
    group: "DEINE SPUREN",
  },
  {
    id: "galerie",
    name: "Bilder & Dateien",
    icon: Images,
    desc: "Porträts, Erinnerungen und Handouts.",
    group: "DEINE SPUREN",
  },
  {
    id: "cms",
    name: "Chronik-CMS",
    icon: LayoutDashboard,
    desc: "Inhalte kuratieren, freigeben und ordnen.",
    group: "SPIELLEITUNG",
    gmOnly: true,
  },
];

export const navGroups = [
  "SPIELTISCH",
  "SPIELWELT",
  "DEINE SPUREN",
  "SPIELLEITUNG",
];

export const personal = [
  "charaktere",
  "notizen",
  "gefallen",
  "wirtschaft",
  "inventar",
];
