"use client";
/* eslint-disable @next/next/no-img-element, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Entry } from "@/domain/legacy";
import type { Actor } from "@/domain/types";
import { RichTextEditor, RichTextView } from "./rich-text";
import { CharacterProgression } from "./character-progression";
import { CharacterLiveVitals } from "./character-live-vitals";
import studio from "./character-studio.module.css";
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
  BookOpen,
  CalendarDays,
  Camera,
  MessageSquareText,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError, api } from "./api-client";
import { describeDataError, invalidatePlayerData, purgeProtectedPlayerData, readPlayerData, requestPlayerData } from "./player-data-cache";
import {
  CharacterCompanionNote,
  CharacterDetailProjection,
  CharacterListReadout,
  Dots,
  RatingGroup,
  attrsGroups,
  skillGroups,
} from "./character";
import { Choice, visibilityNames } from "./shared";
import {activeCharacterBody} from "@/domain/character-selection";
import {useCommandConfirmation} from "./command-confirmation";

const obj = (v: unknown) =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const n = (v: unknown) => (typeof v === "number" ? v : 0);
const text = (v: unknown) => (typeof v === "string" ? v : "");
const mediaLabels: Record<string, string> = {
  portrait: "Portrait",
  reference: "Referenz",
  mood: "Stimmung",
  scene: "Szene",
};

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
  const [view, setView] = useState(initialView);
  const [projectionState, setProjection] = useState<CharacterDetailProjection | null>(
    null,
  );
  const [state, setState] = useState("");
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedCharacterId, setLoadedCharacterId] = useState<string | null>(null);
  const loadVersion = useRef(0);
  const [roleEdit, setRoleEdit] = useState<"story" | "play" | null>(null);
  const [storyDraft, setStoryDraft] = useState("");
  const [playDraft, setPlayDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState<{
    id?: string;
    version?: number;
    title: string;
    text: string;
    visibility: string;
  } | null>(null);
  const [mediaType, setMediaType] = useState("portrait");
  const [mediaVisibility, setMediaVisibility] = useState("private");
  const [companionBusy, setCompanionBusy] = useState(false);
  const [healthResetOpen, setHealthResetOpen] = useState(false);
  const [runtimeBusy, setRuntimeBusy] = useState(false);
  const runtimeLock = useRef(false);
  const portraitInput = useRef<HTMLInputElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const [archiveView,setArchiveView]=useState(false),[archivedId,setArchivedId]=useState<string|null>(null);
  const lifecycleConfirmation=useCommandConfirmation();
  const entries=useMemo(()=>allEntries.filter(e=>archiveView?!activeCharacterBody(e.body):activeCharacterBody(e.body)),[allEntries,archiveView]);
  const selected=archiveView?archivedId:activeCharacterId;
  async function abandonDrafts(){if((roleEdit||noteDraft)&&!await lifecycleConfirmation.ask('Ungespeicherte Texte verwerfen und die Charakteransicht wechseln?'))return false;setRoleEdit(null);setNoteDraft(null);setView('sheet');return true;}
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
    if (!active?.id || roleEdit || noteDraft || companionBusy || runtimeBusy) return;
    let running=false;
    const sync=async()=>{
      if(running||runtimeLock.current||document.visibilityState!=="visible")return;
      running=true;
      try { await reload(true,true); } finally { running=false; }
    };
    window.addEventListener("focus",sync);
    const timer=window.setInterval(()=>void sync(),10000);
    return()=>{window.removeEventListener("focus",sync);window.clearInterval(timer);loadVersion.current+=1;};
  }, [selected, active?.version, roleEdit, noteDraft, companionBusy, runtimeBusy]);

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

  function beginRoleEdit(which: "story" | "play") {
    setStoryDraft(text(projection?.roleplay.backgroundStory));
    setPlayDraft(text(projection?.roleplay.playGuide));
    setRoleEdit(which);
  }

  async function saveRoleplay() {
    if (!active?.id || !projection) return;
    setCompanionBusy(true);
    try {
      await api("/api/character-companion", "PATCH", {
        action: "roleplay",
        id: active.id,
        version: projection.revision.version,
        backgroundStory: storyDraft,
        playGuide: playDraft,
      });
      toast.success("Companion gespeichert");
      setRoleEdit(null);
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

  async function uploadMedia(file: File | undefined, type: string) {
    if (!file || !active?.id || !projection) return;
    setCompanionBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("visibility", mediaVisibility);
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
      if (mediaInput.current) mediaInput.current.value = "";
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

  function editNote(note?: CharacterCompanionNote) {
    setNoteDraft({
      id: note?.id,
      version: note?.version,
      title: note?.title || "",
      text: note?.text || "",
      visibility: note?.visibility || "private",
    });
  }

  async function saveNote() {
    if (!active?.id || !noteDraft) return;
    setCompanionBusy(true);
    try {
      await api("/api/character-companion", "PATCH", {
        action: noteDraft.id ? "note.update" : "note.create",
        characterId: active.id,
        noteId: noteDraft.id,
        version: noteDraft.version,
        title: noteDraft.title,
        text: noteDraft.text,
        visibility: noteDraft.visibility,
      });
      toast.success("Notiz gespeichert");
      setNoteDraft(null);
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

  async function archiveNote(note: CharacterCompanionNote) {
    if (!active?.id) return;
    setCompanionBusy(true);
    try {
      await api("/api/character-companion", "PATCH", {
        action: "note.archive",
        characterId: active.id,
        noteId: note.id,
        version: note.version,
      });
      toast.success("Notiz archiviert");
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
  const will = obj(s.willpower);
  const blood = obj(s.blood);
  const health = obj(s.health);
  const max = n(blood.max);
  const current = n(blood.current);
  const permanent = n(will.permanent);
  const temporary = n(will.temporary);
  const canRuntime = permissions.canChangeRuntimeValues === true;
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
      {archiveNav}{lifecycleConfirmation.dialog}
      {archived&&<p role="status" className="panel">Archivierter Charakter · Daten erhalten · vor Änderungen wiederherstellen.</p>}
      {refreshing && <p className="muted" role="status">Charakterbogen wird aktualisiert …</p>}
      {loadError && <div role="alert" className="error-box"><strong>{describeDataError(loadError).title}</strong><p>{loadError.message}</p><button className="button" onClick={() => void reload(true)}>Erneut versuchen</button></div>}
      <header className="character-hero">
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
        <div className="character-hero-actions">
          {!inspection && !archived && <a className="button" href={`/spielbereich?bereich=inventar&character=${encodeURIComponent(active.id || "")}`}>Ausrüstung & Inventar</a>}
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
              onClick={() => inspection && a.gm ? setView("management") : projection.permissions.sheetEditing === true ? setView("development") : onEdit(active)}
            >
              <Pencil size={16} /> {inspection && a.gm ? "Akte verwalten" : "Bogen bearbeiten"}
            </button>
          )}
          {active.owner_id===a.id&&!inspection&&<button className="button" disabled={companionBusy} onClick={()=>void changeLifecycle(!archived)}>{archived?"Charakter wiederherstellen":"Charakter archivieren"}</button>}
          <details className={studio.heroUtilities}><summary>Weitere Aktionen</summary><div>
          <button className="button" onClick={onCreate}><Plus size={15}/>Neuer Charakter</button>
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
        </div>
      </header>
      <CharacterLiveVitals blood={current} bloodMax={max} bloodPerRound={blood.perRound} willpower={temporary} permanentWillpower={permanent} health={String(health.current || "Gesund")} freeXp={projection.progression.freeXp} totalXp={projection.progression.totalXp} editable={canRuntime} busy={runtimeBusy} status={state} onChange={(field,value)=>void runtime(field,value)} onResetHealth={()=>setHealthResetOpen(true)} onDevelopment={()=>setView("development")}/>
      <nav className={studio.tabs} role="tablist" aria-label="Charakteransicht">
        {[{id:"sheet",label:"V20-Bogen"},{id:"story",label:"Geschichte & Bilder"},{id:"development",label:"Entwicklung"},...(inspection&&a.gm?[{id:"management",label:"Verwaltung"}]:[])].filter(tab=>!archived||!["development","management"].includes(tab.id)).map(tab=><button type="button" role="tab" aria-selected={view===tab.id} key={tab.id} onClick={()=>{if(roleEdit&&view!==tab.id&&!window.confirm("Ungespeicherte Texte bleiben nur während dieses Bearbeitungsvorgangs erhalten. Ansicht wechseln?"))return;setView(tab.id);}}>{tab.label}</button>)}
      </nav>
      {!archived&&(view==="development"||view==="management")&&<CharacterProgression key={active.id} id={active.id!} campaignId={a.campaignId} revision={projection.revision.version} manage={view==="management"} onChanged={()=>{invalidateCharacter();void reload(true,true);onRefresh?.();}}/>}

      <div className="character-layout" hidden={view!=="sheet"}>
        <section className="character-sheet">
          <div className="sheet-heading">
            <p className="eyebrow">V20 CHARACTER SHEET</p>
            <h3>Charakterbogen</h3>
          </div>
          <section className="sheet-block">
            <div className="sheet-block-heading">
              <span>01</span>
              <h3>Attribute</h3>
            </div>
            <div className="sheet-columns attribute-columns">
              {attrsGroups.map(([title, names]) => (
                <RatingGroup
                  key={title}
                  title={title}
                  names={names}
                  values={obj(s.attributes) as Record<string, number>}
                  disabled
                />
              ))}
            </div>
          </section>
          {Object.keys(obj(s.attributes)).some(name=>!attrsGroups.some(([,names])=>(names as readonly string[]).includes(name)))&&<CharacterListReadout label="Weitere gespeicherte Attribute" value={Object.entries(obj(s.attributes)).filter(([name])=>!attrsGroups.some(([,names])=>(names as readonly string[]).includes(name))).map(([name,value])=>({name,value}))}/>}
          <section className="sheet-block">
            <div className="sheet-block-heading">
              <span>02</span>
              <h3>Fähigkeiten</h3>
            </div>
            <div className="sheet-columns ability-columns">
              {skillGroups.map(([title, names]) => (
                <RatingGroup
                  key={title}
                  title={title}
                  names={names}
                  values={obj(s.abilities) as Record<string, number>}
                  disabled
                />
              ))}
              {Object.keys(obj(s.abilities)).some(name=>!skillGroups.some(([,names])=>(names as readonly string[]).includes(name)))&&<CharacterListReadout label="Weitere gespeicherte Fähigkeiten" value={Object.entries(obj(s.abilities)).filter(([name])=>!skillGroups.some(([,names])=>(names as readonly string[]).includes(name))).map(([name,value])=>({name,value}))}/>}
              {((Array.isArray(s.customAbilities) && s.customAbilities.length > 0) || (typeof s.customAbilities === "string" && s.customAbilities.trim())) && <CharacterListReadout label="Freie Fähigkeiten (Legacy)" value={s.customAbilities} />}
            </div>
          </section>
          <section className="sheet-block">
            <div className="sheet-block-heading">
              <span>03</span>
              <h3>Vorteile</h3>
            </div>
            <div className="sheet-columns advantage-columns">
              <div>
                <CharacterListReadout label="Disziplinen" value={s.disciplines} />
                {Array.isArray(s.paths) && s.paths.length > 0 && <CharacterListReadout label="Pfade" value={(s.paths as Array<Record<string, unknown>>).map(row => ({ ...row, name: String(row.name ?? "") + (row.primary === true ? " · Primärpfad" : "") }))} />}
              </div>
              <CharacterListReadout label="Hintergründe" value={s.backgrounds} />
              <RatingGroup
                title="Tugenden"
                names={["Gewissen", "Selbstbeherrschung", "Mut"]}
                values={obj(s.virtues) as Record<string, number>}
                disabled
              />
            </div>
          </section>
          <section className="sheet-block sheet-traits">
            <div className="sheet-block-heading">
              <span>04</span>
              <h3>Vorzüge & Schwächen</h3>
            </div>
            <div className="sheet-columns">
              <CharacterListReadout label="Vorzüge" value={s.merits} metric="cost" />
              <CharacterListReadout label="Schwächen" value={s.flaws} metric="cost" />
              <section className="rating-section">
                <h4>Clansschwäche</h4>
                <p className="muted preserve-lines">
                  {String(s.clanWeakness || "Keine Clansschwäche hinterlegt.")}
                </p>
              </section>
            </div>
          </section>
          <section className="sheet-block">
            <div className="sheet-block-heading">
              <span>05</span>
              <h3>Menschlichkeit, Willenskraft & Blut</h3>
            </div>
            <div className="sheet-columns">
              <section className="rating-section">
                <h4>{String(s.humanityPath || "Menschlichkeit")}</h4>
                {typeof s.humanity === "number" ? <Dots value={s.humanity} max={10} disabled label={String(s.humanityPath || "Menschlichkeit")}/> : <p className="muted">Noch nicht erfasst.</p>}
              </section>
              <section className="rating-section">
                <h4>Willenskraft</h4>
                {permanent > 0 ? <><Dots value={permanent} max={10} disabled label="Willenskraft permanent"/><p className="muted">Aktuell {temporary} von {permanent}</p></> : <p className="muted">Noch nicht erfasst.</p>}
              </section>
              <section className="rating-section">
                <h4>Blutvorrat</h4>
                {max > 0 ? <><p className="sheet-blood" aria-label={`Blutvorrat ${current} von ${max}`}>{Array.from({length:Math.min(max,50)},(_,index)=><span key={index} data-filled={index<current||undefined}/>)}</p><p className="muted">{current} / {max} · pro Runde {String(blood.perRound ?? "–")}</p></> : <p className="muted">Noch nicht erfasst.</p>}
              </section>
            </div>
          </section>
          {!!s.individualInfo&&<section className="sheet-block"><h3>Individuelle Angaben</h3><p className="preserve-lines">{String(s.individualInfo)}</p></section>}
        </section>


      </div>

      <section className="character-companion" hidden={view!=="story"}>
        <div className="companion-column companion-column-left">
          <article className="companion-panel companion-story">
            <header>
              <span className="companion-icon">
                <BookOpen size={18} />
              </span>
              <div>
                <p className="eyebrow">HINTERGRUNDGESCHICHTE</p>
                <h3>Vergangenheit & Antrieb</h3>
              </div>
              {canCompanion && (
                <button className="button" onClick={() => beginRoleEdit("story")}>
                  <Pencil size={15} /> Bearbeiten
                </button>
              )}
            </header>
            {roleEdit === "story" ? (
              <div className="companion-edit">
                <RichTextEditor placeholder="Erzähle die Vergangenheit deiner Figur …" label="Hintergrundgeschichte" value={storyDraft} onChange={setStoryDraft} maximumPlainLength={20000}/>
                <div className="companion-actions">
                  <button className="button primary" disabled={companionBusy} onClick={() => void saveRoleplay()}>
                    <Save size={15} /> Speichern
                  </button>
                  <button className="button" disabled={companionBusy} onClick={() => setRoleEdit(null)}>
                    <X size={15} /> Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <RichTextView value={text(projection.roleplay.backgroundStory) || "Noch keine Hintergrundgeschichte hinterlegt."}/>
            )}
          </article>

          <article className="companion-panel companion-play">
            <header>
              <span className="companion-icon">
                <MessageSquareText size={18} />
              </span>
              <div>
                <p className="eyebrow">SO SPIELE ICH IHN</p>
                <h3>Stimme, Haltung, Reflexe</h3>
              </div>
              {canCompanion && (
                <button className="button" onClick={() => beginRoleEdit("play")}>
                  <Pencil size={15} /> Bearbeiten
                </button>
              )}
            </header>
            {roleEdit === "play" ? (
              <div className="companion-edit">
                <RichTextEditor placeholder="Stimme, Haltung und Ziele …" label="Spielhilfe" value={playDraft} onChange={setPlayDraft} maximumPlainLength={20000}/>
                <div className="companion-actions">
                  <button className="button primary" disabled={companionBusy} onClick={() => void saveRoleplay()}>
                    <Save size={15} /> Speichern
                  </button>
                  <button className="button" disabled={companionBusy} onClick={() => setRoleEdit(null)}>
                    <X size={15} /> Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <RichTextView value={text(projection.roleplay.playGuide) || "Noch keine Spielhilfe hinterlegt."}/>
            )}
          </article>

          <article className="companion-panel companion-notes">
            <header>
              <span className="companion-icon">
                <MessageSquareText size={18} />
              </span>
              <div>
                <p className="eyebrow">AKTUELLE NOTIZEN</p>
                <h3>Privat und geteilt</h3>
              </div>
              {permissions.canCreateNotes === true && (
                <button className="button" onClick={() => editNote()}>
                  <Plus size={15} /> Notiz
                </button>
              )}
            </header>
            {noteDraft && (
              <div className="companion-note-form">
                <label className="field">
                  <span>Titel</span>
                  <input
                    value={noteDraft.title}
                    onChange={(e) => setNoteDraft({ ...noteDraft, title: e.target.value })}
                    maxLength={120}
                  />
                </label>
                <Choice
                  label="Sichtbarkeit"
                  value={noteDraft.visibility}
                  onChange={(value) => setNoteDraft({ ...noteDraft, visibility: value })}
                  options={Object.entries(visibilityNames)}
                />
                <label className="field wide">
                  <span>Notiz</span>
                  <RichTextEditor placeholder="Deine persönliche Aufzeichnung …" label="Persönliches Dokument" value={noteDraft.text} onChange={value=>setNoteDraft({...noteDraft,text:value})} maximumPlainLength={20000}/>
                </label>
                <div className="companion-actions wide">
                  <button className="button primary" disabled={companionBusy || !noteDraft.text.trim()} onClick={() => void saveNote()}>
                    <Save size={15} /> Speichern
                  </button>
                  <button className="button" disabled={companionBusy} onClick={() => setNoteDraft(null)}>
                    <X size={15} /> Abbrechen
                  </button>
                </div>
              </div>
            )}
            <div className="companion-note-list">
              {companion.notes.length ? (
                companion.notes.map((note) => (
                  <section className="companion-note" key={note.id}>
                    <div>
                      <span className="badge">{visibilityNames[note.visibility] || note.visibility}</span>
                      <h4>{note.title}</h4>
                      <RichTextView value={note.text}/>
                      <small>Geändert {new Date(note.updatedAt).toLocaleDateString("de-DE")}</small>
                    </div>
                    {!archived && note.canEdit && (
                      <div className="companion-note-actions">
                        <button className="button" onClick={() => editNote(note)}>
                          <Pencil size={14} /> Bearbeiten
                        </button>
                        <button className="danger-link" onClick={() => void archiveNote(note)}>
                          <Trash2 size={14} /> Archivieren
                        </button>
                      </div>
                    )}
                  </section>
                ))
              ) : (
                <p className="muted">Noch keine Character-Notizen hinterlegt.</p>
              )}
            </div>
          </article>
        </div>

        <div className="companion-column companion-column-right">
          <article className="companion-panel companion-media">
            <header>
              <span className="companion-icon">
                <Camera size={18} />
              </span>
              <div>
                <p className="eyebrow">CHARAKTERBILDER</p>
                <h3>Portrait & Referenzen</h3>
              </div>
            </header>
            {canCompanion && (
              <div className="companion-media-upload">
                <Choice
                  label="Typ"
                  value={mediaType}
                  onChange={setMediaType}
                  options={Object.entries(mediaLabels)}
                />
                <Choice
                  label="Sichtbarkeit"
                  value={mediaVisibility}
                  onChange={setMediaVisibility}
                  options={Object.entries(visibilityNames)}
                />
                <label className="button">
                  <Upload size={15} /> Bild hochladen
                  <input
                    ref={mediaInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={companionBusy}
                    onChange={(e) => void uploadMedia(e.target.files?.[0], mediaType)}
                  />
                </label>
              </div>
            )}
            <div className="companion-media-strip">
              {companion.media.length ? (
                companion.media.map((item) => (
                  <figure key={item.id}>
                    <img src={item.src} alt={item.name} />
                    <figcaption>
                      <span>{mediaLabels[item.type] || item.type}</span>
                      <small>{item.name}</small>
                    </figcaption>
                  </figure>
                ))
              ) : (
                <p className="muted">Noch keine sicheren Charakterbilder verbunden.</p>
              )}
            </div>
          </article>

          <article className="companion-panel companion-relationships">
            <header>
              <span className="companion-icon">
                <Users size={18} />
              </span>
              <div>
                <p className="eyebrow">BEZIEHUNGEN & KONTAKTE</p>
                <h3>Bekannte Verbindungen</h3>
              </div>
            </header>
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
          </article>

          <article className="companion-panel companion-session">
            <header>
              <span className="companion-icon">
                <CalendarDays size={18} />
              </span>
              <div>
                <p className="eyebrow">LETZTE SITZUNG</p>
                <h3>Kontext für die nächste Nacht</h3>
              </div>
            </header>
            {companion.lastSession ? (
              <div className="last-session-card">
                <span className="date-label">{companion.lastSession.date || "Datum offen"}</span>
                <h4>{companion.lastSession.title}</h4>
                <p>{companion.lastSession.summary || "Keine player-sichere Zusammenfassung hinterlegt."}</p>
              </div>
            ) : (
              <p className="muted">Noch kein freigegebener Sitzungskontext vorhanden.</p>
            )}
          </article>
        </div>
      </section>
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
