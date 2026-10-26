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
  RotateCcw,
  NotebookPen,
  Search,
  Shield,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { type ComponentType, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { Entry } from "@/domain/legacy";
import { splitRichTextIntroduction } from "@/domain/location-rich-text";

import { api } from "./api-client";
import { LocationMediaGallery } from "./location-media-gallery";
import { LocationKnowledgeSearch } from "./location-knowledge-search";
import { LocationConnections } from "./location-connections";
import { RichTextView, richTextToPlainText } from "./rich-text";
import { LocationSLDossier } from "./location-sl-dossier";
import { activeMapMarkersForPlace, visibleWorldPlaces, type WorldHubPlace, type WorldMapMarker } from "./world-map-contract";
import {
  describeDataError,
  invalidatePlayerData,
  readPlayerData,
  requestPlayerData,
} from "./player-data-cache";
import styles from "./world-experience.module.css";

const NOTES_KEY = "/api/records?kind=notizen";
const EMPTY_PLACES: WorldHubPlace[] = [];

type Payload = { projection: PlaceProjection; mapMarker?: WorldMapMarker };
type HubPayload = { places: WorldHubPlace[] };
type NotesPayload = { records: Entry[] };
type LocationState = { key: string; projection: PlaceProjection };
type HubState = { key: string; places: WorldHubPlace[] };
type NoteState = { scope: string; records: Entry[] };
type WorldOverlay = { kind: "image"; src: string; title: string } | { kind: "clue"; title: string; text: string; media?:import("@/domain/location-library").PublicLocationMedia[] } | null;
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

function hubKey(view: "player" | "sl", target: "group" | "player") {
  return `/api/locations?view=${view}&target=${target}`;
}

function locationKey(id: string, view: "player" | "sl", target: "group" | "player") {
  return `/api/locations?place=${encodeURIComponent(id)}&view=${view}&target=${target}`;
}

export function WorldExperience({
  a,
  dataScope,
  projectionOverride,
  embeddedLabel,
  onDossierBack,
  previewViewerId,
}: {
  a: Actor;
  dataScope: string;
  /** Supplying this projection renders the real dossier in a CMS preview without loading a second layout. */
  projectionOverride?: PlaceProjection | null;
  embeddedLabel?: string;
  onDossierBack?: () => void;
  previewViewerId?:string;
}) {
  const embeddedDossier = projectionOverride !== undefined;
  const [view, setView] = useState<"player" | "sl">(a.gm ? "sl" : "player");
  const target = a.gm ? "group" : "player";
  const activeHubKey = hubKey(view, target);
  const scopedHubKey = `${dataScope}\u0000${activeHubKey}`;
  const [result, setResult] = useState<LocationState | null>(null);
  const [hubResult, setHubResult] = useState<HubState | null>(null);
  const [requestError, setRequestError] = useState<{ key: string; message: string } | null>(null);
  const [hubError, setHubError] = useState<{ key: string; message: string } | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(false);
  const [activeArea, setActiveArea] = useState<string | null>(null);
  const [areaContext, setAreaContext] = useState<{ placeId: string; order: number } | null>(null);
  const [activeDossierId, setActiveDossierId] = useState("");
  const [overlay, setOverlay] = useState<WorldOverlay>(null);
  const [noteState, setNoteState] = useState<NoteState | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const [WorldMapView, setWorldMapView] = useState<ComponentType<WorldMapViewProps> | null>(null);
  const imageDialog = useRef<HTMLDialogElement>(null);
  const imageStage = useRef<HTMLDivElement>(null);
  const fullImage = useRef<HTMLImageElement>(null);
  const imageDrag = useRef<{pointer:number;x:number;y:number;offset:{x:number;y:number}} | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageOffset, setImageOffset] = useState({x:0,y:0});
  const [imageError, setImageError] = useState(false);
  const clueDialog = useRef<HTMLDialogElement>(null);
  const lastOverlayTrigger = useRef<HTMLButtonElement | null>(null);
  const returnScrollY = useRef(0);
  const referenceScrollY=useRef<number|null>(null);

  const projectionKey = selectedId ? locationKey(selectedId, view, target) : "";
  const scopedProjectionKey = `${dataScope}\u0000${projectionKey}`;

  const cached = projectionKey ? readPlayerData<Payload>(dataScope, projectionKey) : null;
  const cachedHub = readPlayerData<HubPayload>(dataScope, activeHubKey);
  useEffect(() => {
    if (embeddedDossier) return;
    let alive = true;
    const initial = readPlayerData<HubPayload>(dataScope, activeHubKey);
    requestPlayerData(dataScope, activeHubKey, () => api<HubPayload>(activeHubKey), {
      force: Boolean(initial && !initial.fresh),
    }).then((payload) => {
      if (alive) {
        setHubResult({ key: scopedHubKey, places: payload.places });
        setHubError(null);
      }
    }).catch((reason: unknown) => {
      if (!alive) return;
      setHubError({ key: scopedHubKey, message: describeDataError(reason).detail });
    });
    return () => { alive = false; };
  }, [dataScope, activeHubKey, scopedHubKey, embeddedDossier]);

  useEffect(() => {
    if (embeddedDossier) return;
    if (!detail || !selectedId || !projectionKey) return;
    let alive = true;
    const initial = readPlayerData<Payload>(dataScope, projectionKey);
    requestPlayerData(dataScope, projectionKey, () => api<Payload>(projectionKey), {
      force: Boolean(initial && !initial.fresh),
    }).then((payload) => {
      if (alive) {
        setResult({ key: scopedProjectionKey, projection: payload.projection });
        setRequestError(null);
      }
    }).catch((reason: unknown) => {
      if (!alive) return;
      const issue = describeDataError(reason);
      setRequestError({ key: scopedProjectionKey, message: issue.detail });
    });
    return () => { alive = false; };
  }, [dataScope, detail, selectedId, projectionKey, scopedProjectionKey, embeddedDossier]);

  useEffect(() => {
    if (embeddedDossier) return;
    const syncLocation = () => {
      const url = new URL(window.location.href);
      const requestedId = url.searchParams.get("ort") || "";
      const isDetail = Boolean(requestedId);
      setSelectedId(requestedId);
      setDetail(isDetail);
      setActiveDossierId(url.searchParams.get('eintrag')||'');setActiveArea('');
      if (!isDetail) setMapStatus("loading");
      const restored=window.history.state?.chroniPlayLocationScrollY;
      referenceScrollY.current=typeof restored==='number'&&Number.isFinite(restored)?restored:null;
      if(referenceScrollY.current!==null)requestAnimationFrame(()=>window.scrollTo(0,referenceScrollY.current!));
      else if (!isDetail) requestAnimationFrame(() => window.scrollTo(0, returnScrollY.current));
    };
    syncLocation();
    window.addEventListener("popstate", syncLocation);
    return () => window.removeEventListener("popstate", syncLocation);
  }, [embeddedDossier]);

  useEffect(() => {
    if (embeddedDossier || detail || new URLSearchParams(window.location.search).has("ort")) return;
    let alive = true;
    import("./world-maplibre")
      .then(({ WorldMapLibre }) => {
        if (alive) setWorldMapView(() => WorldMapLibre);
      })
      .catch(() => {
        if (alive) setMapStatus("error");
      });
    return () => { alive = false; };
  }, [detail, embeddedDossier]);

  const projection = embeddedDossier ? projectionOverride ?? null : result?.key === scopedProjectionKey ? result.projection : cached?.value.projection ?? null;
  const showingDossier = embeddedDossier || detail;
  const error = requestError?.key === scopedProjectionKey ? requestError.message : "";
  const currentHub = useMemo(() => hubResult?.key === scopedHubKey ? hubResult.places : cachedHub?.value.places ?? EMPTY_PLACES, [hubResult, scopedHubKey, cachedHub]);
  const mapHub = currentHub;
  const loading = embeddedDossier ? false : detail ? !projection && !error : !hubResult && !cachedHub && !hubError;
  const location = projection?.location;
  const safeMapPlaces = useMemo(() => visibleWorldPlaces(mapHub, view === "sl"), [mapHub, view]);
  const matchingMapPlaces = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("de-DE");
    return safeMapPlaces.filter((place) => !needle || `${place.title} ${place.district} ${place.summary}`.toLocaleLowerCase("de-DE").includes(needle));
  }, [query, safeMapPlaces]);
  const matchingPlaces = matchingMapPlaces;
  const selected = matchingPlaces.find((place) => place.id === selectedId) ?? matchingPlaces[0] ?? null;
  const mapMarkers = useMemo(
    () => activeMapMarkersForPlace(matchingMapPlaces, selected?.id, view === "sl"),
    [matchingMapPlaces, selected?.id, view],
  );
  const visibleMapIds = useMemo(() => mapMarkers.map((marker) => marker.id), [mapMarkers]);
  const mapPreviewPlace = selected;
  const areaList = useMemo(() => location?.areas ?? [], [location]);
  const contextualArea = areaContext && areaContext.placeId === location?.id ? areaList.find(area => area.order === areaContext.order) : undefined;
  const requestedArea=areaList.find(area=>area.dossierHref?.includes(`eintrag=${encodeURIComponent(activeDossierId)}`)||area.rooms.some(room=>room.dossierHref?.includes(`eintrag=${encodeURIComponent(activeDossierId)}`)));
  const currentArea = areaList.find(area=>area.viewKey===activeArea) ?? requestedArea ?? contextualArea ?? areaList[0] ?? null;
  const dossierNodeExists = activeDossierId === location?.id || areaList.some(area => area.viewKey === activeDossierId || area.rooms.some(room => room.viewKey === activeDossierId)) || location?.knownInformation.some(info => info.id === activeDossierId);
  const dossierNodeId = dossierNodeExists ? activeDossierId : requestedArea?.viewKey || contextualArea?.viewKey || location?.id || '';
  const areaCopy = splitRichTextIntroduction(currentArea?.playerHint ?? "");
  useEffect(()=>{if(!activeDossierId||!location)return;const info=location.knownInformation.find(item=>item.id===activeDossierId||item.dossierHref?.includes(`eintrag=${encodeURIComponent(activeDossierId)}`));if(!info)return;const frame=requestAnimationFrame(()=>setOverlay(current=>current?.kind==='clue'&&current.title===info.title&&current.text===info.text?current:{kind:'clue',title:info.title,text:info.text,media:info.media}));return()=>cancelAnimationFrame(frame);},[activeDossierId,location]);
  useEffect(()=>{if(activeDossierId&&requestedArea)requestAnimationFrame(()=>{if(referenceScrollY.current!==null)window.scrollTo(0,referenceScrollY.current);else document.getElementById('known-areas')?.scrollIntoView({block:'start'});});},[activeDossierId,requestedArea?.viewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const cachedNotes = readPlayerData<NotesPayload>(dataScope, NOTES_KEY);
  const notes = noteState?.scope === dataScope ? noteState.records : cachedNotes?.value.records ?? [];
  const relatedNotes = notes.filter((note) => note.body?.locationId === location?.id);
  const unresolvedArea = areaList.find((area) => area.redacted && area.playerHint);
  // A lightbox never keeps a source that has disappeared from the current safe projection.
  const activeImage = overlay?.kind === "image" && (overlay.src === location?.image || areaList.some(area => !area.redacted && area.image === overlay.src)) ? overlay : null;

  useEffect(() => {
    if (embeddedDossier || !detail) return;
    const cachedNotes = readPlayerData<NotesPayload>(dataScope, NOTES_KEY);
    requestPlayerData(dataScope, NOTES_KEY, () => api<NotesPayload>(NOTES_KEY), {
      force: Boolean(cachedNotes && !cachedNotes.fresh),
    }).then((payload) => setNoteState({ scope: dataScope, records: payload.records })).catch(() => {
      setNoteState({ scope: dataScope, records: [] });
    });
  }, [dataScope, detail, embeddedDossier]);

  useEffect(() => {
    if (!activeImage && overlay?.kind !== "clue") return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [overlay, activeImage]);

  useEffect(()=>{
    if(!activeImage)return;
    const cancelDrag=()=>{
      const drag=imageDrag.current;imageDrag.current=null;
      if(drag&&imageStage.current?.hasPointerCapture(drag.pointer))imageStage.current.releasePointerCapture(drag.pointer);
    };
    window.addEventListener('blur',cancelDrag);
    return()=>{window.removeEventListener('blur',cancelDrag);cancelDrag();};
  },[activeImage]);

  useEffect(() => {
    if (activeImage) {
      imageDialog.current?.showModal();
    } else {
      imageDialog.current?.close();
    }
    if (overlay?.kind === "clue") {
      clueDialog.current?.showModal();
    } else {
      clueDialog.current?.close();
    }
  }, [overlay, activeImage]);

  function openImage(event: MouseEvent<HTMLButtonElement>, src: string, title: string) {
    lastOverlayTrigger.current = event.currentTarget;
    setImageZoom(1); setImageOffset({x:0,y:0}); setImageError(false); imageDrag.current=null;
    setOverlay({kind:"image",src,title});
  }

  function boundedImageOffset(x:number,y:number,zoom=imageZoom) {
    const stage=imageStage.current?.getBoundingClientRect(), image=fullImage.current;
    if(!stage||!image?.naturalWidth)return {x:0,y:0};
    const fit=Math.min(stage.width/image.naturalWidth,stage.height/image.naturalHeight);
    const maxX=Math.max(0,(image.naturalWidth*fit*zoom-stage.width)/2),maxY=Math.max(0,(image.naturalHeight*fit*zoom-stage.height)/2);
    return {x:Math.max(-maxX,Math.min(maxX,x)),y:Math.max(-maxY,Math.min(maxY,y))};
  }

  function zoomImage(amount:number) {
    const next=Math.max(1,Math.min(4,imageZoom+amount));
    setImageZoom(next);setImageOffset(current=>boundedImageOffset(current.x,current.y,next));
  }

  function panImage(x:number,y:number) { setImageOffset(current=>boundedImageOffset(current.x+x,current.y+y)); }

  function openLocationReference(href:string){
    const url=new URL(href,window.location.origin);
    if(embeddedDossier||url.origin!==window.location.origin||url.pathname!=='/spielbereich'||url.searchParams.get('bereich')!=='schauplaetze')return false;
    const character=new URL(window.location.href).searchParams.get('character');if(character&&!url.searchParams.has('character'))url.searchParams.set('character',character);
    const previous=window.history.state;
    history.replaceState({...previous,chroniPlayLocationScrollY:window.scrollY},'',window.location.href);
    history.pushState(null,'',url);
    window.dispatchEvent(new PopStateEvent('popstate'));
    return true;
  }

  function openPlace(id: string) {
    returnScrollY.current = window.scrollY;
    setActiveArea(null);setAreaContext(null);setActiveDossierId('');
    setSelectedId(id);
    setDetail(true);
    const url = new URL(window.location.href);
    url.pathname = "/spielbereich";
    url.searchParams.set("bereich", "schauplaetze");
    url.searchParams.set("ort", id);
    url.searchParams.delete("eintrag");
    history.pushState(null, "", url);
    window.scrollTo(0, 0);
  }

  function returnToMap() {
    if (embeddedDossier) {
      onDossierBack?.();
      return;
    }
    setDetail(false);
    setMapStatus("loading");
    setOverlay(null);
    setSelectedId("");
    const url = new URL(window.location.href);
    url.searchParams.set("bereich", "schauplaetze");
    url.searchParams.delete("ort");
    url.searchParams.delete("eintrag");
    history.replaceState(null, "", url);
    requestAnimationFrame(() => window.scrollTo(0, returnScrollY.current));
  }

  function chooseArea(id: string) {
    setActiveArea(id);
    const area=areaList.find(item=>item.viewKey===id);
    if(area&&location)setAreaContext({placeId:location.id,order:area.order});
  }

  async function saveNote() {
    if (!location) return;
    const text = noteDraft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await api("/api/records", "POST", {
        kind: "notizen",
        title: `Notiz zu ${location.title}`,
        visibility: "private",
        body: {
          text,
          summary: `Mit ${location.title} verknüpft`,
          locationId: location.id,
          targetId: location.id,
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
    if (!a.gm || view !== "sl" || busy || !location) return;
    setBusy(true);
    try {
      await api("/api/locations/actions", "POST", { placeId: location.id, actionId });
      invalidatePlayerData(dataScope, projectionKey);
      const updated = await requestPlayerData(dataScope, projectionKey, () => api<Payload>(projectionKey), { force: true });
      setResult({ key: scopedProjectionKey, projection: updated.projection });
      toast.success("SL-Aktion aktualisiert");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Die Aktion konnte nicht aktualisiert werden.");
    } finally {
      setBusy(false);
    }
  }


  async function changeGroupVisibility(entityId: string, reopen: boolean) {
    const state=location?.slGroupReleases?.find(item=>item.entityId===entityId);
    if(!a.gm||view!=="sl"||busy||!state||embeddedDossier)return;
    if(!state.lastPublishedRevisionId){toast.error("Für diesen Eintrag gibt es noch keinen genehmigten Gruppenstand. Bitte zuerst im SL-CMS veröffentlichen.");return;}
    if(!window.confirm(reopen?"Den zuletzt genehmigten Gruppenstand wieder anzeigen? Ungespeicherte und unveröffentlichte Entwürfe bleiben verborgen.":"Diesen Eintrag für die aktive Spielgruppe sperren? Untergeordnete Inhalte bleiben ebenfalls verborgen. Das bereits erworbene Wissen wird nicht zurückgestuft."))return;
    setBusy(true);
    try{
      await api("/api/cms/releases","POST",{action:reopen?"publish":"block",entityId,scope:"group",expectedReleaseVersion:state.version,...(reopen?{revisionId:state.lastPublishedRevisionId,discoveryState:state.discoveryState}:{}),reason:reopen?"Gruppenstand am SL-Spieltisch reaktiviert":"Gruppensicht am SL-Spieltisch gesperrt"});
      invalidatePlayerData(dataScope);
      const updated=await requestPlayerData(dataScope,projectionKey,()=>api<Payload>(projectionKey),{force:true});
      setResult({key:scopedProjectionKey,projection:updated.projection});
      toast.success(reopen?"Genehmigter Gruppenstand wieder sichtbar":"Für die aktive Spielgruppe gesperrt");
    }catch(reason){toast.error(reason instanceof Error?reason.message:"Die Freigabe konnte nicht geändert werden.");}
    finally{setBusy(false);}
  }
  function groupVisibilityFor(entityId: string) {
    const state=location?.slGroupReleases?.find(item=>item.entityId===entityId);
    if(projection?.view!=="sl"||!state||embeddedDossier)return null;
    return <div className={styles.slVisibility}><span>Gruppenfreigabe dieses Eintrags: {state.transition==="block"?"gesperrt":state.transition==="publish"?"freigegeben":"kein direkter Gruppenstand"}</span><button type="button" className={styles.secondaryButton} disabled={busy||state.transition==="block"||!state.lastPublishedRevisionId} onClick={()=>changeGroupVisibility(entityId,false)}>Für Gruppe sperren</button><button type="button" className={styles.secondaryButton} disabled={busy||!state.lastPublishedRevisionId||state.transition==="publish"} onClick={()=>changeGroupVisibility(entityId,true)}>Gruppenstand aktivieren</button>{!state.lastPublishedRevisionId&&<small>Erste Freigabe im SL-CMS vornehmen.</small>}</div>;
  }

  function closeOverlay() {
    setOverlay(null);
    requestAnimationFrame(() => {
      lastOverlayTrigger.current?.focus({preventScroll:true});
    });
  }

  const visibleError = showingDossier ? error : hubError?.key === scopedHubKey ? hubError.message : "";
  if (!embeddedDossier && !loading && visibleError && (detail ? !projection : !hubResult && !cachedHub)) {
    return <section className={styles.statePanel} data-world-experience="world" role="alert">
      <span className={styles.stateIcon}><Shield size={19} /></span>
      <div><p className={styles.kicker}>SPIELWELT · ZUGRIFF</p><h1>{detail ? "Der Ort ist gerade nicht verfügbar." : "Die Ortsdaten sind gerade nicht verfügbar."}</h1><p>{visibleError}</p></div>
      <button className={styles.secondaryButton} onClick={() => window.location.reload()} type="button">Erneut versuchen</button>
      {a.gm && view === "player" && <button className={styles.secondaryButton} onClick={() => setView("sl")} type="button">SL-Dossier öffnen</button>}
    </section>;
  }

  if (!embeddedDossier && loading) {
    return <div className={styles.worldRoot} data-world-experience="world" aria-busy="true">
      <header className={styles.worldIntro}><div><p className={styles.kicker}>DOMÄNE KLEVE · NACHTATLAS</p><h1>{detail ? "Ortsdossier" : "Spielwelt"}</h1></div><div className={styles.introMeta}>Die bekannten Orte deiner Chronik</div></header>
      {!detail && <div className={`${styles.mapStage} ${styles.mapLoading}`} aria-label="Stadtkarte wird geladen"><div className={styles.mapImage} /><span className={styles.loadingMark}><Compass size={17} /> Kartendaten werden geladen</span></div>}
      <div className={styles.loadingLine} role="status">{detail ? "Ortsansicht wird geladen …" : "Freigegebene Ortsdaten werden geladen …"}</div>
    </div>;
  }

  if (showingDossier && (!projection || !location)) {
    return <section className={styles.statePanel} data-world-experience="world" role="alert"><span className={styles.stateIcon}><Shield size={19} /></span><div><p className={styles.kicker}>SPIELWELT · ZUGRIFF</p><h1>Der Ort ist gerade nicht verfügbar.</h1><p>Für diesen Ort ist keine freigegebene Detailansicht vorhanden.</p></div><button className={styles.secondaryButton} onClick={returnToMap} type="button">Zur Karte</button></section>;
  }

  return <div className={`${styles.worldRoot} ${showingDossier ? styles.detailMode : ""}`} data-world-experience="world" data-dossier-mode={embeddedDossier ? embeddedLabel : undefined}>
    <header className={styles.worldIntro}>
      <div className={styles.worldIntroTitle}>
        <p className={styles.kicker}>DOMÄNE KLEVE <span>·</span> NACHTATLAS</p>
        <h1>{showingDossier ? "Ortsdossier" : view === "sl" ? "Ortsbestand der Chronik" : "Die Stadt bei Nacht"}</h1>
      </div>
      <div className={styles.introRight}>
      <p>{showingDossier ? embeddedLabel || (view === "sl" ? "Internes Ortswissen, nach Bereichen und Kapiteln." : "Ein Ort, wie dein Charakter ihn kennt.") : view === "sl" ? "Alle angelegten Orte der Chronik." : "Orte, die deinem Charakter bekannt sind."}</p>
        {a.gm && !embeddedDossier && <div className={styles.viewSwitch} role="group" aria-label="Ortsansicht wählen">
          <button type="button" aria-pressed={view === "player"} className={view === "player" ? styles.switchActive : ""} onClick={() => { setOverlay(null); setView("player"); }}><Eye size={14} aria-hidden="true"/>Spieleransicht</button>
          <button type="button" aria-pressed={view === "sl"} className={view === "sl" ? styles.switchActive : ""} onClick={() => { if(view === "player")setActiveDossierId(activeArea || selectedId); setOverlay(null); setView("sl"); }}><Shield size={14} aria-hidden="true"/>{showingDossier ? "SL-Dossier" : "SL-Ortsbestand"}</button>
        </div>}
        {a.gm && !embeddedDossier && view === "player" && <span className={styles.previewBadge}><Eye size={13} />Gruppenprojektion</span>}
      </div>
    </header>

    {!showingDossier || !projection || !location ? <>
      <section className={styles.mapSection} aria-label={view === "sl" ? "Ortsbestand auf der Chronikkarte" : "Bekannte Orte auf der Chronikkarte"}>
        <div className={styles.mapHeading}>
          <div className={styles.mapTitle}><span className={styles.mapMark}><Compass size={16} /></span><div><strong>Chronik</strong><span>{view === "sl" ? "SL-Ortskarte" : "Persönlicher Nachtatlas"}</span></div></div>
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
          <div className={styles.mapLegend} aria-live="polite">
            {mapMarkers.length > 0 && selected
              ? <><span className={styles.legendDot} />Aktive Markierung · {selected.title}</>
              : <>Keine bestätigte Position für den ausgewählten Ort</>}
          </div>
          {mapPreviewPlace && <aside className={`${styles.mapPreview} ${mapPreviewPlace.image ? "" : styles.mapPreviewNoImage}`} aria-live="polite">
            {mapPreviewPlace.image && <div className={styles.previewImage}><img src={mapPreviewPlace.image} alt="" loading="lazy" /></div>}
          <div className={styles.previewBody}><div className={styles.previewTopline}><span className={styles.statePip} />{discoveryLabel(mapPreviewPlace.discovery)} <span className={styles.previewDistrict}>{mapPreviewPlace.district}</span></div><h2>{mapPreviewPlace.title}</h2><p>{richTextToPlainText(mapPreviewPlace.summary)}</p><button type="button" className={styles.textAction} onClick={() => openPlace(mapPreviewPlace.id)}>Ort öffnen <ArrowRight size={15} /></button></div>
          </aside>}
          {matchingMapPlaces.length === 0 && safeMapPlaces.length > 0 && <div className={styles.noSearchResult}><Search size={17} /><span>Keine bekannten Orte passen zu deiner Suche.</span><button type="button" onClick={() => setQuery("")}>Suche zurücksetzen</button></div>}
          {mapStatus !== "ready" && <span className={styles.mapScale} aria-hidden="true"><i /><small>STADTPLAN · ILLUSTRATION</small></span>}
        </div>
      </section>

      <section className={styles.placeSection} aria-labelledby="place-list-title">
        <header className={styles.sectionHeading}><div><p className={styles.kicker}>{view === "sl" ? "ORTSBESTAND · SPIELLEITUNG" : "ORTE, DIE DIR BEKANNT SIND"}</p><h2 id="place-list-title">{view === "sl" ? "Alle angelegten Orte." : "Ein Ort im Gedächtnis."}</h2></div><p>{view === "sl" ? <>Alle angelegten Orte bleiben hier als Kacheln sichtbar.<br />Die Spielervorschau zeigt nur freigegebene Orte.</> : <>Was dein Charakter weiß, bleibt sichtbar.<br />Was er nicht kennt, erscheint hier nicht.</>}</p></header>
        <div className={styles.placeGrid}>
          {matchingPlaces.map((place) => <button
            type="button"
            className={`${styles.placeCard} ${!place.image ? styles.placeCardNoImage : ""} ${selected?.id === place.id || hoveredId === place.id ? styles.placeCardActive : ""}`}
            aria-label={`${place.title} öffnen`}
            key={place.id}
            onMouseEnter={() => { setHoveredId(place.id); setSelectedId(place.id); }}
            onMouseLeave={() => setHoveredId(null)}
            onFocus={() => { setHoveredId(place.id); setSelectedId(place.id); }}
            onBlur={() => setHoveredId(null)}
            onClick={() => openPlace(place.id)}
          >
            {place.image && <span className={styles.cardImage}><img src={place.image} alt="" loading="lazy" /><span className={styles.cardShade} /><span className={styles.cardStatus}><span className={styles.statePip} />{discoveryLabel(place.discovery)}</span><span className={styles.cardArrow}><ArrowUpRight size={18} /></span></span>}
            <span className={styles.cardCopy}>{!place.image && <span className={styles.cardStatusInline}><span className={styles.statePip} />{discoveryLabel(place.discovery)}</span>}<span className={styles.cardOverline}>{place.district} <i>·</i> NACHTORT</span><strong>{place.title}</strong>{place.subtitle && <span className={styles.cardSubtitle}>{place.subtitle}</span>}{place.summary && <span className={styles.cardSummary}>{richTextToPlainText(place.summary)}</span>}</span>
          </button>)}
          {matchingPlaces.length === 0 && <p className={styles.emptySearch}>Keine bekannten Orte passen zu deiner Suche.</p>}
        </div>
      </section>
    </> : projection.view === "sl" ? <article className={styles.slDossierPage} aria-label="SL-Dossier">
      <div className={styles.slDossierNavigation}><button type="button" className={styles.backLink} onClick={returnToMap}><ArrowLeft size={16} aria-hidden="true"/>{embeddedDossier ? "Zur Redaktion" : "Zur Karte"}</button></div>
      <LocationSLDossier onNavigate={openLocationReference} key={location.id} projection={projection} selectedId={dossierNodeId} onSelect={id => { setActiveDossierId(id); const area=areaList.find(item=>item.viewKey===id||item.rooms.some(room=>room.viewKey===id)); if(area)chooseArea(area.viewKey); }}/>
      {groupVisibilityFor(dossierNodeId)}
      {location.preparedActions && location.preparedActions.length > 0 && <section className={styles.gmActions}>
        <header className={styles.detailSectionHeader}><h2>Vorbereitete Aktionen</h2><Shield size={18} aria-hidden="true"/></header>
        {location.preparedActions.map(action => <div className={styles.gmActionRow} key={action.id}><span><strong>{action.label}</strong><small>{action.target}</small></span><button type="button" className={styles.secondaryButton} disabled={busy || action.status === "triggered"} onClick={() => triggerAction(action.id)}>{action.status === "triggered" ? "Ausgelöst" : "Auslösen"}</button></div>)}
      </section>}
    </article> : <>
      <article className={styles.locationPage} aria-labelledby="location-title">
        <section className={styles.locationHero}>
          {location.image && <img className={styles.locationHeroImage} src={location.image} alt={`${location.title} in der Spielwelt`} fetchPriority="high" />}
          <div className={styles.heroVeil} />
          <div className={styles.heroTopline}><button type="button" className={styles.backLink} onClick={returnToMap}><ArrowLeft size={16} />{embeddedDossier ? "Zur Redaktion" : "Zur Karte"}</button>{location.district && <span className={styles.heroLocation}><MapPin size={14} />{location.district}</span>}</div>
          <div className={styles.heroContent}><div><p className={styles.kicker}>{location.subtitle && <>{location.subtitle} <span>·</span> </>}{discoveryLabel(location.discovery).toUpperCase()}</p><h1 id="location-title">{location.title}</h1>{location.summary && <div className={styles.heroSummary}><RichTextView value={location.summary}/></div>}<div className={styles.heroActions}>{areaList.length > 0 && <button type="button" className={styles.primaryAction} onClick={() => { if(areaList[0])chooseArea(areaList[0].viewKey); document.getElementById("known-areas")?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? "instant" : "smooth", block: "start" }); }}><Compass size={16} />Bekannte Bereiche <ArrowDownRight size={15} /></button>}{location.image && <button type="button" className={styles.imageAction} onClick={event=>openImage(event,location.image!,location.title)}><Maximize2 size={15} />Bild ansehen</button>}</div></div><div className={styles.heroAside}><span className={styles.statePip} />{discoveryLabel(location.discovery)}<small>{stateLabel(location.worldState)}</small></div></div>
          <span className={styles.heroIndex} aria-hidden="true">01 <i>/</i> ORT</span>
        </section>

        <section className={styles.locationContent} data-has-intro={Boolean(location.atmosphere)}>
          <div className={styles.locationIntro}>
            {location.atmosphere && <section className={styles.impression}>
              <div className={styles.proseEyebrow}><span>01</span><p className={styles.kicker}>DEIN EINDRUCK</p></div>
              <div><h2>Dein Eindruck</h2><RichTextView value={location.atmosphere} className={styles.richProse}/><span className={styles.sourceContext}><Sparkles size={14} />Freigegebener Eindruck{location.district ? ` · ${location.district}` : ""}</span></div>
            </section>}
          </div>

            {areaList.length > 0 && <section className={styles.areasSection} id="known-areas" aria-labelledby="areas-title">
              <header className={styles.detailSectionHeader}><h2 id="areas-title">Bekannte Bereiche</h2><span className={styles.sectionCounter}>{String(areaList.length).padStart(2, "0")} <small>bekannte Bereiche</small></span></header>
              <div className={styles.areaLayout}>
                <div className={styles.areaList} role="tablist" aria-label="Bekannte Bereiche" aria-orientation="vertical">
                  {areaList.map((area, index) => <button className={`${styles.areaTab} ${currentArea?.viewKey === area.viewKey ? styles.areaTabActive : ""} ${area.redacted ? styles.areaTabUnclear : ""}`} key={area.viewKey} type="button" role="tab" tabIndex={currentArea?.viewKey===area.viewKey?0:-1} aria-selected={currentArea?.viewKey === area.viewKey} aria-controls={currentArea?.viewKey===area.viewKey?`area-detail-${index}`:undefined} id={`area-tab-${index}`} onClick={() => chooseArea(area.viewKey)} onKeyDown={event=>{
                    const next=event.key==='Home'?0:event.key==='End'?areaList.length-1:['ArrowDown','ArrowRight'].includes(event.key)?(index+1)%areaList.length:['ArrowUp','ArrowLeft'].includes(event.key)?(index+areaList.length-1)%areaList.length:null;
                    if(next===null)return;event.preventDefault();chooseArea(areaList[next].viewKey);document.getElementById(`area-tab-${next}`)?.focus();
                  }}>
                    <span className={styles.areaNumber}>{String(index + 1).padStart(2, "0")}</span><span className={styles.areaTabCopy}><strong>{area.redacted ? "Ungeklärt" : area.title}</strong><small>{area.redacted ? "Hinweis vorhanden" : `${area.rooms.length} bekannte Räume`}</small></span>{area.redacted ? <CircleHelp size={16} /> : <ArrowRight size={15} />}
                  </button>)}
                  {!areaList.length && <p className={styles.mutedText}>Für diesen Ort sind noch keine Bereiche freigegeben.</p>}
                </div>
                {currentArea && <section className={`${styles.areaDetail} ${currentArea.redacted ? styles.unclearDetail : ""}`} role="tabpanel" tabIndex={0} id={`area-detail-${areaList.indexOf(currentArea)}`} aria-labelledby={`area-tab-${areaList.indexOf(currentArea)}`}>
                  <header className={styles.areaDetailHeader}><h3>{currentArea.redacted ? "Ein Hinweis bleibt offen." : currentArea.title}</h3><span className={styles.discoveryTag}>{currentArea.redacted ? "Ungeklärt" : discoveryLabel(currentArea.discovery)}</span></header>
                  {groupVisibilityFor(currentArea.viewKey)}
                  <div className={`${styles.areaBody} ${currentArea.image && !currentArea.redacted ? styles.areaBodyWithImage : ""}`}>
                    {currentArea.image && !currentArea.redacted && <button type="button" className={styles.areaImageButton} aria-label={`Bild vergrößern: ${currentArea.title}`} onClick={event=>openImage(event,currentArea.image!,currentArea.title)}>
                      <img src={currentArea.image} alt={`Freigegebenes Bild: ${currentArea.title}`} width={400} height={300} loading="lazy"/>
                      <span><ZoomIn size={16} aria-hidden="true"/>Bild vergrößern</span>
                    </button>}
                    <div className={styles.areaText}>
                      {areaCopy.introduction && <RichTextView value={areaCopy.introduction} readable flowing className={`${styles.areaHint} ${styles.areaIntroduction}`}/>}
                      {areaCopy.description && <RichTextView value={areaCopy.description} readable flowing className={styles.areaHint}/>}
                      {!currentArea.redacted && currentArea.worldState !== "active" && <p className={styles.areaContext}>{stateLabel(currentArea.worldState)}</p>}
                      <LocationMediaGallery media={currentArea.media?.filter(m=>!m.hero)}/>
                      {currentArea.rooms.length > 0 && <div className={styles.roomList}>{currentArea.rooms.map((room) => <article className={styles.roomRow} key={room.viewKey}><span className={styles.roomOrder}>{String(room.order).padStart(2, "0")}</span><div><details open={activeDossierId===room.viewKey||!!activeDossierId&&room.dossierHref?.includes(`eintrag=${encodeURIComponent(activeDossierId)}`)||undefined}><summary><strong>{room.title.replace(/^\d+\s/, "")}</strong></summary>{room.short && <RichTextView value={room.short} readable flowing className={styles.richProse}/>}<LocationMediaGallery media={room.media}/></details> {groupVisibilityFor(room.viewKey)}</div><span className={styles.roomStatus}>{discoveryLabel(room.discovery)}</span></article>)}</div>}
                      {!currentArea.redacted && currentArea.rooms.length === 0 && <p className={styles.mutedText}>Zu diesem Bereich sind keine Räume freigegeben.</p>}
                      {currentArea.redacted && <div className={styles.unclearSeal}><CircleHelp size={15} />Keine Raumdetails freigegeben</div>}
                    </div>
                  </div>
                </section>}
              </div>
            </section>}

          <div className={styles.locationMain}>
            {unresolvedArea?.playerHint && <button type="button" className={styles.clueCard} aria-label="Offenen Orts-Hinweis öffnen" onClick={(event) => { lastOverlayTrigger.current = event.currentTarget; setOverlay({ kind: "clue", title: "Offener Orts-Hinweis", text: unresolvedArea.playerHint! }); }}>
              <span className={styles.clueGlyph}><CircleHelp size={20} /></span><span className={styles.clueCopy}><span className={styles.kicker}>OFFENER HINWEIS · UNGEKLÄRT</span><strong>Offener Orts-Hinweis</strong><span>{richTextToPlainText(unresolvedArea.playerHint)}</span></span><ArrowUpRight className={styles.clueArrow} size={17} />
            </button>}

            <LocationMediaGallery media={location.media?.filter(m=>!m.hero)}/>
            <LocationConnections onNavigate={openLocationReference} entityId={location.id} view={projection.view} viewerId={previewViewerId}/>
            <LocationKnowledgeSearch onNavigate={openLocationReference} placeId={location.id} view={projection.view} viewerId={previewViewerId}/>
            {location.knownInformation.length > 0 && <section className={styles.informationSection}>
              <header className={styles.detailSectionHeader}><div><p className={styles.kicker}>FREIGEGEBENE ERKENNTNISSE</p><h2>Was hängen blieb</h2></div><BookOpen size={19} /></header>
              <div className={styles.informationList}>{location.knownInformation.map((info) => <button type="button" className={styles.informationRow} key={info.id} onClick={(event) => { lastOverlayTrigger.current = event.currentTarget; setOverlay({ kind: "clue", title: info.title, text: info.text,media:info.media }); }}><span><Sparkles size={15} /></span><span><strong>{info.title}</strong><small>{richTextToPlainText(info.text)}</small></span><ArrowUpRight size={15} /></button>)}</div>
            </section>}

            {groupVisibilityFor(projection.location.id)}
          </div>

          <aside className={styles.locationAside}>
            {location.image && <button type="button" className={styles.photoCard} onClick={event=>openImage(event,location.image!,location.title)}><span className={styles.photoImage}><img src={location.image} alt="" loading="lazy" /><span><ImageIcon size={15} />Bild öffnen</span></span><span className={styles.photoCaption}>{location.title}{location.district && <> <i>·</i> {location.district}</>}</span></button>}
            {(location.district || location.address || location.worldState !== "active") && <section className={styles.factCard}><p className={styles.kicker}>EINORDNUNG</p>{location.district && <div className={styles.factRow}><span>Gebiet</span><strong>{location.district}</strong></div>}{location.address && <div className={styles.factRow}><span>Adresse</span><strong>{location.address}</strong></div>}{location.worldState !== "active" && <div className={styles.factRow}><span>Ortszustand</span><strong>{stateLabel(location.worldState)}</strong></div>}</section>}
            {location.knownInformation.some((info) => info.title === "Atmosphäre") && <section className={styles.knownNote}><span><FileText size={16} /></span><div><p className={styles.kicker}>BEKANNTE ATMOSPHÄRE</p><RichTextView value={location.knownInformation.find((info) => info.title === "Atmosphäre")?.text||""} className={styles.richProse}/></div></section>}
            {!embeddedDossier && <section className={styles.notesSection}><header><span><NotebookPen size={16} />Deine Notizen</span><small>privat</small></header><label className={styles.srOnly} htmlFor="world-note">Private Notiz zu {location.title}</label><textarea id="world-note" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Ein Gedanke, den nur du siehst …" rows={3} maxLength={2500} /><button type="button" className={styles.noteSave} disabled={busy || !noteDraft.trim()} onClick={saveNote}>{busy ? "Speichert …" : "Private Notiz sichern"}<ArrowRight size={14} /></button><div className={styles.savedNotes}>{relatedNotes.length ? relatedNotes.slice(0, 3).map((note) => <article key={note.id}><Check size={13} /><div><strong>{note.title}</strong><p>{String(note.body.text ?? "")}</p></div></article>) : <p>Noch keine eigenen Ortsnotizen.</p>}</div></section>}
          </aside>
        </section>

        <footer className={styles.locationFooter}><span>ORTSDOSSIER <i>·</i> {location.title}</span><button type="button" onClick={returnToMap}><ArrowLeft size={15} />{embeddedDossier ? "Zurück zur Redaktion" : "Zurück zur Chronikkarte"}</button></footer>
      </article>
    </>}

    {location && <>
      {activeImage && <dialog ref={imageDialog} className={`${styles.overlay} ${styles.imageOverlay}`} aria-label={`Bildansicht: ${activeImage.title}`} onClose={closeOverlay} onClick={(event) => { if (event.target === imageDialog.current) imageDialog.current?.close(); }}>
        <div className={styles.overlayFrame}>
          <div className={styles.overlayTop}><span><ImageIcon size={15} aria-hidden="true"/>{activeImage.title}</span><button type="button" aria-label="Bildansicht schließen" onClick={() => imageDialog.current?.close()}><X size={19} aria-hidden="true"/></button></div>
          <div className={styles.imageControls} role="group" aria-label="Bildansicht steuern">
            <button type="button" aria-label="Bild verkleinern" disabled={imageZoom<=1||imageError} onClick={()=>zoomImage(-.5)}><ZoomOut size={18} aria-hidden="true"/></button>
            <output aria-live="polite" aria-label="Bildzoom">{Math.round(imageZoom*100)} %</output>
            <button type="button" aria-label="Bild vergrößern" disabled={imageZoom>=4||imageError} onClick={()=>zoomImage(.5)}><ZoomIn size={18} aria-hidden="true"/></button>
            <button type="button" onClick={()=>{setImageZoom(1);setImageOffset({x:0,y:0});}}><RotateCcw size={16} aria-hidden="true"/>Einpassen</button>
            {imageZoom>1&&<div className={styles.panControls} role="group" aria-label="Vergrößertes Bild verschieben">{[['links',-40,0],['rechts',40,0],['oben',0,-40],['unten',0,40]].map(([direction,x,y])=><button key={direction} type="button" aria-label={`Bild nach ${direction} verschieben`} onClick={()=>panImage(Number(x),Number(y))}><ArrowRight size={16} aria-hidden="true" style={{transform:`rotate(${direction==='links'?180:direction==='oben'?-90:direction==='unten'?90:0}deg)`}}/></button>)}</div>}
          </div>
          <div ref={imageStage} className={styles.imageStage} data-zoomed={imageZoom>1} tabIndex={0} role="group" aria-label="Vergrößerbares Ortsbild" aria-describedby="location-image-help" onKeyDown={event=>{
            if(['+','='].includes(event.key)){event.preventDefault();zoomImage(.5);}else if(event.key==='-'){event.preventDefault();zoomImage(-.5);}else if(event.key==='0'){event.preventDefault();setImageZoom(1);setImageOffset({x:0,y:0});}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();panImage(event.key==='ArrowLeft'?-40:event.key==='ArrowRight'?40:0,event.key==='ArrowUp'?-40:event.key==='ArrowDown'?40:0);}
          }} onPointerDown={event=>{
            if(imageZoom<=1||event.button!==0||imageDrag.current)return;event.preventDefault();imageDrag.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,offset:imageOffset};event.currentTarget.setPointerCapture(event.pointerId);
          }} onPointerMove={event=>{
            const drag=imageDrag.current;if(!drag||drag.pointer!==event.pointerId)return;setImageOffset(boundedImageOffset(drag.offset.x+event.clientX-drag.x,drag.offset.y+event.clientY-drag.y));
          }} onPointerUp={event=>{if(imageDrag.current?.pointer!==event.pointerId)return;imageDrag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}} onPointerCancel={event=>{if(imageDrag.current?.pointer===event.pointerId)imageDrag.current=null;}} onLostPointerCapture={event=>{if(imageDrag.current?.pointer===event.pointerId)imageDrag.current=null;}}>
            {imageError?<p role="alert">Das Bild konnte nicht geladen werden. Schließe die Ansicht und versuche es erneut.</p>:<img ref={fullImage} src={activeImage.src} alt={activeImage.title} width={1200} height={900} draggable={false} onError={()=>setImageError(true)} style={{transform:`translate(${imageOffset.x}px,${imageOffset.y}px) scale(${imageZoom})`}}/>}
          </div>
          <p id="location-image-help">Vollständiges Bild · Mit +/− zoomen, vergrößert ziehen oder mit Pfeiltasten verschieben. Escape schließt die Ansicht.</p>
        </div>
      </dialog>}

      <dialog ref={clueDialog} className={`${styles.overlay} ${styles.clueOverlay}`} aria-label={overlay?.kind === "clue" ? overlay.title : "Freigegebener Hinweis"} onClose={closeOverlay} onClick={(event) => { if (event.target === clueDialog.current) clueDialog.current?.close(); }}>
        <div className={styles.clueDialogFrame}><div className={styles.overlayTop}><span><CircleHelp size={16} />{overlay?.kind === "clue" ? "HINWEIS · DEINE CHRONIK" : "ERKENNTNIS · DEINE CHRONIK"}</span><button type="button" aria-label="Hinweis schließen" onClick={() => clueDialog.current?.close()}><X size={19} /></button></div><p className={styles.kicker}>{overlay?.kind === "clue" ? "UNGEKLÄRT" : "FREIGEGEBEN"}</p><h2>{overlay?.kind === "clue" ? overlay.title : "Hinweis"}</h2><RichTextView value={overlay?.kind === "clue" ? overlay.text : ""} className={styles.richProse}/>{overlay?.kind==="clue"&&<LocationMediaGallery media={overlay.media}/>}<div className={styles.clueFooter}><span><Sparkles size={14} />Nur freigegebener Inhalt</span><span>{location.title} <ChevronDown size={14} /></span></div></div>
      </dialog>
    </>}
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
