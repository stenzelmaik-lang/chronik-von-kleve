"use client";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArchiveRestore,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CircleDotDashed,
  Eye,
  FolderKanban,
  LayoutDashboard,
  MapPin,
  Newspaper,
  Plus,
  ScrollText,
  Store,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

import type { Entry } from "@/domain/legacy";
import type { Actor } from "@/domain/types";

import { api } from "./api-client";
import { sections } from "./navigation";
import { RecoveryPanel } from "./recovery-panel";
export const cmsKinds = [
  {
    id: "chronik",
    name: "Chronik",
    desc: "Ereignisse und Kapitel",
    icon: BookOpen,
  },
  {
    id: "schauplaetze",
    name: "Schauplätze",
    desc: "Orte und Szenen",
    icon: MapPin,
  },
  {
    id: "nscs",
    name: "Persönlichkeiten",
    desc: "NSC, Verbündete und Rivalen",
    icon: Users,
  },
  {
    id: "haendler",
    name: "Händler",
    desc: "Angebote und Kontakte",
    icon: Store,
  },
  {
    id: "termine",
    name: "Termine",
    desc: "Spielabende und Fristen",
    icon: CalendarDays,
  },
  {
    id: "neuigkeiten",
    name: "Neuigkeiten",
    desc: "Signale aus der Domäne",
    icon: Newspaper,
  },
  {
    id: "archiv",
    name: "Archiv",
    desc: "Dokumente und Überlieferungen",
    icon: ArchiveRestore,
  },
  {
    id: "regelwerk",
    name: "Codex Noctis",
    desc: "Regeln und Hausregeln",
    icon: ScrollText,
  },
  {
    id: "mechaniken",
    name: "Mechaniken",
    desc: "Spielsysteme und Abläufe",
    icon: FolderKanban,
  },
  {
    id: "gefahren",
    name: "Gefahren",
    desc: "Bedrohungen und Eskalationen",
    icon: CircleDotDashed,
  },
] as const;

export function CMSPanel({
  onNavigate,
  onOpen,
  onCreate,
}: {
  a: Actor;
  onNavigate: (id: string) => void;
  onOpen: (e: Entry) => void;
  onCreate: (kind: string) => void;
}) {
  const [records, setRecords] = useState<Record<string, Entry[]>>({});
  const [selected, setSelected] = useState("chronik");
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const [fileCount, setFileCount] = useState(0);
  useEffect(() => {
    let alive = true;
    Promise.all([
      Promise.all(
        cmsKinds.map(
          async (k) =>
            [k.id, (await api("/api/records?kind=" + k.id)).records || []] as [
              string,
              Entry[],
            ],
        ),
      ),
      api("/api/files"),
    ])
      .then(([rows, files]) => {
        if (alive) {
          setRecords(Object.fromEntries(rows));
          setFileCount((files.files || []).length);
        }
      })
      .catch((e) => alive && setErr((e as Error).message))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, []);
  const kind = cmsKinds.find((k) => k.id === selected) || cmsKinds[0];
  const list = records[selected] || [];
  const total = Object.values(records).reduce(
    (n, items) => n + items.length,
    0,
  );
  const liveCount = Object.values(records).reduce(
    (n, items) => n + items.filter((e) => e.visibility === "group").length,
    0,
  );
  if (busy)
    return (
      <div className="cms-stack">
        <div className="cms-hero">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="cms-library-grid">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  return (
    <div className="cms-stack">
      <RecoveryPanel />
      {err && (
        <div className="error-box" role="alert">
          {err}
        </div>
      )}
      <section className="cms-hero">
        <div>
          <p className="eyebrow">
            <LayoutDashboard size={14} /> SPIELLEITUNG · REDAKTION
          </p>
          <h2>Die Chronik formen</h2>
          <p>
            Hier entscheidest du, was die Gruppe sieht, welche Spur zuerst
            erscheint und welche Inhalte im Spiel bleiben. Jeder Eintrag wird
            erst durch dich zur Szene.
          </p>
        </div>
        <div className="cms-hero-stats">
          <span>
            <b>{total}</b>
            <small>Einträge</small>
          </span>
          <span>
            <b>{liveCount}</b>
            <small>freigegeben</small>
          </span>
          <span>
            <b>{fileCount}</b>
            <small>Assets</small>
          </span>
        </div>
      </section>
      <section className="cms-library">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">CONTENT LIBRARY</p>
            <h3>Bausteine der Domäne</h3>
          </div>
          <span className="badge">
            <FolderKanban size={14} /> {cmsKinds.length} Sammlungen
          </span>
        </div>
        <div className="cms-library-grid">
          {cmsKinds.map((k) => {
            const count = (records[k.id] || []).length;
            const live = (records[k.id] || []).filter(
              (e) => e.visibility === "group",
            ).length;
            const Icon = k.icon;
            return (
              <article
                className={selected === k.id ? "cms-kind active" : "cms-kind"}
                key={k.id}
                onClick={() => setSelected(k.id)}
              >
                <div className="cms-kind-top">
                  <span className="cms-kind-icon">
                    <Icon size={18} />
                  </span>
                  <span className="cms-kind-count">{count}</span>
                </div>
                <strong>{k.name}</strong>
                <small>{k.desc}</small>
                <span className="cms-kind-meta">
                  <Eye size={13} /> {live} sichtbar
                </span>
              </article>
            );
          })}
        </div>
      </section>
      <section className="cms-editor">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{kind.name.toUpperCase()} · AUSGEWÄHLT</p>
            <h3>{kind.name} verwalten</h3>
            <p className="muted">
              {kind.desc}. Öffne Einträge zum Bearbeiten oder lege direkt einen
              neuen Baustein an.
            </p>
          </div>
          <button className="button primary" onClick={() => onCreate(selected)}>
            <Plus size={16} /> Neu anlegen
          </button>
        </div>
        {list.length === 0 ? (
          <Empty className="cms-empty">
            <EmptyHeader>
              <FolderKanban size={32} className="text-primary mb-3" />
              <EmptyTitle>Noch keine Einträge</EmptyTitle>
              <EmptyDescription>
                Lege den ersten Inhalt für diese Sammlung an.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="cms-record-list">
            {list.map((entry) => (
              <article className="cms-record" key={entry.id}>
                <div className="cms-record-copy">
                  <span className="badge">
                    {entry.visibility === "group" ? (
                      <>
                        <CheckCircle2 size={13} /> Freigegeben
                      </>
                    ) : entry.visibility === "sl" ? (
                      "Nur Spielleitung"
                    ) : (
                      "Privat"
                    )}
                  </span>
                  <h4>{entry.title}</h4>
                  <p>
                    {entry.body?.summary ||
                      entry.body?.text?.slice(0, 180) ||
                      "Ohne Kurzbeschreibung"}
                  </p>
                  <small>
                    Aktualisiert{" "}
                    {entry.updated_at
                      ? new Date(entry.updated_at).toLocaleDateString("de-DE")
                      : "gerade eben"}
                  </small>
                </div>
                <button
                  className="button"
                  onClick={() => onOpen(structuredClone(entry))}
                >
                  Öffnen
                </button>
              </article>
            ))}
          </div>
        )}
        {sections.some((s) => s.id === selected) && (
          <button
            className="button cms-preview"
            onClick={() => onNavigate(selected)}
          >
            <Eye size={16} /> Im Spielbereich ansehen
          </button>
        )}
      </section>
    </div>
  );
}
