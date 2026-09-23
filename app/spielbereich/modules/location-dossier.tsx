/* eslint-disable @next/next/no-img-element -- Existing campaign images are served from the Site assets. */
"use client";

import {
  Activity,
  BellRing,
  BookMarked,
  CircleAlert,
  Eye,
  EyeOff,
  FileText,
  Lock,
  MapPin,
  NotebookPen,
  Pin,
  Radio,
  Save,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { Entry } from "@/domain/legacy";
import type {
  DiscoveryState,
  PlaceProjection,
  PreparedActionStatus,
  ProjectedArea,
  StateMarkerId,
  WorldStateId,
} from "@/domain/location-types";
import type { Actor } from "@/domain/types";

import { api } from "./api-client";
import { safeImage } from "./shared";

const PLACE_ID = "place.electric-taberna";

const discoveryLabels: Record<DiscoveryState, string> = {
  hidden: "Verborgen",
  rumored: "Gerücht",
  known: "Bekannt",
  visited: "Besucht",
  investigated: "Untersucht",
};

const worldStateLabels: Record<WorldStateId, string> = {
  active: "Normal",
  changed: "Verändert",
  inaccessible: "Unzugänglich",
  destroyed: "Zerstört",
  abandoned: "Verlassen",
};

const markerLabels: Record<StateMarkerId, string> = {
  dangerous: "Gefährlich",
  locked: "Gesperrt",
  occupied: "Besetzt",
  contaminated: "Kontaminiert",
  watched: "Unter Beobachtung",
  contested: "Umkämpft",
  unstable: "Instabil",
  highSecurity: "Erhöhte Sicherheitslage",
};

const actionLabels: Record<PreparedActionStatus, string> = {
  ready: "Bereit",
  triggered: "Ausgelöst",
  open: "Offen",
};

type LocationPayload = {
  projection: PlaceProjection;
};

type NoteEntry = Entry & {
  body: Entry["body"] & {
    locationId?: string;
    noteType?: string;
    pinned?: boolean;
    targetId?: string;
  };
};

export function LocationDossierPanel({
  a,
  entries,
  onOpen,
}: {
  a: Actor;
  entries: Entry[];
  onOpen: (e: Entry) => void;
}) {
  const [view, setView] = useState<"sl" | "player">(a.gm ? "sl" : "player");
  const [projection, setProjection] = useState<PlaceProjection | null>(null);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({ place: PLACE_ID, view });
    if (view === "player") params.set("target", "group");
    Promise.all([
      api<LocationPayload>("/api/locations?" + params.toString()),
      api<{ records: NoteEntry[] }>("/api/records?kind=notizen"),
    ])
      .then(([locationPayload, notePayload]) => {
        if (!alive) return;
        setError("");
        setProjection(locationPayload.projection);
        setNotes(
          notePayload.records.filter(
            (note) => note.body?.locationId === PLACE_ID,
          ),
        );
      })
      .catch((e: Error) => {
        if (!alive) return;
        setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [view, refresh]);

  const location = projection?.location;
  const visibleRoomCount = useMemo(
    () =>
      location?.areas.reduce((count, area) => count + area.rooms.length, 0) ??
      0,
    [location],
  );
  const otherPlaces = entries
    .filter((entry) => !/Electric Taberna/i.test(entry.title))
    .slice(0, 7);

  async function saveNote() {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await api("/api/records", "POST", {
        kind: "notizen",
        title: "Notiz zur Electric Taberna",
        visibility: "private",
        body: {
          text: draft.trim(),
          summary: "Mit Electric Taberna verknüpft",
          locationId: PLACE_ID,
          targetId: PLACE_ID,
          noteType: "note",
          pinned: false,
        },
      });
      setDraft("");
      toast.success("Notiz gespeichert");
      setRefresh((value) => value + 1);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function trigger(actionId: string) {
    setBusy(true);
    try {
      await api("/api/locations/actions", "POST", {
        placeId: PLACE_ID,
        actionId,
      });
      toast.success("Aktion ausgelöst");
      setRefresh((value) => value + 1);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function migrateLocation() {
    setMigrationBusy(true);
    try {
      await api("/api/locations/migrate", "POST", { placeId: PLACE_ID });
      toast.success("Electric Taberna in die Ortsdatenbank übernommen");
      setRefresh((value) => value + 1);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMigrationBusy(false);
    }
  }

  if (!location) {
    return (
      <section className="location-loading">
        <div>
          <p>{error || "Electric Taberna wird geladen …"}</p>
          {a.gm && error.includes("noch nicht") && (
            <button className="button primary" type="button" disabled={migrationBusy} onClick={migrateLocation}>
              {migrationBusy ? "Übernahme läuft …" : "Musterort einmalig übernehmen"}
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="location-layout">
      <aside className="location-nav">
        <div className="location-nav-head">
          <p className="eyebrow">ORTE</p>
          <h2>Domäne Kleve</h2>
        </div>
        <button className="location-nav-row active" type="button">
          <span>
            <MapPin size={16} />
          </span>
          <strong>Electric Taberna</strong>
          <small>{discoveryLabels[location.discovery]}</small>
        </button>
        {otherPlaces.map((entry) => (
          <button
            className="location-nav-row"
            type="button"
            key={entry.id}
            onClick={() => onOpen(entry)}
          >
            <span>
              {entry.body?.discovered === false && !a.gm ? (
                <Lock size={16} />
              ) : (
                <MapPin size={16} />
              )}
            </span>
            <strong>
              {entry.body?.discovered === false && !a.gm
                ? "Unbekannter Ort"
                : entry.title}
            </strong>
            <small>
              {entry.body?.discovered === false && !a.gm
                ? "Verborgen"
                : entry.body?.summary || "Ort öffnen"}
            </small>
          </button>
        ))}
      </aside>

      <section className="location-dossier" data-view={view}>
        <div className="location-hero">
          {safeImage(location.image) && (
            <img src={location.image} alt="Electric Taberna" />
          )}
          <div className="location-hero-shade" />
          <div className="location-hero-copy">
            <p className="eyebrow">
              <BookMarked size={14} /> ORTSDOSSIER
            </p>
            <h2>{location.title}</h2>
            <p>{location.subtitle}</p>
            <div className="location-status-row">
              <StatusBadge
                icon="discovery"
                label={discoveryLabels[location.discovery]}
                tone={location.discovery}
              />
              <StatusBadge
                icon="state"
                label={worldStateLabels[location.worldState]}
                tone={location.worldState}
              />
              {location.markers.map((marker) => (
                <StatusBadge
                  key={marker}
                  icon="marker"
                  label={markerLabels[marker]}
                  tone={marker}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="location-prose">
          <p>{location.summary}</p>
          <p>{location.atmosphere}</p>
        </div>

        <div className="location-section-heading">
          <div>
            <p className="eyebrow">RAUMSTRUKTUR</p>
            <h3>
              {location.areas.length} Bereiche · {visibleRoomCount} Räume
            </h3>
          </div>
          {projection.canSwitchToSl && (
            <div
              className="projection-switch"
              role="group"
              aria-label="Vorschau"
            >
              <button
                className={view === "sl" ? "active" : ""}
                type="button"
                onClick={() => setView("sl")}
              >
                <Shield size={16} /> SL-Sicht
              </button>
              <button
                className={view === "player" ? "active" : ""}
                type="button"
                onClick={() => setView("player")}
              >
                <Users size={16} /> Spielersicht
              </button>
            </div>
          )}
        </div>

        <div className="area-stack">
          {location.areas.map((area) => (
            <AreaBlock key={area.viewKey} area={area} />
          ))}
        </div>

        <div className="location-lower-grid">
          <section className="location-panel">
            <div className="location-panel-title">
              <FileText size={18} />
              <h3>Bekannte Informationen</h3>
            </div>
            <div className="info-list">
              {location.knownInformation.map((item) => (
                <article className="info-item" key={item.id}>
                  <span>
                    {item.pinned ? <Pin size={15} /> : <FileText size={15} />}
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="location-panel">
            <div className="location-panel-title">
              <NotebookPen size={18} />
              <h3>Notizen</h3>
            </div>
            <div className="note-composer">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={4}
                maxLength={2500}
                placeholder="Schnellnotiz zur Electric Taberna"
              />
              <button
                className="button primary"
                type="button"
                disabled={busy || !draft.trim()}
                onClick={saveNote}
              >
                <Save size={16} /> Speichern
              </button>
            </div>
            <div className="note-list">
              {notes.length ? (
                notes.map((note) => (
                  <article className="note-entry" key={note.id}>
                    <strong>{note.title}</strong>
                    <p>{String(note.body.text || "")}</p>
                  </article>
                ))
              ) : (
                <p className="muted">Noch keine verknüpften Notizen.</p>
              )}
            </div>
          </section>
        </div>
      </section>

      <aside className="location-context">
        <section className="context-map">
          <p className="eyebrow">KLEVE</p>
          <div className="mini-map" aria-label="Kompakte Karte von Kleve">
            <svg viewBox="0 0 320 220" role="img" aria-label="Kleve-Weltkarte">
              <path d="M0 54 C52 32 93 72 138 50 S230 24 320 47 V0 H0Z" />
              <path d="M0 178 C58 145 104 190 166 163 S252 142 320 168 V220 H0Z" />
              <path d="M-12 124 C48 86 96 142 146 108 S248 82 332 118" />
            </svg>
            <span className="mini-map-pin">
              <MapPin size={15} /> Electric Taberna
            </span>
          </div>
          <dl>
            <div>
              <dt>Bezirk</dt>
              <dd>{location.district}</dd>
            </div>
            <div>
              <dt>Adresse</dt>
              <dd>{location.address}</dd>
            </div>
          </dl>
        </section>

        <section className="location-panel compact">
          <div className="location-panel-title">
            <Eye size={18} />
            <h3>Fraktionen</h3>
          </div>
          {location.factionSignals.length ? (
            location.factionSignals.map((signal) => (
              <div className="faction-row" key={signal.label}>
                <span>
                  {signal.mode === "control" ? "Kontrolle" : "Beobachtung"}
                </span>
                <strong>{signal.label}</strong>
              </div>
            ))
          ) : (
            <p className="muted">Keine freigegebenen Fraktionsdaten.</p>
          )}
        </section>

        {projection.view === "sl" && location.preparedActions && (
          <section className="location-panel compact">
            <div className="location-panel-title">
              <Radio size={18} />
              <h3>SL-Steuerpult</h3>
            </div>
            <div className="action-list">
              {location.preparedActions.map((action) => (
                <article className="prepared-action" key={action.id}>
                  <div>
                    <strong>{action.label}</strong>
                    <small>→ {action.target}</small>
                  </div>
                  <StatusBadge
                    icon="action"
                    label={actionLabels[action.status]}
                    tone={action.status}
                  />
                  <button
                    className="button"
                    type="button"
                    disabled={busy || action.status === "triggered"}
                    onClick={() => trigger(action.id)}
                  >
                    <BellRing size={15} /> Auslösen
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="location-panel compact">
          <div className="location-panel-title">
            <Activity size={18} />
            <h3>Meine Aktivität</h3>
          </div>
          <div className="activity-list">
            {location.activity.map((item) => (
              <article className="activity-row" key={item.id}>
                <span>{item.time}</span>
                <strong>{item.label}</strong>
                <small>{item.targetLabel}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="location-panel compact">
          <div className="location-panel-title">
            {projection.view === "sl" ? <Eye size={18} /> : <EyeOff size={18} />}
            <h3>{projection.view === "sl" ? "Arbeitsmodus" : "Projektion"}</h3>
          </div>
          <p className="muted">
            {projection.view === "sl"
              ? "Alle Bereiche und vorbereiteten Aktionen sind sichtbar."
              : "Diese Ansicht enthält nur freigegebene Ortsdaten."}
          </p>
          <p className="source-line">{location.sourceLabel}</p>
        </section>
      </aside>
    </div>
  );
}

function AreaBlock({ area }: { area: ProjectedArea }) {
  return (
    <section className={area.redacted ? "area-block redacted" : "area-block"}>
      <div className="area-header">
        <span className="area-index">{String(area.order).padStart(2, "0")}</span>
        <div>
          <h4>{area.title}</h4>
          {area.playerHint && <p>{area.playerHint}</p>}
        </div>
        <div className="area-states">
          <StatusBadge
            icon="discovery"
            label={discoveryLabels[area.discovery]}
            tone={area.discovery}
          />
          <StatusBadge
            icon="state"
            label={worldStateLabels[area.worldState]}
            tone={area.worldState}
          />
        </div>
      </div>
      {area.rooms.length ? (
        <div className="room-grid">
          {area.rooms.map((room) => (
            <article className="room-tile" key={room.viewKey}>
              <span>{String(room.order).padStart(2, "0")}</span>
              <strong>{room.title.replace(/^\d+\s/, "")}</strong>
              <div>
                <StatusBadge
                  icon="discovery"
                  label={discoveryLabels[room.discovery]}
                  tone={room.discovery}
                />
                <StatusBadge
                  icon="state"
                  label={worldStateLabels[room.worldState]}
                  tone={room.worldState}
                />
              </div>
              {!!room.markers.length && (
                <small>
                  {room.markers
                    .map((marker) => markerLabels[marker])
                    .join(" · ")}
                </small>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="redacted-area">
          <Lock size={18} />
          <span>Mögliche weitere Zone, keine freigegebenen Raumdaten.</span>
        </div>
      )}
    </section>
  );
}

function StatusBadge({
  icon,
  label,
  tone,
}: {
  icon: "discovery" | "state" | "marker" | "action";
  label: string;
  tone: string;
}) {
  const Icon =
    icon === "discovery"
      ? Sparkles
      : icon === "state"
        ? CircleAlert
        : icon === "action"
          ? Radio
          : Shield;
  return (
    <span className={`status-badge tone-${tone}`}>
      <Icon size={14} />
      {label}
    </span>
  );
}
