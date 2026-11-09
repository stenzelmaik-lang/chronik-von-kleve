"use client";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { BookOpen, ChevronRight, Feather } from "lucide-react";
import { useState } from "react";

import type { Entry } from "@/domain/legacy";
import { RichTextView } from "./rich-text";
import { richTeaser } from "./rich-teaser";

const dateOf = (e: Entry) => String(e.body?.date || e.updated_at || "");
const niceDate = (e: Entry) => { const t = Date.parse(dateOf(e)); return Number.isFinite(t) ? new Date(t).toLocaleDateString("de-DE", { dateStyle: "long" }) : "Ohne Datum"; };
const yearOf = (e: Entry) => { const t = Date.parse(dateOf(e)); return Number.isFinite(t) ? String(new Date(t).getFullYear()) : "Ohne Datum"; };
const isRecap = (e: Entry) => e.body?.type === "rueckblick";

export function ChroniclePanel({
  entries,
  onOpen,
}: {
  entries: Entry[];
  onOpen: (e: Entry) => void;
}) {
  const [filter, setFilter] = useState<"all" | "live">("all");
  const ordered = [...entries].sort((a, b) =>
    String(b.body?.date || b.updated_at || "").localeCompare(
      String(a.body?.date || a.updated_at || ""),
    ),
  );
  const visible =
    filter === "live"
      ? ordered.filter((e) => e.visibility === "group")
      : ordered;
  const latest = ordered[0];
  return (
    <div className="chronicle-stack">
      <section className="chronicle-hero">
        <div>
          <p className="eyebrow">
            <BookOpen size={14} /> CHRONIK · FALLAKTE 01
          </p>
          <h2>Die Nacht hinterlässt Spuren.</h2>
          <p>
            Kapitel, Wendepunkte und Gerüchte liegen hier in einer gemeinsamen
            Abfolge. Öffne einen Eintrag, wenn du tiefer in die Szene willst.
          </p>
        </div>
        <div className="chronicle-seal">
          <span>{String(ordered.length).padStart(2, "0")}</span>
          <small>SPUREN</small>
        </div>
      </section>
      <section className="chronicle-toolbar">
        <div>
          <p className="eyebrow">AKTUELLE FASSUNG</p>
          <h3>{latest?.title || "Noch kein Kapitel geöffnet"}</h3>
          <p className="muted">
            {richTeaser(latest?.body?.summary || latest?.body?.text, 200) ||
              "Die Spielleitung baut die Chronik hier Schritt für Schritt auf."}
          </p>
        </div>
        <div className="chronicle-filters">
          <button
            className={filter === "all" ? "button primary" : "button"}
            onClick={() => setFilter("all")}
          >
            Alle Einträge
          </button>
          <button
            className={filter === "live" ? "button primary" : "button"}
            onClick={() => setFilter("live")}
          >
            Nur freigegeben
          </button>
        </div>
      </section>
      {visible.length === 0 ? (
        <Empty className="empty-night">
          <EmptyHeader>
            <Feather size={34} className="text-primary mb-3" />
            <EmptyTitle>Noch keine freigegebenen Spuren</EmptyTitle>
            <EmptyDescription>
              Die Spielleitung kann im CMS die ersten Kapitel veröffentlichen.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="chronicle-timeline">
          {visible.map((entry, i) => (
            <div key={entry.id || entry.title} className="chronicle-event-wrap">
            {(i === 0 || yearOf(visible[i - 1]) !== yearOf(entry)) && <h3 className="chronicle-year">{yearOf(entry)}</h3>}
            <article className="chronicle-event" data-recap={isRecap(entry) || undefined}>
              <div className="chronicle-event-rail">
                <span className="chronicle-event-index">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="chronicle-event-line" />
              </div>
              <div className="chronicle-event-body">
                <div className="chronicle-event-meta">
                  <span>{niceDate(entry)}</span>
                  {isRecap(entry) && <span className="badge">Rückblick</span>}
                  <span className="badge">
                    {entry.visibility === "group"
                      ? "Freigegeben"
                      : "Spielleitung"}
                  </span>
                  {entry.body?.source && (
                    <span>{String(entry.body.source)}</span>
                  )}
                </div>
                <h3>{entry.title}</h3>
                <p className="chronicle-teaser">
                  {richTeaser(entry.body?.summary || entry.body?.text) ||
                    "Dieser Eintrag bewahrt eine Spur der Domäne."}
                </p>
                {entry.body?.text && (
                  <details>
                    <summary>Lesetext einblenden</summary>
                    <div className="chronicle-read"><RichTextView value={String(entry.body.text)} readable /></div>
                  </details>
                )}
                {isRecap(entry) ? <a className="button" href={`/spielbereich?bereich=rueckblick&session=${encodeURIComponent(entry.id || "")}`}>Rückblick lesen <ChevronRight size={15} /></a> : <button
                  className="button"
                  onClick={() => onOpen(structuredClone(entry))}
                >
                  Eintrag öffnen <ChevronRight size={15} />
                </button>}
              </div>
            </article>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
