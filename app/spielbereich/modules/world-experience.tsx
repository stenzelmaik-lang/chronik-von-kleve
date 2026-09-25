/* eslint-disable @next/next/no-img-element -- The campaign location image is served from the existing authenticated Site asset path. */
"use client";

import type { PlaceProjection } from "@/domain/location-types";
import type { Actor } from "@/domain/types";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  Eye,
  FileText,
  Image as ImageIcon,
  MapPin,
  Maximize2,
  NotebookPen,
  Search,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { type ComponentType, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { Entry } from "@/domain/legacy";

import { api } from "./api-client";
import { mapMarkerFor, playerMapPlaces, type WorldMapMarker } from "./world-map-contract";
import {
  describeDataError,
  invalidatePlayerData,
  readPlayerData,
  requestPlayerData,
} from "./player-data-cache";
import styles from "./world-experience.module.css";

const PLACE_ID = "place.electric-taberna";
const LOCATION_KEY = "/api/locations?place=place.electric-taberna";
const NOTES_KEY = "/api/records?kind=notizen";

type Payload = { projection: PlaceProjection; mapMarker?: WorldMapMarker };
type NotesPayload = { records: Entry[] };
type LocationState = { key: string; projection: PlaceProjection; mapMarker?: WorldMapMarker };
type NoteState = { scope: string; records: Entry[] };
type WorldOverlay = { kind: "image" } | { kind: "clue"; title: string; text: string } | null;
type WorldMapViewProps = {
  places: WorldMapMarker[];
  visibleIds: string[];
  selectedId: string;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onFocusPlace: (id: string) => void;
  onStateChange: (state: "loading" | "ready" | "error") => void;
};

function locationKey(view: "player" | "sl", target: "group" | "player") {
  return `${LOCATION_KEY}&view=${view}&target=${target}`;
}

export function WorldExperience({
  a,
  dataScope,
}: {
  a: Actor;
  dataScope: string;
}) {
  const [view, setView] = useState<"player" | "sl">("player");
  const target = a.gm ? "group" : "player";
  const projectionKey = locationKey(view, target);
  const safeMapKey = locationKey("player", target);
  const scopedSafeMapKey = `${dataScope}\u0000${safeMapKey}`;
  const scopedProjectionKey = `${dataScope}\u0000${projectionKey}`;
  const [result, setResult] = useState<LocationState | null>(null);
  const [safeMapResult, setSafeMapResult] = useState<LocationState | null>(null);
  const [requestError, setRequestError] = useState<{ key: string; message: string } | null>(null);
  const [selectedId, setSelectedId] = useState(PLACE_ID);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(false);
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<WorldOverlay>(null);
  const [noteState, setNoteState] = useState<NoteState | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const [WorldMapView, setWorldMapView] = useState<ComponentType<WorldMapViewProps> | null>(null);
  const imageDialog = useRef<HTMLDialogElement>(null);
  const clueDialog = useRef<HTMLDialogElement>(null);
  const lastOverlayTrigger = useRef<HTMLButtonElement | null>(null);
  const returnScrollY = useRef(0);

  const cached = readPlayerData<Payload>(dataScope, projectionKey);
  const cachedSafeMap = readPlayerData<Payload>(dataScope, safeMapKey);
  useEffect(() => {
    let alive = true;
    const initial = readPlayerData<Payload>(dataScope, projectionKey);
    requestPlayerData(dataScope, projectionKey, () => api<Payload>(projectionKey), {
      force: Boolean(initial && !initial.fresh),
    })
      .then((payload) => {
        if (alive) {
          setResult({ key: scopedProjectionKey, projection: payload.projection, mapMarker: payload.mapMarker });
          setRequestError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!alive) return;
        const issue = describeDataError(reason);
        setRequestError({ key: scopedProjectionKey, message: issue.detail });
        if (issue.permission) setResult(null);
      });
    return () => {
      alive = false;
    };
  }, [dataScope, projectionKey, scopedProjectionKey]);

  useEffect(() => {
    if (!a.gm || view !== "sl") return;
    let alive = true;
    const cachedPlayerProjection = readPlayerData<Payload>(dataScope, safeMapKey);
    requestPlayerData(dataScope, safeMapKey, () => api<Payload>(safeMapKey), {
      force: Boolean(cachedPlayerProjection && !cachedPlayerProjection.fresh),
    })
      .then((payload) => {
        if (alive) setSafeMapResult({ key: scopedSafeMapKey, projection: payload.projection, mapMarker: payload.mapMarker });
      })
      .catch(() => {
        if (alive) setSafeMapResult(null);
      });
    return () => {
      alive = false;
    };
  }, [a.gm, dataScope, safeMapKey, scopedSafeMapKey, view]);

  useEffect(() => {
    const syncLocation = () => {
      const url = new URL(window.location.href);
      const isDetail = url.searchParams.has("ort");
      setDetail(isDetail);
      if (!isDetail) setMapStatus("loading");
      if (!isDetail) requestAnimationFrame(() => window.scrollTo(0, returnScrollY.current));
    };
    syncLocation();
    window.addEventListener("popstate", syncLocation);
    return () => window.removeEventListener("popstate", syncLocation);
  }, []);

  useEffect(() => {
    if (detail || new URLSearchParams(window.location.search).has("ort")) return;
    let alive = true;
    import("./world-maplibre")
      .then(({ WorldMapLibre }) => {
        if (alive) setWorldMapView(() => WorldMapLibre);
      })
      .catch(() => {
        if (alive) setMapStatus("error");
      });
    return () => { alive = false; };
  }, [detail]);

  const projection = result?.key === scopedProjectionKey ? result.projection : cached?.value.projection ?? null;
  const error = requestError?.key === scopedProjectionKey ? requestError.message : "";
  const loading = !projection && !error;
  const location = projection?.location;
  const places = useMemo(() => location ? [location] : [], [location]);
  const playerMapProjection = projection?.view === "player"
    ? projection
    : safeMapResult?.key === scopedSafeMapKey ? safeMapResult.projection : null;
  const safeMapLocation = playerMapProjection?.location ?? null;
  const safeMapPlaces = useMemo(() => playerMapPlaces(playerMapProjection), [playerMapProjection]);
  const playerMapMarker = projection?.view === "player"
    ? result?.key === scopedProjectionKey
      ? result.mapMarker
      : cached?.fresh ? cached.value.mapMarker : null
    : safeMapResult?.key === scopedSafeMapKey
      ? safeMapResult.mapMarker
      : cachedSafeMap?.fresh ? cachedSafeMap.value.mapMarker : null;
  const mapMarkers = useMemo(() => safeMapPlaces.flatMap((place) => {
    const marker = mapMarkerFor(place, playerMapMarker);
    return marker ? [{ ...place, ...marker }] : [];
  }), [playerMapMarker, safeMapPlaces]);
  const matchingMapPlaces = useMemo(() => {
    if (!safeMapLocation || !safeMapPlaces.some((place) => place.id === safeMapLocation.id)) return [];
    const needle = query.trim().toLocaleLowerCase("de-DE");
    const matches = `${safeMapLocation.title} ${safeMapLocation.district} ${safeMapLocation.summary} ${safeMapLocation.address}`.toLocaleLowerCase("de-DE");
    return !needle || matches.includes(needle) ? safeMapPlaces : [];
  }, [query, safeMapLocation, safeMapPlaces]);
  const visibleMapIds = useMemo(() => matchingMapPlaces.map((place) => place.id), [matchingMapPlaces]);
  const mapPreviewPlace = matchingMapPlaces.length > 0 ? safeMapLocation : null;
  const matchingPlaces = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("de-DE");
    return places.filter((place) =>
      !needle || `${place.title} ${place.district} ${place.summary}`.toLocaleLowerCase("de-DE").includes(needle),
    );
  }, [places, query]);
  const selected = matchingPlaces.find((place) => place.id === selectedId) ?? matchingPlaces[0] ?? null;
  const areaList = useMemo(() => location?.areas ?? [], [location]);
  const currentArea = areaList.find((area) => area.viewKey === activeArea) ?? areaList[0] ?? null;
  const cachedNotes = readPlayerData<NotesPayload>(dataScope, NOTES_KEY);
  const notes = noteState?.scope === dataScope ? noteState.records : cachedNotes?.value.records ?? [];
  const relatedNotes = notes.filter((note) => note.body?.locationId === PLACE_ID);
  const unresolvedArea = areaList.find((area) => area.redacted && area.playerHint);

  useEffect(() => {
    if (!detail) return;
    const cachedNotes = readPlayerData<NotesPayload>(dataScope, NOTES_KEY);
    requestPlayerData(dataScope, NOTES_KEY, () => api<NotesPayload>(NOTES_KEY), {
      force: Boolean(cachedNotes && !cachedNotes.fresh),
    }).then((payload) => setNoteState({ scope: dataScope, records: payload.records })).catch(() => {
      setNoteState({ scope: dataScope, records: [] });
    });
  }, [dataScope, detail]);

  useEffect(() => {
    if (!overlay) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [overlay]);

  useEffect(() => {
    if (overlay?.kind === "image") {
      imageDialog.current?.showModal();
    } else {
      imageDialog.current?.close();
    }
    if (overlay?.kind === "clue") {
      clueDialog.current?.showModal();
    } else {
      clueDialog.current?.close();
    }
  }, [overlay]);

  function openPlace(id: string) {
    returnScrollY.current = window.scrollY;
    setSelectedId(id);
    setDetail(true);
    const url = new URL(window.location.href);
    url.pathname = "/spielbereich";
    url.searchParams.set("bereich", "schauplaetze");
    url.searchParams.set("ort", id);
    history.pushState(null, "", url);
    window.scrollTo(0, 0);
  }

  function returnToMap() {
    setDetail(false);
    setMapStatus("loading");
    setOverlay(null);
    const url = new URL(window.location.href);
    url.searchParams.set("bereich", "schauplaetze");
    url.searchParams.delete("ort");
    history.replaceState(null, "", url);
    requestAnimationFrame(() => window.scrollTo(0, returnScrollY.current));
  }

  async function saveNote() {
    const text = noteDraft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await api("/api/records", "POST", {
        kind: "notizen",
        title: "Notiz zur Electric Taberna",
        visibility: "private",
        body: {
          text,
          summary: "Mit Electric Taberna verknüpft",
          locationId: PLACE_ID,
          targetId: PLACE_ID,
          noteType: "note",
          pinned: false,
        },
      });
      setNoteDraft("");
      invalidatePlayerData(dataScope, NOTES_KEY);
      const refreshed = await requestPlayerData(dataScope, NOTES_KEY, () => api<NotesPayload>(NOTES_KEY), { force: true });
      setNoteState({ scope: dataScope, records: refreshed.records });
      toast.success("Private Notiz gespeichert");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Die Notiz konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function triggerAction(actionId: string) {
    if (!a.gm || view !== "sl" || busy) return;
    setBusy(true);
    try {
      await api("/api/locations/actions", "POST", { placeId: PLACE_ID, actionId });
      invalidatePlayerData(dataScope, projectionKey);
      const updated = await requestPlayerData(dataScope, projectionKey, () => api<Payload>(projectionKey), { force: true });
      setResult({ key: projectionKey, projection: updated.projection });
      toast.success("SL-Aktion aktualisiert");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Die Aktion konnte nicht aktualisiert werden.");
    } finally {
      setBusy(false);
    }
  }

  function closeOverlay() {
    setOverlay(null);
    requestAnimationFrame(() => {
      lastOverlayTrigger.current?.focus();
    });
  }

  if (!loading && error && !projection) {
    return <section className={styles.statePanel} data-world-experience="world" role="alert">
      <span className={styles.stateIcon}><Shield size={19} /></span>
      <div><p className={styles.kicker}>SPIELWELT · ZUGRIFF</p><h1>Der Ort ist gerade nicht verfügbar.</h1><p>{error}</p></div>
      <button className={styles.secondaryButton} onClick={() => window.location.reload()} type="button">Erneut versuchen</button>
    </section>;
  }

  if (!projection || !location) {
    return <div className={styles.worldRoot} data-world-experience="world" aria-busy="true">
      <header className={styles.worldIntro}><div><p className={styles.kicker}>DOMÄNE KLEVE · NACHTATLAS</p><h1>Spielwelt</h1></div><div className={styles.introMeta}>Die bekannten Orte deiner Chronik</div></header>
      <div className={`${styles.mapStage} ${styles.mapLoading}`} aria-label="Stadtkarte wird geladen"><div className={styles.mapImage} /><span className={styles.loadingMark}><Compass size={17} /> Kartendaten werden geladen</span></div>
      <div className={styles.loadingLine} role="status">Freigegebene Ortsdaten werden geladen …</div>
    </div>;
  }

  return <div className={`${styles.worldRoot} ${detail ? styles.detailMode : ""}`} data-world-experience="world">
    <header className={styles.worldIntro}>
      <div className={styles.worldIntroTitle}>
        <p className={styles.kicker}>DOMÄNE KLEVE <span>·</span> NACHTATLAS</p>
        <h1>{detail ? "Ortsdossier" : "Die Stadt bei Nacht"}</h1>
      </div>
      <div className={styles.introRight}>
        <p>{detail ? "Ein Ort, wie dein Charakter ihn kennt." : "Orte, die deinem Charakter bekannt sind."}</p>
        {a.gm && <div className={styles.viewSwitch} aria-label="Ansicht wählen">
          <button type="button" className={view === "player" ? styles.switchActive : ""} onClick={() => setView("player")}><Eye size={14} />Spieler</button>
          <button type="button" className={view === "sl" ? styles.switchActive : ""} onClick={() => setView("sl")}><Shield size={14} />SL</button>
        </div>}
        {a.gm && view === "player" && <span className={styles.previewBadge}><Eye size={13} />Gruppenprojektion</span>}
      </div>
    </header>

    {!detail ? <>
      <section className={styles.mapSection} aria-label="Bekannte Orte auf der Chronikkarte">
        <div className={styles.mapHeading}>
          <div className={styles.mapTitle}><span className={styles.mapMark}><Compass size={16} /></span><div><strong>Kleve</strong><span>Persönlicher Nachtatlas</span></div></div>
          <span className={styles.mapCaption}>{mapStatus === "ready" ? "ECHTE KARTE · CHRONIK-ORTE" : "SCHEMATISCHE VORSCHAU"}</span>
          <label className={styles.searchBox}><Search size={16} aria-hidden="true" /><span className={styles.srOnly}>Bekannte Orte suchen</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Bekannte Orte suchen" /></label>
        </div>
        <div className={styles.mapStage} data-map-state={mapStatus}>
          <div className={styles.mapImage} role="img" aria-label="Abstrahierte Stadtstruktur mit Straßen, offener Fläche und Grünzone. Keine geografische Navigationskarte." />
          <div className={styles.mapVignette} aria-hidden="true" />
          {WorldMapView && <WorldMapView
            places={mapMarkers}
            visibleIds={visibleMapIds}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={setSelectedId}
            onHover={setHoveredId}
            onFocusPlace={setSelectedId}
            onStateChange={setMapStatus}
          />}
          {mapStatus !== "ready" && <span className={styles.mapStatus} role="status">
            {mapStatus === "error"
              ? "Die echte Karte ist nicht erreichbar. Die schematische Chronikkarte bleibt nutzbar."
              : "OpenFreeMap wird geladen. Die schematische Chronikkarte bleibt eingeblendet."}
          </span>}
          <div className={styles.mapCoordinates} aria-hidden="true"><span>DOMÄNE · KLEVE</span><span>NACHTATLAS · ILLUSTRATION</span><span>SCHEMATISCH · NICHT NAVIGIERBAR</span></div>
          <div className={styles.mapLegend}><span className={styles.legendDot} />Bekannter Ort</div>
          {mapStatus !== "ready" && matchingMapPlaces.map((place) => {
            const current = selected?.id === place.id;
            const hot = hoveredId === place.id;
            return <button
              className={`${styles.placeMarker} ${current ? styles.markerSelected : ""} ${hot ? styles.markerHot : ""}`}
              key={place.id}
              style={{ left: "54.2%", top: "46.5%" }}
              type="button"
              aria-label={`${place.title}, bekannter Ort. Vorschau anzeigen.`}
              aria-pressed={current}
              onMouseEnter={() => { setHoveredId(place.id); setSelectedId(place.id); }}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => { setHoveredId(place.id); setSelectedId(place.id); }}
              onBlur={() => setHoveredId(null)}
              onClick={() => setSelectedId(place.id)}
            >
              <span className={styles.markerHalo} aria-hidden="true" /><span className={styles.markerCore} aria-hidden="true" /><span className={styles.markerLabel}>{place.title}</span>
            </button>;
          })}
          {mapPreviewPlace && <aside className={styles.mapPreview} aria-live="polite">
            <div className={styles.previewImage}><img src={mapPreviewPlace.image} alt="" loading="lazy" /></div>
            <div className={styles.previewBody}><div className={styles.previewTopline}><span className={styles.statePip} />{discoveryLabel(mapPreviewPlace.discovery)} <span className={styles.previewDistrict}>{mapPreviewPlace.district}</span></div><h2>{mapPreviewPlace.title}</h2><p>{mapPreviewPlace.summary}</p><button type="button" className={styles.textAction} onClick={() => openPlace(mapPreviewPlace.id)}>Ort öffnen <ArrowRight size={15} /></button></div>
          </aside>}
          {matchingMapPlaces.length === 0 && safeMapPlaces.length > 0 && <div className={styles.noSearchResult}><Search size={17} /><span>Keine bekannten Orte passen zu deiner Suche.</span><button type="button" onClick={() => setQuery("")}>Suche zurücksetzen</button></div>}
          {mapStatus !== "ready" && <span className={styles.mapScale} aria-hidden="true"><i /><small>STADTPLAN · ILLUSTRATION</small></span>}
        </div>
      </section>

      <section className={styles.placeSection} aria-labelledby="place-list-title">
        <header className={styles.sectionHeading}><div><p className={styles.kicker}>ORTE, DIE DIR BEKANNT SIND</p><h2 id="place-list-title">Ein Ort im Gedächtnis.</h2></div><p>Was dein Charakter weiß, bleibt sichtbar.<br />Was er nicht kennt, erscheint hier nicht.</p></header>
        <div className={styles.placeGrid}>
          {matchingPlaces.map((place) => <button
            type="button"
            className={`${styles.placeCard} ${selected?.id === place.id || hoveredId === place.id ? styles.placeCardActive : ""}`}
            aria-label={`${place.title} öffnen`}
            key={place.id}
            onMouseEnter={() => { setHoveredId(place.id); setSelectedId(place.id); }}
            onMouseLeave={() => setHoveredId(null)}
            onFocus={() => { setHoveredId(place.id); setSelectedId(place.id); }}
            onBlur={() => setHoveredId(null)}
            onClick={() => openPlace(place.id)}
          >
            <span className={styles.cardImage}><img src={place.image} alt="" loading="lazy" /><span className={styles.cardShade} /><span className={styles.cardStatus}><span className={styles.statePip} />{discoveryLabel(place.discovery)}</span><span className={styles.cardArrow}><ArrowUpRight size={18} /></span></span>
            <span className={styles.cardCopy}><span className={styles.cardOverline}>{place.district} <i>·</i> NACHTORT</span><strong>{place.title}</strong><span className={styles.cardSubtitle}>{place.subtitle}</span><span className={styles.cardSummary}>{place.summary}</span></span>
          </button>)}
          {matchingPlaces.length === 1 && location?.knownInformation[0] && <aside className={styles.placeAside}>
            <p className={styles.kicker}>FREIGEGEBENE ERKENNTNIS</p><h3>{location.knownInformation[0].title}</h3><p>{location.knownInformation[0].text}</p><span><Sparkles size={14} />Electric Taberna <i>·</i> {location.district}</span>
          </aside>}
          {matchingPlaces.length === 0 && <p className={styles.emptySearch}>Keine bekannten Orte passen zu deiner Suche.</p>}
        </div>
      </section>
    </> : <>
      <article className={styles.locationPage} aria-labelledby="location-title">
        <section className={styles.locationHero}>
          <img className={styles.locationHeroImage} src={location.image} alt="Außenansicht der Electric Taberna bei Nacht" fetchPriority="high" />
          <div className={styles.heroVeil} />
          <div className={styles.heroTopline}><button type="button" className={styles.backLink} onClick={returnToMap}><ArrowLeft size={16} />Zur Karte</button><span className={styles.heroLocation}><MapPin size={14} />{location.district}, Kleve</span></div>
          <div className={styles.heroContent}><div><p className={styles.kicker}>{location.subtitle} <span>·</span> {discoveryLabel(location.discovery).toUpperCase()}</p><h1 id="location-title">{location.title}</h1><p className={styles.heroSummary}>{location.summary}</p><div className={styles.heroActions}><button type="button" className={styles.primaryAction} onClick={() => { setActiveArea(areaList[0]?.viewKey ?? null); document.getElementById("known-areas")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><Compass size={16} />Bekannte Bereiche <ArrowDownRight size={15} /></button><button type="button" className={styles.imageAction} onClick={(event) => { lastOverlayTrigger.current = event.currentTarget; setOverlay({ kind: "image" }); }}><Maximize2 size={15} />Bild ansehen</button></div></div><div className={styles.heroAside}><span className={styles.statePip} />{discoveryLabel(location.discovery)}<small>{stateLabel(location.worldState)}</small></div></div>
          <span className={styles.heroIndex} aria-hidden="true">01 <i>/</i> ORT</span>
        </section>

        <section className={styles.locationContent}>
          <div className={styles.locationMain}>
            <section className={styles.impression}>
              <div className={styles.proseEyebrow}><span>01</span><p className={styles.kicker}>DEIN EINDRUCK</p></div>
              <div><h2>Neon über der Innenstadt.</h2><p>{location.atmosphere}</p><span className={styles.sourceContext}><Sparkles size={14} />Freigegebener Eindruck · {location.district}</span></div>
            </section>

            <section className={styles.areasSection} id="known-areas" aria-labelledby="areas-title">
              <header className={styles.detailSectionHeader}><div><p className={styles.kicker}>WAS DU HIER KENNST</p><h2 id="areas-title">Bekannte Bereiche</h2></div><span className={styles.sectionCounter}>{String(areaList.length).padStart(2, "0")} <small>Einträge deiner Projektion</small></span></header>
              <div className={styles.areaLayout}>
                <div className={styles.areaList} role="tablist" aria-label="Bekannte Bereiche">
                  {areaList.map((area, index) => <button className={`${styles.areaTab} ${currentArea?.viewKey === area.viewKey ? styles.areaTabActive : ""} ${area.redacted ? styles.areaTabUnclear : ""}`} key={area.viewKey} type="button" role="tab" aria-selected={currentArea?.viewKey === area.viewKey} aria-controls={`area-detail-${index}`} id={`area-tab-${index}`} onClick={() => setActiveArea(area.viewKey)}>
                    <span className={styles.areaNumber}>{String(index + 1).padStart(2, "0")}</span><span className={styles.areaTabCopy}><strong>{area.redacted ? "Ungeklärt" : area.title}</strong><small>{area.redacted ? "Hinweis vorhanden" : `${area.rooms.length} bekannte Räume`}</small></span>{area.redacted ? <CircleHelp size={16} /> : <ArrowRight size={15} />}
                  </button>)}
                  {!areaList.length && <p className={styles.mutedText}>Für diesen Ort sind noch keine Bereiche freigegeben.</p>}
                </div>
                {currentArea && <section className={`${styles.areaDetail} ${currentArea.redacted ? styles.unclearDetail : ""}`} role="tabpanel" id={`area-detail-${areaList.indexOf(currentArea)}`} aria-labelledby={`area-tab-${areaList.indexOf(currentArea)}`}>
                  <div className={styles.areaDetailHeader}><span className={styles.detailOverline}>{currentArea.redacted ? "HINWEIS · NICHT ERSCHLOSSEN" : `BEREICH ${String(currentArea.order).padStart(2, "0")}`}</span><span className={styles.discoveryTag}>{currentArea.redacted ? "Ungeklärt" : discoveryLabel(currentArea.discovery)}</span></div>
                  <h3>{currentArea.redacted ? "Ein Hinweis bleibt offen." : currentArea.title}</h3>
                  {currentArea.redacted && currentArea.playerHint ? <p className={styles.areaHint}>{currentArea.playerHint}</p> : <p className={styles.areaContext}>{currentArea.worldState === "active" ? "Bekannter Bereich der Electric Taberna." : stateLabel(currentArea.worldState)}</p>}
                  {currentArea.rooms.length > 0 && <div className={styles.roomList}>{currentArea.rooms.map((room) => <article className={styles.roomRow} key={room.viewKey}><span className={styles.roomOrder}>{String(room.order).padStart(2, "0")}</span><div><strong>{room.title.replace(/^\d+\s/, "")}</strong>{room.short && <p>{room.short}</p>}</div><span className={styles.roomStatus}>{discoveryLabel(room.discovery)}</span></article>)}</div>}
                  {!currentArea.redacted && currentArea.rooms.length === 0 && <p className={styles.mutedText}>Zu diesem Bereich sind keine Räume freigegeben.</p>}
                  {currentArea.redacted && <div className={styles.unclearSeal}><CircleHelp size={15} />Keine Raumdetails freigegeben</div>}
                </section>}
              </div>
            </section>

            {unresolvedArea?.playerHint && <button type="button" className={styles.clueCard} aria-label="Hinweis öffnen: Hinter dem Gästebereich" onClick={(event) => { lastOverlayTrigger.current = event.currentTarget; setOverlay({ kind: "clue", title: "Hinter dem Gästebereich", text: unresolvedArea.playerHint! }); }}>
              <span className={styles.clueGlyph}><CircleHelp size={20} /></span><span className={styles.clueCopy}><span className={styles.kicker}>OFFENER HINWEIS · UNGEKLÄRT</span><strong>Hinter dem Gästebereich</strong><span>{unresolvedArea.playerHint}</span></span><ArrowUpRight className={styles.clueArrow} size={17} />
            </button>}

            {location.knownInformation.length > 0 && <section className={styles.informationSection}>
              <header className={styles.detailSectionHeader}><div><p className={styles.kicker}>FREIGEGEBENE ERKENNTNISSE</p><h2>Was hängen blieb</h2></div><BookOpen size={19} /></header>
              <div className={styles.informationList}>{location.knownInformation.map((info) => <button type="button" className={styles.informationRow} key={info.id} onClick={(event) => { lastOverlayTrigger.current = event.currentTarget; setOverlay({ kind: "clue", title: info.title, text: info.text }); }}><span><Sparkles size={15} /></span><span><strong>{info.title}</strong><small>{info.text}</small></span><ArrowUpRight size={15} /></button>)}</div>
            </section>}

            {projection.view === "sl" && projection.location.preparedActions && <section className={styles.gmActions}>
              <header className={styles.detailSectionHeader}><div><p className={styles.kicker}>NUR FÜR DIE SPIELLEITUNG</p><h2>Vorbereitete Aktionen</h2></div><Shield size={18} /></header>
              {projection.location.preparedActions.map((action) => <div className={styles.gmActionRow} key={action.id}><span><strong>{action.label}</strong><small>{action.target}</small></span><button type="button" className={styles.secondaryButton} disabled={busy || action.status === "triggered"} onClick={() => triggerAction(action.id)}>{action.status === "triggered" ? "Ausgelöst" : "Auslösen"}</button></div>)}
            </section>}
          </div>

          <aside className={styles.locationAside}>
            <button type="button" className={styles.photoCard} onClick={(event) => { lastOverlayTrigger.current = event.currentTarget; setOverlay({ kind: "image" }); }}><span className={styles.photoImage}><img src={location.image} alt="" loading="lazy" /><span><ImageIcon size={15} />Bild öffnen</span></span><span className={styles.photoCaption}>ELECTRIC TABERNA <i>·</i> KLEVE</span></button>
            <section className={styles.factCard}><p className={styles.kicker}>EINORDNUNG</p><div className={styles.factRow}><span>Gebiet</span><strong>{location.district}</strong></div><div className={styles.factRow}><span>Adresse</span><strong>{location.address}</strong></div><div className={styles.factRow}><span>Ortszustand</span><strong>{stateLabel(location.worldState)}</strong></div></section>
            <section className={styles.knownNote}><span><FileText size={16} /></span><div><p className={styles.kicker}>BEKANNTE ATMOSPHÄRE</p><p>{location.knownInformation.find((info) => info.title === "Atmosphäre")?.text ?? location.summary}</p></div></section>
            <section className={styles.notesSection}><header><span><NotebookPen size={16} />Deine Notizen</span><small>privat</small></header><label className={styles.srOnly} htmlFor="world-note">Private Notiz zu Electric Taberna</label><textarea id="world-note" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Ein Gedanke, den nur du siehst …" rows={3} maxLength={2500} /><button type="button" className={styles.noteSave} disabled={busy || !noteDraft.trim()} onClick={saveNote}>{busy ? "Speichert …" : "Private Notiz sichern"}<ArrowRight size={14} /></button><div className={styles.savedNotes}>{relatedNotes.length ? relatedNotes.slice(0, 3).map((note) => <article key={note.id}><Check size={13} /><div><strong>{note.title}</strong><p>{String(note.body.text ?? "")}</p></div></article>) : <p>Noch keine eigenen Ortsnotizen.</p>}</div></section>
          </aside>
        </section>

        <footer className={styles.locationFooter}><span>ORTSDOSSIER <i>·</i> {location.title}</span><button type="button" onClick={returnToMap}><ArrowLeft size={15} />Zurück zur Chronikkarte</button></footer>
      </article>
    </>}

    <dialog ref={imageDialog} className={`${styles.overlay} ${styles.imageOverlay}`} aria-label={`Bildansicht: ${location.title}`} onClose={closeOverlay} onClick={(event) => { if (event.target === imageDialog.current) imageDialog.current?.close(); }}>
      <div className={styles.overlayFrame}><div className={styles.overlayTop}><span><ImageIcon size={15} />{location.title} <i>·</i> {location.district}</span><button type="button" aria-label="Bildansicht schließen" onClick={() => imageDialog.current?.close()}><X size={19} /></button></div><img src={location.image} alt="Außenansicht der Electric Taberna bei Nacht" /><p>Vorhandenes Ortsbild · {location.title}</p></div>
    </dialog>

    <dialog ref={clueDialog} className={`${styles.overlay} ${styles.clueOverlay}`} aria-label={overlay?.kind === "clue" ? overlay.title : "Freigegebener Hinweis"} onClose={closeOverlay} onClick={(event) => { if (event.target === clueDialog.current) clueDialog.current?.close(); }}>
      <div className={styles.clueDialogFrame}><div className={styles.overlayTop}><span><CircleHelp size={16} />{overlay?.kind === "clue" && overlay.title === "Hinter dem Gästebereich" ? "HINWEIS · DEINE CHRONIK" : "ERKENNTNIS · DEINE CHRONIK"}</span><button type="button" aria-label="Hinweis schließen" onClick={() => clueDialog.current?.close()}><X size={19} /></button></div><p className={styles.kicker}>{overlay?.kind === "clue" && overlay.title === "Hinter dem Gästebereich" ? "UNGEKLÄRT" : "FREIGEGEBEN"}</p><h2>{overlay?.kind === "clue" ? overlay.title : "Hinweis"}</h2><p>{overlay?.kind === "clue" ? overlay.text : ""}</p><div className={styles.clueFooter}><span><Sparkles size={14} />Nur freigegebener Inhalt</span><span>Electric Taberna <ChevronDown size={14} /></span></div></div>
    </dialog>
  </div>;
}

function discoveryLabel(value: string) {
  const labels: Record<string, string> = { hidden: "Verborgen", rumored: "Gerücht", known: "Bekannt", visited: "Besucht", investigated: "Untersucht" };
  return labels[value] ?? "Bekannt";
}

function stateLabel(value: string) {
  const labels: Record<string, string> = { active: "Aktiv", changed: "Verändert", inaccessible: "Nicht zugänglich", destroyed: "Zerstört", abandoned: "Verlassen" };
  return labels[value] ?? "Unbekannt";
}
