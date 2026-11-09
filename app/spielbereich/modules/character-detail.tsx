"use client";
/* eslint-disable @next/next/no-img-element, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Entry } from "@/domain/legacy";
import type { Actor } from "@/domain/types";
import { CharacterSheet } from "./character-sheet/character-sheet";
import { CharacterProfileEditor } from "./character-sheet/character-profile";
import { CharacterProgression } from "./character-progression";
import studio from "./character-studio.module.css";
import { clanSymbolFor } from "./clan-symbol";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Camera,
  Eye,
  Pencil,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError, api } from "./api-client";
import { describeDataError, invalidatePlayerData, purgeProtectedPlayerData, readPlayerData, requestPlayerData } from "./player-data-cache";
import {
  CharacterDetailProjection,
} from "./character";
import {activeCharacterBody} from "@/domain/character-selection";
import {hybridPreparationNote,readSpecialties} from "@/domain/character-specialties";
import {useCommandConfirmation} from "./command-confirmation";

export function CharacterDetail({
  a,
  inspection = false,
  entries: allEntries,
  dataScope,
  activeCharacterId,
  onActiveCharacterChange,
  onCreate,
  onEdit,
  onRefresh,
  initialView = "sheet",
}: {
  initialView?: string;
  a: Actor;
  inspection?: boolean;
  entries: Entry[];
  dataScope: string;
  activeCharacterId: string | null;
  onActiveCharacterChange: (id: string | null) => void;
  onCreate: () => void;
  onEdit: (e: Entry) => void;
  onRefresh?: () => void;
}) {
  // ?ansicht=entwicklung (from the XP tile on the Zuflucht) opens the development tab directly.
  const [view, setView] = useState(()=>typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("ansicht")==="entwicklung"?"development":initialView);
  const presentationDirty=useRef(false);
  // The development link is a one-off: drop ?ansicht= so a reload shows the sheet again.
  useEffect(()=>{const url=new URL(window.location.href);if(url.searchParams.has("ansicht")){url.searchParams.delete("ansicht");history.replaceState(null,"",url);}},[]);
  function leavePresentation(){
    if(!presentationDirty.current)return true;
    if(!window.confirm('Ungespeicherte Änderungen am Charakterprofil verwerfen?'))return false;
    presentationDirty.current=false;
    return true;
  }
  const [projectionState, setProjection] = useState<CharacterDetailProjection | null>(
    null,
  );
  const [, setState] = useState("");
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedCharacterId, setLoadedCharacterId] = useState<string | null>(null);
  const loadVersion = useRef(0);
  const [noteDraft, setNoteDraft] = useState<{
    id?: string;
    version?: number;
    title: string;
    text: string;
    visibility: string;
  } | null>(null);
  const [companionBusy, setCompanionBusy] = useState(false);
  const [healthResetOpen, setHealthResetOpen] = useState(false);
  const [runtimeBusy, setRuntimeBusy] = useState(false);
  const runtimeLock = useRef(false);
  const portraitInput = useRef<HTMLInputElement>(null);
  const [archiveView,setArchiveView]=useState(false),[archivedId,setArchivedId]=useState<string|null>(null);
  const lifecycleConfirmation=useCommandConfirmation();
  const entries=useMemo(()=>allEntries.filter(e=>archiveView?!activeCharacterBody(e.body):activeCharacterBody(e.body)),[allEntries,archiveView]);
  const selected=archiveView?archivedId:activeCharacterId;
  async function abandonDrafts(){if(!leavePresentation())return false;if(noteDraft&&!await lifecycleConfirmation.ask('Ungespeicherte Texte verwerfen und die Charakteransicht wechseln?'))return false;setNoteDraft(null);setView('sheet');return true;}
  async function chooseCharacter(id:string|null){if(!await abandonDrafts())return;if(archiveView)setArchivedId(id);else onActiveCharacterChange(id);}
  async function switchArchive(archive:boolean){if(!await abandonDrafts())return;setArchiveView(archive);}
  const archiveNav=<nav className="character-archive-nav" aria-label="Charakterverwaltung"><button className="button" aria-pressed={!archiveView} onClick={()=>void switchArchive(false)}>Aktive Charaktere</button><button className="button" aria-pressed={archiveView} onClick={()=>void switchArchive(true)}>Archivierte Charaktere ({allEntries.filter(e=>!activeCharacterBody(e.body)).length})</button></nav>;

  const active = entries.find((e) => e.id === selected) ?? null;
  const projection = loadedCharacterId === active?.id ? projectionState : null;

  useEffect(() => {
    if(archiveView)return;
    if (activeCharacterId && !entries.some((entry) => entry.id === activeCharacterId)) {
      onActiveCharacterChange(null);
      return;
    }
    if (!activeCharacterId && entries.length === 1 && entries[0].id) {
      onActiveCharacterChange(entries[0].id);
    }
  }, [activeCharacterId, entries, onActiveCharacterChange,archiveView]);

  async function reload(force = false, quiet = false) {
    const characterId = active?.id;
    if (!characterId) return;
    const version = ++loadVersion.current;
    const key = `/api/character-detail?id=${encodeURIComponent(characterId)}${inspection ? "&view=sl" : ""}`;
    const cached = readPlayerData<CharacterDetailProjection>(dataScope, key);
    if (!quiet) setProjection(cached?.value ?? null);
    setLoadedCharacterId(characterId);
    setLoadError(null);
    if (!quiet) {
      setLoading(!cached);
      setRefreshing(!!cached && (force || !cached.fresh));
    }
    try {
      const next = await requestPlayerData(
        dataScope,
        key,
        () => api<CharacterDetailProjection>(key),
        { force },
      );
      if (version !== loadVersion.current) return;
      setProjection(next);
      setLoadedCharacterId(characterId);
      setLoadError(null);
      if (!quiet) setState("");
    } catch (e) {
      if (version !== loadVersion.current) return;
      const issue = describeDataError(e);
      setLoadError(e instanceof Error ? e : new Error(issue.detail));
      if (issue.permission) setProjection(null);
    } finally {
      if (version === loadVersion.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    // This fetch intentionally synchronizes the server projection when selection changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    return () => { loadVersion.current += 1; };
  }, [selected, active?.version]);

  useEffect(() => {
    // Refresh only the selected dossier. Editing and local writes take priority;
    // the existing version guards still protect concurrent updates.
    if (!active?.id || noteDraft || companionBusy || runtimeBusy) return;
    let running=false;
    const sync=async()=>{
      if(running||runtimeLock.current||presentationDirty.current||document.visibilityState!=="visible")return;
      running=true;
      try { await reload(true,true); } finally { running=false; }
    };
    window.addEventListener("focus",sync);
    const timer=window.setInterval(()=>void sync(),10000);
    return()=>{window.removeEventListener("focus",sync);window.clearInterval(timer);loadVersion.current+=1;};
  }, [selected, active?.version, noteDraft, companionBusy, runtimeBusy]);

  function invalidateCharacter() {
    if (!active?.id) return;
    invalidatePlayerData(dataScope, `/api/character-detail?id=${encodeURIComponent(active.id)}${inspection ? "&view=sl" : ""}`);
    invalidatePlayerData(dataScope, "/api/dashboard");
  }

  async function runtime(
    field: "blood" | "willpowerTemporary" | "health",
    value: unknown,
  ) {
    if (!active?.id || !projection || loadedCharacterId !== active.id || runtimeLock.current) return;
    runtimeLock.current = true;
    setRuntimeBusy(true);
    setState("SPEICHERT …");
    try {
      const r = await fetch("/api/character-runtime", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: active.id,
          version: projection.revision.version,
          field,
          value,
        }),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) {
        if (r.status === 409) {
          setState("KONFLIKT – Serverstand wird geladen.");
          invalidateCharacter();
          await reload(true);
          setState("KONFLIKT – Der aktuelle Stand ist geladen. Deine Änderung wurde nicht übernommen; bitte erneut prüfen.");
          return;
        }
        if ([401, 403, 404].includes(r.status)) {
          purgeProtectedPlayerData();
          setProjection(null);
          setLoadError(new ApiError(data.error || "Charakter ist nicht mehr verfügbar.", r.status));
        }
        throw new ApiError(data.error || "FEHLER", r.status);
      }
      invalidateCharacter();
      await reload(true);
      setState("GESPEICHERT");
    } catch (e) {
      setState("FEHLER: " + (e as Error).message);
      if (describeDataError(e).permission) {
        purgeProtectedPlayerData();
        setProjection(null);
        setLoadError(e instanceof Error ? e : new Error(describeDataError(e).detail));
      }
    } finally {
      runtimeLock.current = false;
      setRuntimeBusy(false);
    }
  }

  async function resetHealth() {
    setHealthResetOpen(false);
    await runtime("health", "Gesund");
  }

  async function uploadMedia(file: File | undefined, type: string) {
    if (!file || !active?.id || !projection || !leavePresentation()) return;
    setCompanionBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("visibility", "private");
      const uploaded = await api<{ id: string }>("/api/files", "POST", form);
      await api("/api/character-companion", "PATCH", {
        action: "media",
        id: active.id,
        version: projection.revision.version,
        fileId: uploaded.id,
        mediaType: type,
      });
      toast.success(type === "portrait" ? "Portrait gespeichert" : "Bild gespeichert");
      if (portraitInput.current) portraitInput.current.value = "";
      invalidateCharacter();
      await reload(true);
      onRefresh?.();
    } catch (e) {
      toast.error((e as Error).message);
      invalidateCharacter();
      await reload(true);
    } finally {
      setCompanionBusy(false);
    }
  }




  async function changeLifecycle(archive:boolean){
    if(!active?.id||companionBusy)return;
    if(!await lifecycleConfirmation.ask(archive?`„${active.title}“ archivieren? Alle Werte, Bilder und Verknüpfungen bleiben erhalten. Die Figur wird nicht mehr als aktive Spielfigur angeboten.`:`„${active.title}“ wiederherstellen?`))return;
    setCompanionBusy(true);
    try{await api('/api/character-companion','PATCH',{action:archive?'character.archive':'character.restore',id:active.id,version:active.version,confirmed:true});invalidatePlayerData(dataScope);if(archive&&active.id===activeCharacterId)onActiveCharacterChange(null);setArchivedId(archive?active.id:null);setArchiveView(archive);setView("sheet");onRefresh?.();toast.success(archive?'Charakter archiviert – alle Daten erhalten.':'Charakter wiederhergestellt.');}catch(e){toast.error((e as Error).message);}finally{setCompanionBusy(false);}
  }

  if (!active)
    return (
      <section className={`panel character-empty ${studio.studio}`}>
        {archiveNav}
        {lifecycleConfirmation.dialog}
        <h2>{archiveView ? "Archivierte Charaktere" : entries.length ? "Charakter auswählen" : "Noch kein Charakter"}</h2>
        <p className="muted">
          {entries.length
            ? a.gm ? "Wähle einen für dich freigegebenen Charakter der Kampagne aus." : "Wähle einen deiner Charaktere aus."
            : archiveView ? "Keine archivierten Charaktere vorhanden." : "Lege deinen ersten Charakter an."}
        </p>
        <button className="button primary" onClick={onCreate}><Plus size={16}/>Charakter erschaffen</button>
        {entries.length ? (
          <div className="character-picker">
            {entries.map((e) => (
              <button
                type="button"
                className="entry-card"
                key={e.id}
                onClick={() => {
                  const id = e.id ?? null;
                  chooseCharacter(id);
                }}
              >
                <strong>{e.title}</strong>
                <span>{String(e.body.clan || "Clan nicht angegeben")}</span>
              </button>
            ))}
          </div>
        ) : null}
      </section>
    );
  if (!projection && (loading || !loadError || loadedCharacterId !== active.id))
    return (
      <section className="panel">
        <p>Charakterbogen wird geladen …</p>
      </section>
    );
  if (!projection)
    return (
      <section className="panel">
        <h2>{loadError ? describeDataError(loadError).title : "Charakter konnte nicht geladen werden"}</h2>
        <p className="muted">{loadError?.message || "Bitte erneut versuchen."}</p>
        <button className="button" onClick={() => void reload(true)}>Erneut versuchen</button>
      </section>
    );

  const i = projection.identity;
  const s = projection.sheet;
  const archived=!activeCharacterBody(active.body);
  const permissions: CharacterDetailProjection["permissions"] = {...projection.permissions,...(archived?{canEdit:false,canEditCompanion:false,canChangeRuntimeValues:false,canCreateNotes:false}:{})};
  const characterState = String(projection.progression.characterState ?? active.body.characterState ?? "");
  const canCompanion = permissions.canEditCompanion === true;
  const companion = projection.companion || {
    media: [],
    notes: [],
    relationships: [],
    lastSession: null,
  };
  const identityFields: Array<[string, unknown]> = [
    ["Spieler", i.player],
    ["Chronik", i.chronicle],
    ["Generation", i.generation],
    ["Wesen", i.nature],
    ["Verhalten", i.demeanor],
    ["Konzept", i.concept],
    ["Erzeuger", i.sire],
  ];

  return (
    <div className={`character-detail-page ${studio.studio} ${inspection?studio.inspection:""}`}>
      {lifecycleConfirmation.dialog}
      {archived&&<p role="status" className="panel">Archivierter Charakter · Daten erhalten · vor Änderungen wiederherstellen.</p>}
      {refreshing && <p className="muted" role="status">Charakterbogen wird aktualisiert …</p>}
      {loadError && <div role="alert" className="error-box"><strong>{describeDataError(loadError).title}</strong><p>{loadError.message}</p><button className="button" onClick={() => void reload(true)}>Erneut versuchen</button></div>}
      <nav className={studio.actionBar} aria-label="Charakteraktionen">
        <div className={studio.viewSwitch} role="group" aria-label="Charakterliste"><button type="button" aria-pressed={!archiveView} onClick={()=>void switchArchive(false)}>Aktive</button><button type="button" aria-pressed={archiveView} onClick={()=>void switchArchive(true)}>Archiviert ({allEntries.filter(e=>!activeCharacterBody(e.body)).length})</button></div>
          {entries.length > 1 && (
            <label className="character-active-select">
              <span>{inspection ? "Charakter in SL-Inspektion" : "Aktiver Charakter"}</span>
              <select
                aria-label={inspection ? "Charakter in SL-Inspektion" : "Aktiver Charakter"}
                value={active.id ?? ""}
                disabled={runtimeBusy || companionBusy}
                onChange={(event) => {
                  const id = event.target.value || null;
                  chooseCharacter(id);
                }}
              >
                {entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
              </select>
            </label>
          )}
          {permissions.canEdit === true && (
            <button
              className="button primary character-edit"
              disabled={!(inspection && a.gm) && projection.permissions.sheetEditing !== true && (characterState === "confirmed" || characterState === "review")}
              title={inspection && a.gm ? "Werte als zuständige SL begründet korrigieren und Ausnahmen freigeben." : characterState === "confirmed" ? "Bestätigte Werte über Entwicklung steigern; Texte unter Geschichte bearbeiten." : characterState === "review" ? "Der eingereichte Bogen ist während der SL-Prüfung geschützt." : undefined}
              onClick={() => {
                if(!leavePresentation())return;
                if(inspection&&a.gm)setView("management");
                else if(projection.permissions.sheetEditing===true)setView("development");
                else onEdit(active);
              }}
            >
              <Pencil size={16} /> {inspection && a.gm ? "Akte verwalten" : "Bogen bearbeiten"}
            </button>
          )}
          {active.owner_id===a.id&&!inspection&&<button className="button" disabled={companionBusy} onClick={()=>void changeLifecycle(!archived)}>{archived?"Charakter wiederherstellen":"Charakter archivieren"}</button>}
          <details className={studio.heroUtilities}><summary>Weitere Aktionen</summary><div>
          <button className="button" onClick={onCreate}><Plus size={15}/>Neuer Charakter</button>
          <button className="button" onClick={()=>{if(!leavePresentation())return;onEdit({...structuredClone(active),canEdit:false});}}><Eye size={15}/>Charaktererstellung ansehen</button>
          {canCompanion && (
            <label className="button character-upload-trigger">
              <Camera size={16} /> Portrait ändern
              <input
                ref={portraitInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={companionBusy}
                onChange={(e) => void uploadMedia(e.target.files?.[0], "portrait")}
              />
            </label>
          )}
          </div></details>
        </nav>
      <header className={"character-hero "+studio.heroBlock}>
        <div className="character-portrait">
          {typeof i.portraitRef === "string" && i.portraitRef ? (
            <img src={i.portraitRef} alt="Charakterporträt" />
          ) : (
            <>
              <span>V20</span>
              <small>PORTRÄT</small>
            </>
          )}
        </div>
        <div className="character-hero-copy">
          <p className="eyebrow">{String(i.clan || "CHARAKTER")}</p>
          <h2>{String(i.name || active.title)}</h2>
          <p className="character-motto">
            {String(i.concept || "Keine Charakteraussage hinterlegt.")}
          </p>
          <dl className={`character-identity ${studio.identityGrid}`}>
            {identityFields.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{String(value ?? "Nicht angegeben")}</dd>
              </div>
            ))}
          </dl>
        </div>
        {typeof i.clan==="string"&&i.clan.trim()&&<div className={studio.clanBanner} aria-label={"Clan "+i.clan}>{clanSymbolFor(i.clan.trim())&&<img src={clanSymbolFor(i.clan.trim())!} alt="" aria-hidden="true" width={48} height={48}/>}<span>{i.clan}</span></div>}
      </header>
      <div className={studio.tabRow}>
      <nav className={studio.tabs} role="tablist" aria-label="Charakteransicht">
        {[{id:"sheet",label:"V20-Bogen"},{id:"presentation",label:"Charakterprofil"},{id:"development",label:"Entwicklung"},...(inspection&&a.gm?[{id:"management",label:"Verwaltung"}]:[])].filter(tab=>!archived||!["development","management"].includes(tab.id)).map(tab=><button type="button" role="tab" aria-selected={view===tab.id} key={tab.id} onClick={()=>{if(view!==tab.id&&!leavePresentation())return;setView(tab.id);}}>{tab.label}</button>)}
      </nav>
      {!inspection && !archived && <a className={studio.tabLink} href={`/spielbereich?bereich=inventar&character=${encodeURIComponent(active.id || "")}`}>Ausrüstung & Inventar</a>}
      </div>
      {!archived&&(view==="development"||view==="management")&&<CharacterProgression key={active.id} id={active.id!} campaignId={a.campaignId} revision={projection.revision.version} manage={view==="management"} onChanged={()=>{invalidateCharacter();void reload(true,true);onRefresh?.();}}/>}

      {view==="presentation"&&<CharacterProfileEditor key={active.id+":"+projection.revision.version} id={active.id!} version={projection.revision.version} profile={projection.roleplay.profile} canEdit={!archived&&projection.permissions.canEditCompanion===true} onDirtyChange={d=>{presentationDirty.current=d;}} onSaved={()=>{presentationDirty.current=false;invalidateCharacter();void reload(true,true);onRefresh?.();}} backgroundStory={String(projection.roleplay.backgroundStory||"")} playGuide={String(projection.roleplay.playGuide||"")} media={companion.media} requests={(projection.roleplay.connectionRequests as import("./connection-requests").ConnectionRequest[]|undefined)??[]} isOwner={active.owner_id===a.id} connections={<>
            {companion.relationships.length ? (
              <div className="relationship-list">
                {companion.relationships.map((rel) => (
                  <section key={rel.id}>
                    <span className="badge">{rel.type}</span>
                    <h4>{rel.name}</h4>
                    <p>{rel.role || "Bekannte Rolle offen"}</p>
                    <small>
                      {rel.status || "Status offen"}
                      {rel.favor !== null ? ` · Gefallen ${rel.favor}` : ""}
                    </small>
                  </section>
                ))}
              </div>
            ) : (
              <p className="muted">Noch keine erlaubten Beziehungen sichtbar.</p>
            )}
      </>}/>}

      <div className="character-layout" hidden={view!=="sheet"}>
        <section className="character-sheet">
          {hybridPreparationNote()&&readSpecialties({specialties:s.specialties,customAbilities:s.customAbilities}).length>0&&<p className="muted" data-hybrid-preparation>{hybridPreparationNote()}</p>}
          <CharacterSheet identity={projection.identity} sheet={s} progression={projection.progression} layout="wide" withIdentity={false}/>
          {!!s.individualInfo&&<section className="sheet-block"><h3>Individuelle Angaben</h3><p className="preserve-lines">{String(s.individualInfo)}</p></section>}
        </section>


      </div>

      <AlertDialog open={healthResetOpen} onOpenChange={setHealthResetOpen}>
        <AlertDialogContent className={studio.editor}>
          <AlertDialogHeader>
            <AlertDialogTitle>Gesundheit vollständig zurücksetzen?</AlertDialogTitle>
            <AlertDialogDescription>
              Nur der aktuelle vorübergehende Gesundheitszustand wird auf „Gesund“ gesetzt. Permanente Charakterwerte, Blut, Willenskraft und andere Zustände bleiben unverändert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void resetHealth(); }}>
              Auf Gesund setzen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
