"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {PreparationRecipient} from "@/domain/personal-message";
import {PreparationPanel} from "./preparation-panel";
import panel from "./preparation-panel.module.css";
import type { Actor } from "@/domain/types";
import {
  emptyStory,
  storyDocumentSchema,
  type StoryDocument,
  type StoryView,
  type CommandReference,
} from "@/domain/command-workspace";
import {
  emptyScene,
  type SceneDocument,
  type SceneView,
  type SceneSummary,
} from "@/domain/story-scene";
import {
  sessionPreparationSchema,
  type SessionPreparation,
  type PreparedSession,
} from "@/domain/story-preparation";
import { RichTextEditor } from "./rich-text";
import { PreparationPicker } from "./preparation-picker";
import { preparationPlaces, isCentralPreparationPlace } from "./preparation-catalog";
import { useCommandConfirmation } from "./command-confirmation";
import s from "./story-workspace.module.css";
import { SessionOverview, SessionList } from "./session-overview";
import { Info, Maximize2, Minimize2, ArrowLeftRight, FolderCog, Archive, Trash2, Plus, List } from "lucide-react";
import { PreparationWhispers } from "./preparation-whispers";
import { PreparationNPCs } from "./preparation-npcs";
import { PreparationMaterials } from "./preparation-materials";
import { SceneBackdropPicker } from "./preparation-upload";
import { PreparationGuide } from "./preparation-guide";
import { sessionGuideSteps, sceneGuideSteps, sessionStep, sceneStep, type SessionGuideStep } from "@/domain/preparation-guide";
import { orderedSessionScenes } from "@/domain/session-overview";
type Kind = "story" | "session" | "scene";
type Document = StoryDocument | SessionPreparation | SceneDocument;
type Selection = {
  kind: Kind;
  id: string;
  version: number;
  document: Document;
};
type StorySummary = {
  id: string;
  title: string;
  updatedAt: string;
  favorite: boolean;
  pinned: boolean;
  searchText: string;
  status: StoryDocument["status"];
};
const endpoint = (kind: Kind) =>
  "/api/command-center/" +
  (kind === "session" ? "preparation" : kind === "scene" ? "scenes" : "story");
