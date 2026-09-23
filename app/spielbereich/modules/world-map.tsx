"use client";
import { ChevronRight, Lock, MapPin } from "lucide-react";

import type { Entry } from "@/domain/legacy";
import type { Actor } from "@/domain/types";

export function WorldMapPanel({
  entries,
  a,
  onOpen,
}: {
  entries: Entry[];
  a: Actor;
  onOpen: (e: Entry) => void;
}) {
  const points = entries.map((e, i) => {
    const g = e.body?.geo;
    const x = Number.isFinite(g?.lon)
      ? 48 + (Number(g?.lon) - 6.05) * 160
      : 18 + ((i * 17) % 72);
    const y = Number.isFinite(g?.lat)
      ? 70 - (Number(g?.lat) - 51.75) * 190
      : 24 + ((i * 23) % 58);
    return {
      ...e,
      x: Math.max(8, Math.min(92, x)),
      y: Math.max(10, Math.min(88, y)),
    };
  });
  const openPoint = (p: Entry) => {
    const locked = p.body?.discovered === false && !a.gm;
    onOpen(
      locked
        ? {
            ...p,
            title: "Unbekannter Ort",
            body: {
              summary: "Dieser Ort wurde noch nicht entdeckt.",
              text: "Die Spielleitung hat diesen Ort noch nicht freigegeben.",
            },
            canEdit: false,
          }
        : p,
    );
  };
  return (
    <div className="world-layout">
      <section className="panel world-map-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">INTERAKTIVE DOMÄNE</p>
            <h2>Kleve bei Nacht</h2>
            <p className="muted">
              Klicke auf einen Punkt, um den Ort zu öffnen. Unentdeckte Orte
              bleiben als Fragezeichen verborgen.
            </p>
          </div>
          <span className="badge">
            <MapPin size={14} />{" "}
            {points.filter((p) => p.body?.discovered !== false || a.gm).length}/
            {points.length} entdeckt
          </span>
        </div>
        <div
          className="world-map"
          aria-label="Interaktive Karte der Domäne Kleve"
        >
          <svg
            viewBox="0 0 800 420"
            role="img"
            aria-label="Stilisierte Karte von Kleve"
          >
            <path
              d="M0 80 C140 30 210 115 325 80 S560 35 800 75 V0 H0Z"
              fill="#1d2a2d"
            />
            <path
              d="M0 345 C150 290 230 380 390 325 S620 280 800 330 V420 H0Z"
              fill="#141f24"
            />
            <path
              d="M-20 230 C130 170 220 275 350 205 S600 150 820 215"
              fill="none"
              stroke="#394d4d"
              strokeWidth="34"
              opacity=".8"
            />
            <path
              d="M-20 230 C130 170 220 275 350 205 S600 150 820 215"
              fill="none"
              stroke="#8aa19a"
              strokeWidth="2"
              opacity=".65"
            />
            <path
              d="M140 0 C180 95 135 178 200 250 S235 360 205 440 M610 -10 C575 95 650 145 595 250 S570 350 620 430"
              fill="none"
              stroke="#38464a"
              strokeWidth="5"
              opacity=".7"
            />
          </svg>
          {points.map((p) => {
            const locked = p.body?.discovered === false && !a.gm;
            return (
              <button
                type="button"
                key={p.id}
                className={locked ? "map-pin locked" : "map-pin"}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                onClick={() => openPoint(p)}
                title={locked ? "Unbekannter Ort" : p.title}
              >
                {locked ? <Lock size={14} /> : <MapPin size={17} />}
                <span>{locked ? "?" : p.title}</span>
              </button>
            );
          })}
        </div>
      </section>
      <aside className="place-rail">
        <h3>Orte der Domäne</h3>
        {points.map((p) => {
          const locked = p.body?.discovered === false && !a.gm;
          return (
            <button
              type="button"
              className="place-row"
              key={p.id}
              onClick={() => openPoint(p)}
            >
              <span className="place-icon">
                {locked ? <Lock size={15} /> : <MapPin size={15} />}
              </span>
              <span>
                <strong>{locked ? "Unbekannter Ort" : p.title}</strong>
                <small>
                  {locked
                    ? "Noch nicht entdeckt"
                    : p.body?.summary || "Ort öffnen"}
                </small>
              </span>
              <ChevronRight size={16} />
            </button>
          );
        })}
      </aside>
    </div>
  );
}