type Reply = {
  error?: string;
  message?: string;
  places: { id: string; title: string; parent_id?:string|null; level?:string }[];
  stories: StorySummary[];
  sessions: PreparedSession[];
  scenes: SceneSummary[];
  references: CommandReference[];
  recipients?:PreparationRecipient[];
  files: { id: string; name: string; mime: string }[];
  story: StoryView;
  scene: SceneView;
  session: PreparedSession;
};
async function request(path: string, body?: unknown) {
  const r = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = (await r.json()) as Reply;
  if (!r.ok)
    throw new Error(
      (r.status === 409 ? "Konflikt: " : "") +
        (d.error || d.message || "Anfrage fehlgeschlagen."),
    );
  return d;
}
function selection(
  kind: Kind,
  value: StoryView | SceneView | PreparedSession,
): Selection {
  if (kind === "story") {
    const v = value as StoryView;
    return {
      kind,
      id: v.id,
      version: v.version,
      document: storyDocumentSchema.parse({
        title: v.title,
        summary: v.summary,
        status: v.status,
        favorite: v.favorite,
        pinned: v.pinned,
        sections: v.sections,
        references: v.references,
        possibilities: v.possibilities,
      }),
    };
  }
  const v = value as SceneView | PreparedSession;
  return { kind, id: v.id, version: v.version, document: v.document };
}
export function StoryWorkspace({ a, onDirty }: { a: Actor; onDirty?: (dirty:boolean)=>void }) {
  const [stories, setStories] = useState<StorySummary[]>([]),
    [sessions, setSessions] = useState<PreparedSession[]>([]),
    [scenes, setScenes] = useState<SceneSummary[]>([]),
    [refs, setRefs] = useState<CommandReference[]>([]),
    [files, setFiles] = useState<{ id: string; name: string; mime: string }[]>(
      [],
    );
  const [players,setPlayers]=useState<PreparationRecipient[]>([]);
  const [sessionEditing,setSessionEditing]=useState(false), [returnSession,setReturnSession]=useState("");
  const [guideStep,setGuideStep]=useState<SessionGuideStep>("basics"), [returnGuide,setReturnGuide]=useState(false);
  const [expandedEditor,setExpandedEditor]=useState<string|null>(null);
  const [helpEditor,setHelpEditor]=useState<string|null>(null);
  const [headerPanel,setHeaderPanel]=useState<"switch"|"actions"|null>(null);
  const [current, setCurrent] = useState<Selection | null>(null),
    [saved, setSaved] = useState(""),
    [message, setMessage] = useState("Lade Arbeitsbestand …"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [section, setSection] = useState("background"),
    [recent, setRecent] = useState<string[]>([]),
    [elementFocus, setElementFocus] = useState(""),
    [recentReady, setRecentReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [unlinkDraft, setUnlinkDraft] = useState<{sessionId:string;ids:string[]}|null>(null);
  const activeUrl = useRef("");
  const latest = useRef(current),
    baseline = useRef(saved),
    inflight = useRef(false),
    generation = useRef(0),
    pendingUnlinks = useRef<string[]>([]);
  useLayoutEffect(() => {
    latest.current = current;
    baseline.current = saved;
    pendingUnlinks.current = current?.kind === "session" && unlinkDraft?.sessionId === current.id ? unlinkDraft.ids : [];
  }, [current, saved, unlinkDraft]);
  const recentKey = "chroniplay-story-recent:" + a.campaignId + ":" + a.id;
  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const ids = JSON.parse(
          localStorage.getItem(recentKey) || "[]",
        ) as unknown;
        if (Array.isArray(ids))
          setRecent(
            ids
              .filter(
                (v): v is string => typeof v === "string" && v.length <= 100,
              )
              .slice(0, 12),
          );
      } catch {}
      setRecentReady(true);
    });
  }, [recentKey]);
  useEffect(() => {
    if (recentReady)
      try {
        localStorage.setItem(recentKey, JSON.stringify(recent));
      } catch {}
  }, [recent, recentKey, recentReady]);
  const confirmation = useCommandConfirmation();
  const refresh = useCallback(async () => {
    const [catalog, prep, media, people] = await Promise.all([
      request("/api/command-center"),
      request("/api/command-center/preparation"),
      request("/api/files"),
      request("/api/messages?recipients=1&context=preparation"),
    ]);
    setStories(catalog.stories);
    setScenes(catalog.scenes);
    setRefs([
      ...catalog.references.filter((r) => r.type !== "PLACE"),
      ...preparationPlaces(prep.places),
    ]);
    setSessions(prep.sessions);
    setFiles(media.files || []);
    setPlayers((people.recipients||[]).filter(person=>person.role==="player"));
  }, []);
  useEffect(() => {
    Promise.resolve()
      .then(refresh)
      .then(async () => {
        setMessage("Arbeitsbestand geladen. Nur für die Spielleitung.");
        const route = new URL(window.location.href);
        if(!route.searchParams.has("bereich")){route.searchParams.set("bereich","sitzung");window.history.replaceState(null,"",route);}
        activeUrl.current = window.location.pathname + window.location.search;
        const q = new URLSearchParams(window.location.search);
        setSessionEditing(q.get("edit") === "1");
        setGuideStep(sessionStep(q.get("step")));
        setReturnGuide(q.get("returnGuide")==="1");
        setReturnSession(q.get("fromSession") || "");
        for (const kind of ["story", "session", "scene"] as const) {
          const id = q.get(kind);
          if (id) {
            const data = await request(
              endpoint(kind) + "?id=" + encodeURIComponent(id),
            );
            const next = selection(kind, data[kind]);
            setCurrent(next);
            setSaved(JSON.stringify(next.document));
            setSection(kind === "scene" ? sceneStep(q.get("section")) : "background");
            break;
          }
        }
      })
      .catch((e) => setMessage(e.message));
  }, [refresh]);
  useEffect(() => {
    if (!elementFocus) return;
    const frame = requestAnimationFrame(() =>
      document
        .getElementById("story-element-" + elementFocus)
        ?.scrollIntoView({ block: "center" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [elementFocus, current?.id]);
  const unlinkedIds = current?.kind === "session" && unlinkDraft?.sessionId === current.id ? unlinkDraft.ids : [];
  const dirty = !!current && (JSON.stringify(current.document) !== saved || unlinkedIds.length > 0);
  useEffect(()=>{onDirty?.(dirty);return()=>onDirty?.(false);},[dirty,onDirty]);
  const accept = (next: Selection, fromSession = "", editing = false, historyMode: "push" | "replace" | "none" = "push", resumeGuide=false, targetStep:SessionGuideStep="basics") => {
    if(historyMode !== "none") window.history[historyMode === "push" ? "pushState" : "replaceState"](
      null, "", "/sl/command-center?bereich=sitzung&" + next.kind + "=" + encodeURIComponent(next.id) + (fromSession ? "&fromSession=" + encodeURIComponent(fromSession) : "") + (editing ? "&edit=1&step="+targetStep : "") + (resumeGuide ? "&returnGuide=1" : ""),
    );
    activeUrl.current=window.location.pathname+window.location.search;
    setHeaderPanel(null);
    setReturnSession(fromSession);
    setSessionEditing(editing);
    setGuideStep(targetStep);
    setReturnGuide(resumeGuide);
    setExpandedEditor(null);
    setUnlinkDraft(null);
    setCurrent(next);
    setSaved(JSON.stringify(next.document));
    setRecent((old) =>
      [next.id, ...old.filter((id) => id !== next.id)].slice(0, 12),
    );
  };
  const save = useCallback(async () => {
    const start = latest.current;
    const removed = [...pendingUnlinks.current];
    if (!start || inflight.current) return false;
    if (JSON.stringify(start.document) === baseline.current && removed.length === 0) return true;
    inflight.current = true;
    setBusy(true);
    setMessage("Speichert …");
    const token = generation.current;
    try {
      const data = await request(endpoint(start.kind), {
        action: "save",
        id: start.id,
        version: start.version,
        document: start.document,
        ...(start.kind === "session" && removed.length ? { unlinkSceneIds: removed } : {}),
      });
      const next = selection(start.kind, data[start.kind]);
      if (token === generation.current) {
        setSaved(JSON.stringify(next.document));
        setCurrent((value) =>
          value?.id === start.id ? { ...value, version: next.version, document: JSON.stringify(value.document)===JSON.stringify(start.document) ? next.document : value.document } : value,
        );
        setUnlinkDraft((value) => {
          if (!value || value.sessionId !== start.id) return value;
          const remaining = value.ids.filter((id) => !removed.includes(id));
          return remaining.length ? { ...value, ids: remaining } : null;
        });
        setMessage(
          JSON.stringify(latest.current?.document) !==
            JSON.stringify(start.document) || pendingUnlinks.current.some((id) => !removed.includes(id))
            ? "Ungespeicherte Änderungen · automatische Speicherung folgt"
            : "Gespeichert · " + new Date().toLocaleTimeString("de-DE"),
        );
        await refresh();
        return true;
      }
      return false;
    } catch (e) {
      setMessage((e as Error).message + " Deine Eingaben bleiben im Editor.");
      return false;
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }, [refresh]);
  useEffect(() => {
    if (!dirty || busy || !message.startsWith("Ungespeicherte")) return;
    const timer = setTimeout(() => void save(), 1800);
    return () => clearTimeout(timer);
  }, [dirty, busy, current, save, message]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (
        latest.current &&
        (JSON.stringify(latest.current.document) !== baseline.current || pendingUnlinks.current.length > 0)
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  async function leave() {
    // Navigation must not silently drop a click while an autosave finishes.
    if (inflight.current) {
      for (let attempt = 0; inflight.current && attempt < 150; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (inflight.current) {
        setMessage("Speicherung läuft noch. Bitte die aktuelle Akte geöffnet lassen.");
        return false;
      }
      // Let React commit the version/document returned by the completed save.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const latestDraft = latest.current;
    const pending = !!latestDraft &&
      (JSON.stringify(latestDraft.document) !== baseline.current || pendingUnlinks.current.length > 0);
    return !pending || (await confirmation.ask(
      "Ungespeicherte Änderungen verwerfen und die andere Akte öffnen?",
    ));
  }
  async function showSessionList() {
    if(!(await leave())) return;
    setHeaderPanel(null);
    generation.current++; setCurrent(null); setSaved(""); setReturnSession(""); setSessionEditing(false); setUnlinkDraft(null); setExpandedEditor(null);
    window.history.pushState(null,"","/sl/command-center?bereich=sitzung");
    activeUrl.current=window.location.pathname+window.location.search;
  }
  async function open(kind: Kind, id: string, fromSession = "", historyMode: "push" | "replace" | "none" = "push", editing = false, resumeGuide=false, targetStep:SessionGuideStep="basics", targetSection="narration") {
    if (!(await leave())) return false;
    const token = ++generation.current;
    try {
      const data = await request(
        endpoint(kind) + "?id=" + encodeURIComponent(id),
      );
      if (token !== generation.current) return;
      accept(selection(kind, data[kind]), fromSession, editing, historyMode, resumeGuide, targetStep);
      setSection(kind === "scene" ? sceneStep(targetSection) : "background");
      if(kind==="scene"){const url=new URL(window.location.href);url.searchParams.set("section",sceneStep(targetSection));window.history.replaceState(null,"",url);activeUrl.current=url.pathname+url.search;}
      setMessage("Geladen · private Vorbereitung");
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    }
  }
  const routeHandler = useRef<()=>void>(()=>{});
  useEffect(()=>{
    routeHandler.current=()=>{
      const q=new URLSearchParams(window.location.search);
      const kind=(["story","session","scene"] as const).find(key=>q.get(key));
      if(kind) void open(kind,q.get(kind)!,q.get("fromSession")||"","replace",q.get("edit")==="1",q.get("returnGuide")==="1",sessionStep(q.get("step")),sceneStep(q.get("section"))).then(ok=>{if(ok===false&&activeUrl.current)window.history.replaceState(null,"",activeUrl.current);});
      else void leave().then(allowed=>{if(allowed){generation.current++;setCurrent(null);setSaved("");setReturnSession("");setSessionEditing(false);activeUrl.current=window.location.pathname+window.location.search;}else if(activeUrl.current)window.history.replaceState(null,"",activeUrl.current);});
    };
  });
  useEffect(()=>{const handler=()=>routeHandler.current();window.addEventListener("popstate",handler);return()=>window.removeEventListener("popstate",handler);},[]);
  async function changeGuideStep(next:string, kind:"session"|"scene") {
    if(inflight.current || !latest.current) return;
    const identity=latest.current.id;
    if(!(await save()) || latest.current?.id!==identity) return;
    const url=new URL(window.location.href);
    if(kind==="session") { const value=sessionStep(next);setGuideStep(value);url.searchParams.set("step",value); }
    else { const value=sceneStep(next);setSection(value);url.searchParams.set("section",value); }
    setExpandedEditor(null);
    window.history.replaceState(null,"",url);activeUrl.current=url.pathname+url.search;
  }
  async function finishGuide(kind:"session"|"scene") {
    if(inflight.current || !(await save())) return;
    await new Promise(resolve=>setTimeout(resolve,0));
    if(kind==="session" && latest.current) await open("session",latest.current.id);
    else if(returnSession) await open("session",returnSession,"","push",returnGuide,false,"scenes");
    else await showSessionList();
  }
  async function backToSession() {
    if(!(await save())) return;
    await new Promise(resolve=>setTimeout(resolve,0));
    await open("session",returnSession,"","push",returnGuide,false,"scenes");
  }
  async function create(kind: Kind, child = false, unlinked = false) {
    if (!(await leave())) return;
    generation.current++;
    inflight.current = true;
    setBusy(true);
    setMessage("Legt neue Akte an …");
    let doc: Document;
    const fromSession=kind==="scene"&&!unlinked ? (current?.kind==="session" ? current.id : returnSession) : "";
    if (kind === "story") doc = emptyStory();
    else if (kind === "session")
      doc = sessionPreparationSchema.parse({ title: "Neuer Spielabend" });
    else {
      doc = emptyScene(
        !unlinked && current?.kind === "story"
          ? current.id
          : !unlinked && current?.kind === "scene"
            ? (current.document as SceneDocument).storyId
            : "",
      );

      if(fromSession)doc.sessionIds=[fromSession];
      if (child && current?.kind === "scene") {
        doc.parentId = current.id;

      }
    }
    try {
      const result = await request(endpoint(kind), {
        action: "create",
        clientRequestId: crypto.randomUUID(),
        document: doc,
      });
      let linkOk=true;
      if(kind==="scene"&&fromSession){
        try{
          const linkedSession=(await request(endpoint("session")+"?id="+encodeURIComponent(fromSession))).session;
          if(!linkedSession.document.sceneIds.includes(result.scene.id)){
            await request(endpoint("session"),{
              action:"save",id:linkedSession.id,version:linkedSession.version,
              document:{...linkedSession.document,sceneIds:[...linkedSession.document.sceneIds,result.scene.id]},
            });
          }
        }catch{linkOk=false;} // Scene remains saved; no existing content is removed.
      }
      accept(selection(kind,result[kind]), fromSession, kind === "session", "push", kind==="scene"&&!!fromSession&&(sessionEditing||returnGuide));
      setSection(kind==="scene"?"narration":"background");
      setMessage(kind==="scene"&&fromSession
        ?linkOk?"Szene für diesen Spielabend angelegt · nur SL":"Szene gespeichert, aber Zuordnung zum Spielabend prüfen."
        :"Neu angelegt · noch keine Veröffentlichung");
      await refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }
  async function moveScene(id: string, direction: number) {
    if (!current || current.kind !== "session" || busy || dirty || inflight.current) return;
    const start = current;
    const document = start.document as SessionPreparation;
    const ids = orderedSessionScenes(start.id,document,scenes).map(scene=>scene.id);
    const index = ids.indexOf(id), target = index + direction;
    if(index < 0 || target < 0 || target >= ids.length) return;
    [ids[index],ids[target]]=[ids[target],ids[index]];
    const missing = document.sceneIds.filter(id=>!ids.includes(id));
    inflight.current=true;setBusy(true);setMessage("Speichert Reihenfolge …");
    try {
      const result=await request(endpoint("session"),{action:"save",id:start.id,version:start.version,document:{...document,sceneIds:[...ids,...missing]}});
      accept(selection("session",result.session),"",sessionEditing,"replace",false,guideStep);
      await refresh();setMessage("Reihenfolge gespeichert · nur SL");
    } catch(error) {setMessage((error as Error).message+" Die bisherige Reihenfolge bleibt erhalten.");}
    finally {inflight.current=false;setBusy(false);}
  }
  async function toggleSessionFlag(id:string,key:"favorite"|"pinned") {
    if(inflight.current||dirty)return;
    const evening=sessions.find(item=>item.id===id);if(!evening)return;
    inflight.current=true;setBusy(true);
    try {
      const result=await request(endpoint("session"),{action:"save",id,version:evening.version,document:{...evening.document,[key]:!evening.document[key]}});
      if(latest.current?.kind==="session"&&latest.current.id===id){const next=selection("session",result.session);setCurrent(next);setSaved(JSON.stringify(next.document));}
      await refresh();setMessage("Spielabend-Markierung gespeichert.");
    }catch(error){setMessage((error as Error).message);}finally{inflight.current=false;setBusy(false);}
  }
  function change(patch: Partial<Document>) {
    setCurrent((c) =>
      c ? { ...c, document: { ...c.document, ...patch } as Document } : c,
    );
    setMessage("Ungespeicherte Änderungen · automatische Speicherung folgt");
  }
  function matches(v: {
    id: string;
    title: string;
    favorite?: boolean;
    pinned?: boolean;
    searchText?: string;
    status?: string;
    archived?: boolean;
  }) {
    const archived = v.archived || v.status === "archived";
    return (
      (filter === "archive" ? archived : !archived) &&
      (!search ||
        (v.title + " " + (v.searchText || ""))
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (filter === "archive" || filter === "all" ||
        (filter === "favorite" && v.favorite) ||
        (filter === "pinned" && v.pinned) ||
        (filter === "recent" && recent.includes(v.id)))
    );
  }
  const doc = current?.document,
    story = current?.kind === "story" ? (doc as StoryDocument) : null,
    scene = current?.kind === "scene" ? (doc as SceneDocument) : null,
    session = current?.kind === "session" ? (doc as SessionPreparation) : null;
  const guided = current?.kind === "scene" || (current?.kind === "session" && sessionEditing);
  const sessionSceneValues = session && current ? [...new Set([
    ...session.sceneIds,
    ...scenes.filter((item) => item.sessionIds.includes(current.id)).map((item) => item.id),
  ])].filter((id) => !unlinkedIds.includes(id)) : [];
  const labels: Record<string, string> = story
    ? {
        background: "Geschichte",
        core: "Roter Faden / Konflikt",
        secrets: "Geheimnisse",
        clues: "Hinweise",
        consequences: "Mögliche Folgen",
        notes: "SL-Notizen",
      }
    : {
        narration: "Erzählung",
        atmosphere: "Atmosphäre",
        gmNotes: "SL-Notizen",
        dialogueNotes: "Dialoge",
        interactions: "Interaktion",
        secrets: "Geheimnisse",
        visions: "Visionen",
        possibleConsequences: "Mögliche Folgen",
      };
  const text = story
    ? story.sections[section as keyof StoryDocument["sections"]] || ""
    : scene
      ? (scene[section as keyof SceneDocument] as string) || ""
      : session?.notes || "";
  const editor=(value:string,onChange:(v:string)=>void,label:string,key:string)=>(
    <div key={key} className={`${zFull(key)}`}
      onKeyDown={e=>{if(e.key==="Escape"&&expandedEditor===key)setExpandedEditor(null);}}>
      <div className={s.editorBar}>
        <strong>{label}</strong><div>
        <button type="button" aria-label="HTML-Hilfe" aria-expanded={helpEditor===key} onClick={()=>setHelpEditor(helpEditor===key?null:key)}><Info size={17} aria-hidden="true"/></button>
        <button type="button" aria-label={expandedEditor===key?"Vollbild schließen":"Editor vergrößern"} aria-pressed={expandedEditor===key} onClick={()=>setExpandedEditor(expandedEditor===key?null:key)}>{expandedEditor===key?<Minimize2 size={17} aria-hidden="true"/>:<Maximize2 size={17} aria-hidden="true"/>}</button>
        </div>
      </div>
      {helpEditor===key&&<aside className={s.htmlHelp} aria-label="HTML-Hilfe"><h3>Text und HTML gestalten</h3><p>Schreibe direkt im visuellen Editor oder füge im HTML-Quelltext formatierten Text ein. Vorschau zeigt die spätere Darstellung, ohne etwas zu veröffentlichen.</p><p>Nutze h2/h3 für Überschriften, p für Absätze und ul/li für Listen. Tabellen: table, tr, th und td. Fett: strong, kursiv: em. Lass Text automatisch umbrechen; vermeide br-Ketten und feste Breiten.</p><p>Formatvorlagen: cp-intro für Einleitungen, cp-highlight für Hervorhebungen, cp-note für Hinweise, cp-divider für Trennungen.</p><pre>{'<h2>Überschrift</h2>\n<p class="cp-intro">Ein erster Eindruck.</p>\n<p>Ein zusammenhängender Absatz.</p>\n<ul><li>Ein Hinweis</li></ul>'}</pre><p>Bis 10.000 sichtbare Zeichen. HTML wird sicher aufbereitet; Skripte und externe Einbettungen werden nicht übernommen. Bilder wählst du über die Galerie. Dein Entwurf wird automatisch gespeichert. Weiter speichert zusätzlich vor dem Schrittwechsel; nichts davon veröffentlicht Inhalte.</p></aside>}
      <RichTextEditor value={value} onChange={onChange} label={label}
        maximumPlainLength={10000}
        placeholder="Deine private Vorbereitung …" advanced htmlSource compactTools preparationTools files={files}/>
    </div>
  );
  function zFull(key:string){return s.editorFrame+" "+(expandedEditor===key?s.expandedEditor:"");}
  const pick = (
    label: string,
    values: string[],
    options: { id: string; title: string }[],
    update: (ids: string[]) => void,
  ) => (
    <PreparationPicker label={label} values={values} options={options} onChange={update}/>
  );
  async function toggleArchive() {
    if (!current || inflight.current) return;
    const token = generation.current;
    const start = current;
    const archived = start.kind === "scene" ? (start.document as SceneDocument).archived : (start.document as StoryDocument | SessionPreparation).status === "archived";
    if (!(await confirmation.ask(archived ? "Diese Akte wieder in den Arbeitsbestand aufnehmen?" : "Diese Akte archivieren? Inhalte, verknüpfte Akten und Spielverlauf bleiben erhalten. Bestehende Spielerfreigaben werden dadurch nicht zurückgezogen."))) return;
    if (inflight.current || generation.current !== token || latest.current?.id !== start.id) return;
    if (latest.current.version !== start.version || JSON.stringify(latest.current.document) !== JSON.stringify(start.document)) { setMessage("Der Entwurf hat sich während der Bestätigung geändert. Bitte erneut archivieren."); return; }
    inflight.current = true; setBusy(true);
    try {
      const document = start.kind === "scene" ? { ...start.document, archived: !archived } : { ...start.document, status: archived ? "draft" : "archived" };
      const data = await request(endpoint(start.kind), { action: "save", id: start.id, version: start.version, document });
      accept(selection(start.kind, data[start.kind]));
      setFilter(archived ? "all" : "archive");
      setMessage(archived ? "Wieder im Arbeitsbestand · gespeichert" : "Archiviert · gespeichert. Im Archiv wiederherstellbar.");
      await refresh();
    } catch (e) { setMessage((e as Error).message + " Deine Eingaben bleiben im Editor."); }
    finally { inflight.current = false; setBusy(false); }
  }
  async function deleteCurrent() {
    const start = latest.current;
    if (!start || inflight.current) return;
    const token = generation.current;
    const name = start.kind === "session" ? "Spielabend" : start.kind === "scene" ? "Szene" : "Handlungsstrang";
    const unsaved = JSON.stringify(start.document) !== baseline.current || pendingUnlinks.current.length > 0;
    if (!(await confirmation.ask(`${name} „${start.document.title}“ endgültig löschen?${unsaved ? " Ungespeicherte Änderungen gehen verloren." : ""} Verknüpfungen zu dieser Akte und ihre Freigaben werden entfernt; andere Akten und Dateien bleiben erhalten.${start.kind === "session" ? " Ein laufender Spielabend wird beendet." : ""}${start.kind === "scene" ? " Eine gerade ausgespielte Szene wird ausgeblendet." : ""} Interne Protokolle bleiben erhalten und können ältere Inhalte enthalten.`))) return;
    if (inflight.current || generation.current !== token || latest.current?.id !== start.id) return;
    if (latest.current.version !== start.version || JSON.stringify(latest.current.document) !== JSON.stringify(start.document)) {
      setMessage("Die Akte hat sich während der Bestätigung geändert. Bitte erneut prüfen.");
      return;
    }
    inflight.current = true;
    setBusy(true);
    try {
      await request(endpoint(start.kind), { action: "delete", id: start.id, version: start.version });
      generation.current++;
      latest.current = null;
      baseline.current = "";
      pendingUnlinks.current = [];
      setCurrent(null);
      setSaved("");
      setUnlinkDraft(null);
      setExpandedEditor(null);
        setRecent((old) => old.filter((id) => id !== start.id));
      window.history.replaceState(null, "", "/sl/command-center");
      try { await refresh(); setMessage(`${name} gelöscht.`); }
      catch { setMessage(`${name} gelöscht. Die Übersicht konnte nicht aktualisiert werden; bitte neu laden.`); }
    } catch (e) {
      setMessage((e as Error).message + " Die Akte bleibt erhalten.");
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }
  function tree(parent: string, storyId: string, depth = 0): React.ReactNode {
    if (depth > 20) return null;
    return scenes
      .filter((v) => v.parentId === parent && v.storyId === storyId && matches(v) &&
        (storyId !== "" || parent !== "" || (!v.sessionIds.length && !sessions.some((item) => item.document.sceneIds.includes(v.id)))))
      .map((v) => (
        <div key={v.id} style={{ paddingLeft: depth ? 12 : 0 }}>
          <button
            className={current?.id === v.id ? s.selected : ""}
            onClick={() => void open("scene", v.id)}
          >
            ◇ {v.title}
            {v.pinned ? " · angeheftet" : ""}
          </button>
          {v.elements?.map((e) => (
            <button
              key={e.id}
              onClick={async () => {
                await open("scene", v.id);
                setElementFocus(e.id);
              }}
            >
              ↳ {e.title}
            </button>
          ))}
          {tree(v.id, storyId, depth + 1)}
        </div>
      ));
  }
  return (
    <div className={s.workspace}>
      {confirmation.dialog}
      {!guided&&<header className={s.top}>
        <div>
          <h1>Spielabend & Story</h1>
          {!guided&&<p>Beginne mit einem Spielabend und bereite dort deine Schauplätze und Szenen vor.</p>}
        </div>
      </header>}
      <div className={s.columns}>
        {!guided&&<section className={s.centralControls} aria-label="Vorbereitungsaktionen">
          <div className={s.controlBar}>
          {current && <button type="button" disabled={busy} onClick={()=>void showSessionList()}>Zurück zu allen Spielabenden</button>}
          {current && <label>Spielabend auswählen<select aria-label="Spielabend auswählen" value={current.kind === "session" ? current.id : returnSession} onChange={e=>e.target.value ? void open("session",e.target.value) : void showSessionList()}>
            <option value="">Alle Spielabende</option>
            {sessions.map(value=><option key={value.id} value={value.id}>{value.document.title}</option>)}
          </select></label>}
          {!guided&&<>
          <input
            aria-label="Storys, Sitzungen und Szenen suchen"
            placeholder="Suchen …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Vorbereitung filtern"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Aktive Akten</option>
            <option value="archive">Archiv</option>
            <option value="favorite">Favoriten</option>
            <option value="pinned">Angeheftet</option>
            <option value="recent">Zuletzt geöffnet</option>
          </select>
          <button disabled={busy} onClick={()=>void create("session")}>+ Spielabend anlegen</button>
          </>}
          </div>

        </section>}
        {guided&&current&&<header className={s.compactHeader} aria-label="Planungsleiste">
          <div className={s.compactIdentity}><button type="button" disabled={busy} onClick={()=>scene&&returnSession?void backToSession():session?void open("session",current.id):void showSessionList()}>{scene&&returnSession?"Zurück zum Spielabend":session?"Zur Spielabendübersicht":"Zurück zu allen Spielabenden"}</button><h1>{scene?"Szene vorbereiten":"Spielabend planen"}</h1></div>
          <div className={s.compactActions}>
            <PreparationPanel label="Wechseln" icon={<ArrowLeftRight size={16} aria-hidden="true"/>} open={headerPanel==="switch"} onOpenChange={open=>setHeaderPanel(value=>open?"switch":value==="switch"?null:value)}>
              <label>Spielabend auswählen<select aria-label="Spielabend auswählen" value={current.kind==="session"?current.id:returnSession} onChange={e=>{setHeaderPanel(null);if(e.target.value)void open("session",e.target.value);else void showSessionList();}}><option value="">Alle Spielabende</option>{sessions.map(item=><option key={item.id} value={item.id}>{item.document.title}</option>)}</select></label>
              {scene&&returnSession&&<label>Weitere Szene öffnen<select aria-label="Weitere Szene dieses Spielabends" value={current.id} onChange={e=>{setHeaderPanel(null);void open("scene",e.target.value,returnSession,"push",false,returnGuide);}}>{scenes.filter(item=>item.id===current.id||item.sessionIds.includes(returnSession)||sessions.find(value=>value.id===returnSession)?.document.sceneIds.includes(item.id)).map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
              <div className={panel.actions}>{scene&&returnSession&&<button disabled={busy} onClick={()=>{setHeaderPanel(null);void create("scene");}}><Plus size={16} aria-hidden="true"/>Neue Szene im Spielabend</button>}<button disabled={busy} onClick={()=>{setHeaderPanel(null);void showSessionList();}}><List size={16} aria-hidden="true"/>Alle Spielabende</button></div>
            </PreparationPanel>
            <PreparationPanel label="Aktenaktionen" icon={<FolderCog size={16} aria-hidden="true"/>} open={headerPanel==="actions"} onOpenChange={open=>setHeaderPanel(value=>open?"actions":value==="actions"?null:value)}>
              <p>Diese Aktionen betreffen {scene?"die aktuelle Szene":"den aktuellen Spielabend"}.</p><div className={panel.actions}><button disabled={busy} onClick={()=>{setHeaderPanel(null);void toggleArchive();}}><Archive size={16} aria-hidden="true"/>{scene?.archived||session?.status==="archived"?"Aus Archiv wiederherstellen":"Archivieren"}</button><button type="button" className={panel.danger} disabled={busy} onClick={()=>{setHeaderPanel(null);void deleteCurrent();}}><Trash2 size={16} aria-hidden="true"/>{scene?"Szene":"Spielabend"} löschen</button></div>
            </PreparationPanel>
            <button disabled={busy||!dirty} onClick={()=>void save()}>Jetzt speichern</button>
          </div>
          <span role="status" className={s.compactStatus}>{message}</span>{message.startsWith("Konflikt:")&&<button onClick={()=>void open(current.kind,current.id)}>Aktuellen Serverstand laden</button>}
        </header>}
        <main className={s.main}>
          {!guided && current?.kind === "scene" && returnSession && <div className={s.overviewNavigation}>
            <button disabled={busy} onClick={()=>void backToSession()}>Zurück zum Spielabend</button>
            <label>Weitere Szene öffnen<select aria-label="Weitere Szene dieses Spielabends" value={current.id} onChange={e=>void open("scene",e.target.value,returnSession,"push",false,returnGuide)}>
              {scenes.filter(item=>item.id===current.id || item.sessionIds.includes(returnSession) || sessions.find(value=>value.id===returnSession)?.document.sceneIds.includes(item.id)).map(item=><option key={item.id} value={item.id}>{item.title}</option>)}
            </select></label>
            <button disabled={busy} onClick={()=>void create("scene")}>Neue Szene im Spielabend</button>
          </div>}
          {current && session && !sessionEditing ? <SessionOverview onFlag={(key)=>void toggleSessionFlag(current.id,key)} session={{id:current.id,version:current.version,updatedAt:"",document:session}} scenes={scenes} references={refs} files={files} busy={busy || dirty} message={message}
            onEdit={()=>{setSessionEditing(true);setGuideStep("basics");window.history.pushState(null,"","/sl/command-center?bereich=sitzung&session="+encodeURIComponent(current.id)+"&edit=1");activeUrl.current=window.location.pathname+window.location.search;}}
            onScene={id=>void open("scene",id,current.id)} onCreate={()=>void create("scene")} onMove={(id,direction)=>void moveScene(id,direction)}/>
          : current && doc ? (
            <>
              {!guided&&<div className={s.savebar}>
                {session && <button disabled={busy} onClick={()=>void open("session",current.id)}>Zur Spielabendübersicht</button>}
                <span role="status">{message}</span>
                <details className={s.saveActions}><summary>Aktenaktionen</summary>
                <button disabled={busy} onClick={() => void toggleArchive()}>{(scene?.archived || story?.status === "archived" || session?.status === "archived") ? "Aus Archiv wiederherstellen" : "Archivieren"}</button>
                <button type="button" className={s.deleteAction} disabled={busy} onClick={() => void deleteCurrent()}>{current.kind === "session" ? "Spielabend" : current.kind === "scene" ? "Szene" : "Handlungsstrang"} löschen</button>
                </details>
                <button disabled={busy || !dirty} onClick={() => void save()}>
                  Jetzt speichern
                </button>
                {message.startsWith("Konflikt:") && (
                  <button onClick={() => void open(current.kind, current.id)}>
                    Aktuellen Serverstand laden
                  </button>
                )}
              </div>}
              {story&&<>
              <label className={s.title}>
                Titel
                <input
                  value={doc.title}
                  onChange={(e) => change({ title: e.target.value })}
                />
              </label>
              <details className={s.metadata}><summary>Metadaten & Kurzüberblick</summary><div className={s.meta}>
                <label>
                  <input
                    type="checkbox"
                    checked={doc.favorite}
                    onChange={(e) => change({ favorite: e.target.checked })}
                  />
                  Favorit
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={doc.pinned}
                    onChange={(e) => change({ pinned: e.target.checked })}
                  />
                  Anheften
                </label>
                {!scene && (
                  <label>
                    Status
                    <select
                      value={(doc as StoryDocument | SessionPreparation).status}
                      onChange={(e) =>
                        change({
                          status: e.target.value as StoryDocument["status"],
                        })
                      }
                    >
                      <option value="draft">Entwurf</option>
                      <option value="ready">Vorbereitet</option>
                      <option value="active">In Arbeit</option>
                      <option value="completed">Abgeschlossen</option>
                      <option value="archived">Archiviert</option>
                    </select>
                  </label>
                )}
              </div>
              {!scene && (
                <label>
                  Kurzüberblick
                  <textarea
                    rows={3}
                    value={story?.summary || ""}
                    onChange={(e) => change({ summary: e.target.value })}
                  />
                </label>
              )}
              </details>
              </>}
              {session ? (
                <PreparationGuide label="Spielabend planen" steps={sessionGuideSteps} active={guideStep} busy={busy} onStep={step=>void changeGuideStep(step,"session")} onFinish={()=>void finishGuide("session")} finishLabel="Speichern & zur Übersicht">
                  {guideStep==="basics"&&<div className={s.guideFields}>
                    <label>Titel<input value={session.title} maxLength={200} onChange={e=>change({title:e.target.value})}/></label>
                    <label>Kurzüberblick<textarea rows={4} maxLength={2000} value={session.summary} onChange={e=>change({summary:e.target.value})} placeholder="Was möchtest du an diesem Abend spielen?"/></label>
                    <p>Der Kurzüberblick erscheint später in deiner Spielabendübersicht. Schauplätze wählst du bei den einzelnen Szenen.</p>
                  </div>}
                  {(guideStep==="scenes"||guideStep==="review")&&<SessionOverview compact session={{id:current.id,version:current.version,updatedAt:"",document:session}} scenes={scenes.filter(item=>!unlinkedIds.includes(item.id))} references={refs} files={files} busy={busy||dirty} message={message} onEdit={()=>void changeGuideStep("basics","session")} onScene={id=>void open("scene",id,current.id,"push",false,true)} onCreate={()=>void create("scene")} onMove={(id,direction)=>void moveScene(id,direction)}/>}
                  {guideStep==="scenes"&&<details className={s.sessionLinks}><summary>Vorhandene Storys, Szenen und Schauplätze verknüpfen</summary>
                  {pick(
                    "Handlungsstränge",
                    session.storyIds,
                    stories,
                    (storyIds) => change({ storyIds }),
                  )}
                  {pick("Szenen", sessionSceneValues, scenes, (sceneIds) => {
                    const removed = sessionSceneValues.filter((id) => !sceneIds.includes(id));
                    setUnlinkDraft((value) => {
                      const previous = value?.sessionId === current.id ? value.ids : [];
                      const ids = [...new Set([...previous.filter((id) => !sceneIds.includes(id)), ...removed])];
                      return ids.length ? { sessionId: current.id, ids } : null;
                    });
                    change({ sceneIds });
                  })}
                  {pick(
                    "Zentrale Orte",
                    session.placeIds,
                    refs.filter((r) => r.type === "PLACE"),
                    (placeIds) => change({ placeIds }),
                  )}

                  </details>}
                  {guideStep==="notes"&&editor(session.notes,value=>change({notes:value}),"Sitzungsvorbereitung",current.id+":notes")}
                  {guideStep==="review"&&<div className={s.guideReview}>
                    <h3>Dein Abend im Überblick</h3><p><strong>{session.title}</strong>{session.date?" · "+session.date.replace("T"," · "):" · Termin noch offen"}</p><p>{session.summary||"Ein Kurzüberblick ist noch offen; du kannst ihn jederzeit unter Grunddaten ergänzen."}</p>
                    {!sessionSceneValues.length&&<p>Noch keine Szenen zugeordnet. Du kannst zurück zur Szenenplanung oder den Abend als Entwurf behalten.</p>}
                    {['draft','ready'].includes(session.status)?<label><input type="checkbox" checked={session.status==="ready"} onChange={e=>change({status:e.target.checked?"ready":"draft"})}/>Als vorbereitet kennzeichnen</label>:<p>Der bestehende Status „{session.status}“ bleibt erhalten.</p>}
                    <p>Dies kennzeichnet nur deine Vorbereitung. Es startet keinen Spielabend und veröffentlicht keine Inhalte.</p>
                  </div>}
                </PreparationGuide>
              ) : (
                <>
                  {scene?<PreparationGuide label="Szene vorbereiten" sequential steps={sceneGuideSteps} active={section} busy={busy} onStep={step=>void changeGuideStep(step,"scene")} onFinish={()=>void finishGuide("scene")} finishLabel={returnSession?"Speichern & zum Spielabend":"Speichern & zur Übersicht"}>
                    {section==="narration"&&<><label>Titel<input value={scene.title} maxLength={200} onChange={e=>change({title:e.target.value})}/></label><label>Zentraler Schauplatz<select value={scene.placeId} onChange={e=>change({placeId:e.target.value})}><option value="">Kein Schauplatz</option>{scene.placeId&&!refs.some(ref=>ref.id===scene.placeId&&isCentralPreparationPlace(ref))&&<option value={scene.placeId} disabled>{refs.find(ref=>ref.id===scene.placeId)?.title||"Bestehender Schauplatz"} · bisherige Zuordnung</option>}{refs.filter(ref=>isCentralPreparationPlace(ref)).map(ref=><option key={ref.id} value={ref.id}>{ref.title}</option>)}</select></label></>}
                    {section==="atmosphere"&&<SceneBackdropPicker fileId={scene.backdropFileId} files={files} onChange={backdropFileId=>change({backdropFileId})} onUploaded={file=>setFiles(old=>[file,...old.filter(f=>f.id!==file.id)])}/>}
                    {section==="dialogueNotes"&&<PreparationNPCs references={refs} values={scene.npcIds} onChange={npcIds=>change({npcIds})}/>}
                    {section==="interactions"&&<><PreparationMaterials elements={scene.elements} onChange={elements=>change({elements})} references={refs} files={files} editor={editor} onUploaded={file=>setFiles(old=>[file,...old.filter(f=>f.id!==file.id)])}/><details className={s.optionalSelection}><summary>Vorhandene Hinweise & Handouts auswählen{scene.clueIds.length?" ("+scene.clueIds.length+")":""}</summary>{pick("Vorhandene Hinweis- und Handoutakten dieser Szene",scene.clueIds,refs.filter(ref=>['CLUE','HANDOUT'].includes(ref.type)),clueIds=>change({clueIds}))}</details></>}
                    {section==="visions"?<PreparationWhispers scene={scene} players={players} files={files} onChange={change} onSave={save}>{editor(text,value=>change({visions:value}),"Visionen & persönliche Botschaften",current.id+":visions")}</PreparationWhispers>:editor(text,value=>change({[section]:value}),sceneGuideSteps.find(step=>step.id===section)?.label||"Erzählung",current.id+":"+section)}
                    {section==="possibleConsequences"&&<details className={s.sessionLinks}><summary>Optionale Abzweigungen</summary><p>Alternative Verläufe bleiben Möglichkeiten. Ihre Vorbereitung löst nichts aus.</p>{scene.possibilities.map((item,index)=><div className={s.guideFields} key={item.id}><label>Abzweigung Titel<input maxLength={200} value={item.title} onChange={e=>change({possibilities:scene.possibilities.map((value,i)=>i===index?{...value,title:e.target.value}:value)})}/></label><label>Abzweigung Beschreibung<textarea maxLength={3000} value={item.text} onChange={e=>change({possibilities:scene.possibilities.map((value,i)=>i===index?{...value,text:e.target.value}:value)})}/></label><button type="button" onClick={()=>change({possibilities:scene.possibilities.filter(value=>value.id!==item.id)})}>Abzweigung entfernen</button></div>)}<button type="button" disabled={scene.possibilities.length>=50} onClick={()=>change({possibilities:[...scene.possibilities,{id:crypto.randomUUID(),title:"Neue Abzweigung",text:""}]})}>Abzweigung hinzufügen</button></details>}
                  </PreparationGuide>:<>
                  <div className={s.tabs}>
                    {Object.entries(labels).map(([key, label]) => (
                      <button
                        key={key}
                        aria-pressed={section === key}
                        onClick={() => setSection(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {editor(
                    text,
                    (v) =>
                      story
                        ? change({
                            sections: { ...story.sections, [section]: v },
                          })
                        : change({ [section]: v }),
                    labels[section] || "Text",
                    current.id + ":" + section,
                  )}
                  </>}
                </>
              )}
              {story && (
                <>
                  <h2>Vorbereitete Möglichkeiten</h2>
                  <p>
                    Eine Möglichkeit wird nicht automatisch zu einem geschehenen
                    Ereignis.
                  </p>
                  {story.possibilities.map((p, i) => (
                    <div className={s.element} key={p.id}>
                      <input
                        aria-label="Möglichkeit Titel"
                        value={p.title}
                        onChange={(e) =>
                          change({
                            possibilities: story.possibilities.map((q, n) =>
                              n === i ? { ...q, title: e.target.value } : q,
                            ),
                          })
                        }
                      />
                      <textarea
                        aria-label="Möglichkeit Beschreibung"
                        value={p.text}
                        onChange={(e) =>
                          change({
                            possibilities: story.possibilities.map((q, n) =>
                              n === i ? { ...q, text: e.target.value } : q,
                            ),
                          })
                        }
                      />
                      <button
                        onClick={() =>
                          change({
                            possibilities: story.possibilities.filter(
                              (q) => q.id !== p.id,
                            ),
                          })
                        }
                      >
                        Entfernen
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      change({
                        possibilities: [
                          ...story.possibilities,
                          {
                            id: crypto.randomUUID(),
                            title: "Neue Möglichkeit",
                            text: "",
                            status: "open",
                          },
                        ],
                      })
                    }
                  >
                    + Möglichkeit
                  </button>
                  {pick(
                    "Originalakten verknüpfen",
                    story.references,
                    refs,
                    (references) => change({ references }),
                  )}
                </>
              )}
              {scene&&section==="narration"&&<details className={s.sessionLinks}><summary>Übergreifende Storyzuordnung</summary><p>Optional: Ordne diese Szene einem Handlungsstrang zu. Räume, Medien und Handouts bereitest du später unter Interaktionen und Spielmaterial vor.</p><label>Handlungsstrang<select value={scene.storyId} disabled={!!scene.parentId} onChange={e=>change({storyId:e.target.value})}><option value="">Freie Szene</option>{stories.map(story=><option key={story.id} value={story.id}>{story.title}</option>)}</select></label><button disabled={busy} onClick={()=>void create("scene",true)}>Unter-Szene anlegen</button></details>}

            </>
          ) : (
            <SessionList onFlag={(id,key)=>void toggleSessionFlag(id,key)} sessions={sessions.filter(v=>matches({...v.document,id:v.id,searchText:v.document.summary}))} scenes={scenes} references={refs} busy={busy} message={message} onOpen={id=>void open("session",id)}/>

          )}
        </main>
        {!current && <section className={s.collections} aria-label="Weitere Vorbereitungen">
          <h2>Weitere Vorbereitungen</h2><p className={s.collectionIntro}>Plane übergreifende Geschichten oder bereite Szenen vor, die noch keinem Spielabend zugeordnet sind.</p><div className={s.collectionColumns}>
          <section aria-label="Handlungsstränge">
          <h3>Handlungsstränge</h3>
          <p>Verbinde Hintergründe, Konflikte und zugehörige Szenen über mehrere Spielabende hinweg. Ein Handlungsstrang ist deine übergreifende Geschichte.</p>
          <button className={s.collectionCreate} disabled={busy} onClick={()=>void create("story")}>Handlungsstrang anlegen</button>
          {!stories.filter(matches).length&&<p className={s.collectionEmpty}>Noch kein passender Handlungsstrang vorhanden.</p>}

          {stories.filter(matches).map((v) => (
            <div key={v.id}>
              <button
                onClick={() => void open("story", v.id)}
              >
                ▣ {v.title}
                {v.favorite ? " ★" : ""}
              </button>
              {!search && filter === "all" && tree("", v.id)}
            </div>
          ))}

          </section><section aria-label="Freie Szenen">
          <h3>{search || filter !== "all" ? "Szenentreffer" : "Freie Szenen"}</h3>
          <p>Bereite einzelne Szenen ohne festen Spielabend vor. Über „Spielabend bearbeiten“ kannst du sie später einem Abend zuordnen. Eine neue Szene im geöffneten Abend legst du direkt in dessen Übersicht an.</p>
          <button className={s.collectionCreate} disabled={busy} onClick={()=>void create("scene",false,true)}>Freie Szene anlegen</button>
          {!scenes.some(v=>matches(v)&&(search || filter!=="all" || (!v.storyId&&!v.parentId&&!v.sessionIds.length&&!sessions.some(session=>session.document.sceneIds.includes(v.id)))))&&<p className={s.collectionEmpty}>Noch keine passende freie Szene vorhanden.</p>}
          {!search && filter === "all"
            ? tree("", "")
            : scenes.filter(matches).map((v) => (
                <button key={v.id} onClick={() => void open("scene", v.id)}>
                  ◇ {v.title}
                </button>
              ))}
          {!stories.length && !sessions.length && !scenes.length && (
            <p>
              Noch kein Spielabend vorbereitet. Lege deinen ersten Spielabend an.
            </p>
          )}

          </section></div>
        </section>}

      </div>
    </div>
  );
}

