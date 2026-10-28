"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Actor } from "@/domain/types";
import {
  emptyStory,
  storyDocumentSchema,
  type StoryDocument,
  type StoryView,
  type CommandReference,
  type MomentView,
} from "@/domain/command-workspace";
import {
  emptyScene,
  sceneElementKinds,
  type SceneDocument,
  type SceneView,
  type SceneSummary,
} from "@/domain/story-scene";
import {
  sessionPreparationSchema,
  type SessionPreparation,
  type PreparedSession,
} from "@/domain/story-preparation";
import { richTextToPlainText } from "@/domain/location-rich-text";
import { RichTextEditor } from "./rich-text";
import { PreparationPicker } from "./preparation-picker";
import { preparationPlaces } from "./preparation-catalog";
import { useCommandConfirmation } from "./command-confirmation";
import s from "./story-workspace.module.css";
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
type Historic = { id: string; version: number; createdAt: string };
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
  moments: MomentView[];
  files: { id: string; name: string; mime: string }[];
  story: StoryView;
  scene: SceneView;
  session: PreparedSession;
  history: Historic[];
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
const elementNames: Record<(typeof sceneElementKinds)[number], string> = {
  text: "Text",
  "sl-note": "SL-Notiz",
  description: "Beschreibung",
  object: "Gegenstand",
  clue: "Hinweis",
  check: "Probe",
  dialogue: "Dialog",
  encounter: "Begegnung",
  place: "Ortsverweis",
  person: "Person / Platzhalter",
  image: "Bild",
  audio: "Audio",
  video: "Video",
  handout: "Handout",
  puzzle: "Rätsel / Platzhalter",
};
export function StoryWorkspace({ a, onDirty }: { a: Actor; onDirty?: (dirty:boolean)=>void }) {
  const [stories, setStories] = useState<StorySummary[]>([]),
    [sessions, setSessions] = useState<PreparedSession[]>([]),
    [scenes, setScenes] = useState<SceneSummary[]>([]),
    [refs, setRefs] = useState<CommandReference[]>([]),
    [moments, setMoments] = useState<MomentView[]>([]),
    [files, setFiles] = useState<{ id: string; name: string; mime: string }[]>(
      [],
    );
  const [navigationOpen,setNavigationOpen]=useState(false),[expandedEditor,setExpandedEditor]=useState<string|null>(null);
  const [current, setCurrent] = useState<Selection | null>(null),
    [saved, setSaved] = useState(""),
    [message, setMessage] = useState("Lade Arbeitsbestand …"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [section, setSection] = useState("background"),
    [history, setHistory] = useState<Historic[]>([]),
    [recent, setRecent] = useState<string[]>([]),
    [elementFocus, setElementFocus] = useState(""),
    [recentReady, setRecentReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [unlinkDraft, setUnlinkDraft] = useState<{sessionId:string;ids:string[]}|null>(null);
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
    const [catalog, prep, media] = await Promise.all([
      request("/api/command-center"),
      request("/api/command-center/preparation"),
      request("/api/files"),
    ]);
    setStories(catalog.stories);
    setScenes(catalog.scenes);
    setRefs([
      ...catalog.references.filter((r) => r.type !== "PLACE"),
      ...preparationPlaces(prep.places),
    ]);
    setMoments(catalog.moments);
    setSessions(prep.sessions);
    setFiles(media.files || []);
  }, []);
  useEffect(() => {
    Promise.resolve()
      .then(refresh)
      .then(async () => {
        setMessage("Arbeitsbestand geladen. Nur für die Spielleitung.");
        const q = new URLSearchParams(window.location.search);
        for (const kind of ["story", "session", "scene"] as const) {
          const id = q.get(kind);
          if (id) {
            const data = await request(
              endpoint(kind) + "?id=" + encodeURIComponent(id),
            );
            const next = selection(kind, data[kind]);
            setCurrent(next);
            setSaved(JSON.stringify(next.document));
            setSection(kind === "scene" ? "narration" : "background");
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
  const accept = (next: Selection) => {
    window.history.replaceState(
      null,
      "",
      "/sl/command-center?" + next.kind + "=" + encodeURIComponent(next.id),
    );
    setNavigationOpen(false);
    setExpandedEditor(null);
    setUnlinkDraft(null);
    setCurrent(next);
    setSaved(JSON.stringify(next.document));
    setHistory([]);
    setRecent((old) =>
      [next.id, ...old.filter((id) => id !== next.id)].slice(0, 12),
    );
  };
  const save = useCallback(async () => {
    const start = latest.current;
    const removed = [...pendingUnlinks.current];
    if (
      !start ||
      inflight.current ||
      (JSON.stringify(start.document) === baseline.current && removed.length === 0)
    )
      return;
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
        setSaved(JSON.stringify(start.document));
        setCurrent((value) =>
          value?.id === start.id ? { ...value, version: next.version } : value,
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
      }
    } catch (e) {
      setMessage((e as Error).message + " Deine Eingaben bleiben im Editor.");
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
  async function open(kind: Kind, id: string) {
    if (!(await leave())) return;
    const token = ++generation.current;
    try {
      const data = await request(
        endpoint(kind) + "?id=" + encodeURIComponent(id),
      );
      if (token !== generation.current) return;
      accept(selection(kind, data[kind]));
      setSection(kind === "scene" ? "narration" : "background");
      setMessage("Geladen · private Vorbereitung");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function create(kind: Kind, child = false, unlinked = false) {
    if (!(await leave())) return;
    generation.current++;
    inflight.current = true;
    setBusy(true);
    setMessage("Legt neue Akte an …");
    let doc: Document;
    const fromSession=kind==="scene"&&!unlinked&&current?.kind==="session"?current.id:"";
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
      accept(selection(kind,result[kind]));
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
  async function upload(file: File) {
    const form = new FormData();
    form.set("file", file);
    form.set("visibility", "sl");
    try {
      setMessage("Lädt geschützte Datei hoch …");
      const response = await fetch("/api/files", {
        method: "POST",
        body: form,
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error || "Upload fehlgeschlagen.");
      await refresh();
      setMessage(
        "Datei privat gespeichert · im Editor als Bild oder Handout auswählen",
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function change(patch: Partial<Document>) {
    setCurrent((c) =>
      c ? { ...c, document: { ...c.document, ...patch } as Document } : c,
    );
    setMessage("Ungespeicherte Änderungen · automatische Speicherung folgt");
  }
  async function loadHistory() {
    if (!current) return;
    try {
      setHistory(
        (
          await request(
            endpoint(current.kind) +
              "?id=" +
              encodeURIComponent(current.id) +
              "&history=1",
          )
        ).history || [],
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function restore(h: Historic) {
    if (
      !current ||
      !(await confirmation.ask(
        "Diesen Vorbereitungsstand als neuen Stand wiederherstellen? Tatsächliche Ereignisse und laufende Szenen bleiben erhalten.",
      ))
    )
      return;
    try {
      const result = await request(endpoint(current.kind), {
        action: "restore",
        id: current.id,
        version: current.version,
        historyId: h.id,
      });
      accept(selection(current.kind, result[current.kind]));
      setMessage("Vorbereitungsstand wiederhergestellt");
      await refresh();
    } catch (e) {
      setMessage((e as Error).message);
    }
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
        <span>Visuell · HTML-Quelltext · Vorschau</span>
        <button type="button" aria-pressed={expandedEditor===key} onClick={()=>setExpandedEditor(expandedEditor===key?null:key)}>
          {expandedEditor===key?"Vollbild schließen":"Editor vergrößern"}
        </button>
      </div>
      <RichTextEditor value={value} onChange={onChange} label={label}
        maximumPlainLength={current?.kind==="scene"?7000:10000}
        placeholder="Deine private Vorbereitung …" advanced htmlSource files={files}/>
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
      <header className={s.top}>
        <div>
          <small>SL-WORKSPACE · VORBEREITUNG</small>
          <h1>Spielabend & Story</h1>
          <p>
            Beginne mit einem Spielabend und bereite dort deine Schauplätze und Szenen vor.
          </p>
        </div>
        <a href="/spielbereich?bereich=sitzung">Zum Live-Spieltisch →</a>
      </header>
      <div className={s.columns}>
        <button type="button" className={s.mobileNavToggle} aria-expanded={navigationOpen} aria-controls="preparation-navigation" onClick={()=>setNavigationOpen(!navigationOpen)}>Akten auswählen</button>
        <nav id="preparation-navigation" className={`${s.nav} ${navigationOpen ? s.navigationOpen : ""}`} aria-label="Storynavigation">
          <input
            aria-label="Storys, Sitzungen und Szenen suchen"
            placeholder="Suchen …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Navigation filtern"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Aktive Akten</option>
            <option value="archive">Archiv</option>
            <option value="favorite">Favoriten</option>
            <option value="pinned">Angeheftet</option>
            <option value="recent">Zuletzt geöffnet</option>
          </select>
          <div className={s.sessionIntro}>
          <button disabled={busy} onClick={()=>void create("session")}>+ Spielabend anlegen</button>
          <p>Von hier aus planst du Szenen, Schauplätze und Regiematerial.</p>
        </div>
        <h2>Spielabende</h2>
        {sessions.filter(v=>matches({
          ...v.document,
          id:v.id,
          searchText:richTextToPlainText(v.document.notes)+" "+v.document.summary,
        })).map(v=>{
          const currentSession=current?.kind==="session"&&current.id===v.id?session:null;
          const sceneIds=currentSession?.sceneIds||v.document.sceneIds;
          const linked=scenes.filter(c=>
            !(currentSession&&unlinkedIds.includes(c.id)) &&
            (sceneIds.includes(c.id)||c.sessionIds.includes(v.id))&&matches(c));
          const placeKeys=[...new Set(linked.map(c=>c.placeId||""))];
          return <section className={s.sessionNav} key={v.id}>
            <button className={current?.id===v.id?s.selected:""}
              aria-current={current?.id===v.id?"page":undefined}
              onClick={()=>void open("session",v.id)}>◷ {v.document.title}</button>
            {!search&&filter==="all"&&<div className={s.sessionNavContents}>
              {!linked.length&&<p>Keine Szenen vorbereitet.</p>}
              {placeKeys.map(placeId=><div key={placeId||"no-place"} className={s.sessionNavPlace}>
                <span>{placeId?refs.find(r=>r.id===placeId)?.title||"Verknüpfter Ort":"Ohne Schauplatz"}</span>
                {linked.filter(c=>(c.placeId||"")===placeId).map(c=>
                  <button key={c.id} className={current?.id===c.id?s.selected:""}
                    onClick={()=>void open("scene",c.id)}>◇ {c.title}</button>)}
              </div>)}
            </div>}
          </section>;
        })}
        <details className={s.secondary}>
          <summary>Weitere Akten · Handlungsstränge & freie Szenen</summary>
          <div className={s.actions}>
            <button disabled={busy} onClick={() => void create("story")}>
              + Handlungsstrang
            </button>
            
            <button disabled={busy} onClick={() => void create("scene", false, true)}>
              + freie Szene
            </button>
          </div>
          
          <h2>Handlungsstränge</h2>
          {stories.filter(matches).map((v) => (
            <div key={v.id}>
              <button
                className={current?.id === v.id ? s.selected : ""}
                onClick={() => void open("story", v.id)}
              >
                ▣ {v.title}
                {v.favorite ? " ★" : ""}
              </button>
              {!search && filter === "all" && tree("", v.id)}
            </div>
          ))}
          
          <h2>
            {search || filter !== "all" ? "Szenentreffer" : "Freie Szenen"}
          </h2>
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
        
        </details>
        </nav>
        <main className={s.main}>
          {current && doc ? (
            <>
              <div className={s.savebar}>
                <span role="status">{message}</span>
                <button disabled={busy} onClick={() => void toggleArchive()}>{(scene?.archived || story?.status === "archived" || session?.status === "archived") ? "Aus Archiv wiederherstellen" : "Archivieren"}</button>
                <button disabled={busy || !dirty} onClick={() => void save()}>
                  Jetzt speichern
                </button>
                {message.startsWith("Konflikt:") && (
                  <button onClick={() => void open(current.kind, current.id)}>
                    Aktuellen Serverstand laden
                  </button>
                )}
              </div>
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
                    value={story?.summary || session?.summary || ""}
                    onChange={(e) => change({ summary: e.target.value })}
                  />
                </label>
              )}
              </details>
              {session ? (
                <>
                  <label>
                    Geplanter Termin
                    <input
                      type="datetime-local"
                      value={session.date}
                      onChange={(e) => change({ date: e.target.value })}
                    />
                  </label>
                  <section className={s.sessionOverview}>
                    <div className={s.sessionHead}><h2>Schauplätze & Szenen</h2>
                      <button disabled={busy||dirty} onClick={()=>void create("scene")}>+ Szene für diesen Spielabend</button>
                    </div>
                    <p>Die Vorbereitung gibt Möglichkeiten vor, keine feste Reihenfolge der Spielerhandlungen.</p>
                    {(()=>{
                      const linked=scenes.filter(c=>!unlinkedIds.includes(c.id) && (session.sceneIds.includes(c.id)||c.sessionIds.includes(current!.id)));
                      const placeIds=[...new Set([...session.placeIds,...linked.map(c=>c.placeId).filter(Boolean)])];
                      return <div className={s.sessionPlaces}>
                        {placeIds.map(placeId=><section key={placeId} className={s.sessionPlace}>
                          <h3>{refs.find(r=>r.id===placeId)?.title||"Schauplatz"}</h3>
                          {linked.filter(c=>c.placeId===placeId).map(c=><button key={c.id} onClick={()=>void open("scene",c.id)}>◇ {c.title}</button>)}
                          {!linked.some(c=>c.placeId===placeId)&&<p>Noch keine Szene für diesen Ort.</p>}
                        </section>)}
                        {linked.some(c=>!c.placeId)&&<section className={s.sessionPlace}><h3>Ohne Schauplatz</h3>
                          {linked.filter(c=>!c.placeId).map(c=><button key={c.id} onClick={()=>void open("scene",c.id)}>◇ {c.title}</button>)}
                        </section>}
                        {!linked.length&&!placeIds.length&&<p>Noch keine Orte oder Szenen verbunden.</p>}
                      </div>;
                    })()}
                  </section>
                   <h2>Regie und Verlauf dieses Spielabends</h2>
                  {editor(
                    session.notes,
                    (v) => change({ notes: v }),
                    "Sitzungsvorbereitung",
                    current.id + ":notes",
                  )}
                  <details className={s.sessionLinks}>
                    <summary>Vorhandene Storys, Szenen und Schauplätze verknüpfen</summary>
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
                  </details>
                </>
              ) : (
                <>
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
              {scene && (
                <>
                  <div className={s.meta}>
                    <label>
                      Handlungsstrang
                      <select
                        value={scene.storyId}
                        disabled={!!scene.parentId}
                        onChange={(e) => change({ storyId: e.target.value })}
                      >
                        <option value="">Freie Szene</option>
                        {stories.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Zentraler Schauplatz
                      <select
                        value={scene.placeId}
                        onChange={(e) => change({ placeId: e.target.value })}
                      >
                        <option value="">Kein Schauplatz</option>
                        {refs
                          .filter((r) => r.type === "PLACE")
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.title}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button
                      disabled={busy}
                      onClick={() => void create("scene", true)}
                    >
                      + Unter-Szene
                    </button>
                  </div>
                  <div>
                    <h3>Zugeordnete Sitzungen</h3>
                    <p>Die Zuordnung wird in der jeweiligen Sitzung bearbeitet.</p>
                    {sessions.filter((v) => v.document.sceneIds.includes(current.id) || scene.sessionIds.includes(v.id)).map((v) => (
                      <button key={v.id} onClick={() => void open("session", v.id)}>{v.document.title}</button>
                    ))}
                  </div>                  <h2>Szenenelemente</h2>
                  <p>
                    Bausteine der Vorbereitung. Audio, Video und Rätsel werden
                    verknüpft; es entsteht keine neue Engine.
                  </p>
                  {scene.elements.map((e, i) => (
                    <details
                      id={"story-element-" + e.id}
                      key={e.id}
                      className={s.element}
                      open={elementFocus === e.id}
                      onToggle={(event) => {
                        if (event.currentTarget.open) setElementFocus(e.id);
                      }}
                    >
                      <summary>
                        {elementNames[e.kind]} · {e.title}
                      </summary>
                      <div className={s.meta}>
                        <strong>{elementNames[e.kind]}</strong>
                        <input
                          aria-label="Elementtitel"
                          value={e.title}
                          onChange={(v) =>
                            change({
                              elements: scene.elements.map((x, n) =>
                                n === i ? { ...x, title: v.target.value } : x,
                              ),
                            })
                          }
                        />
                        <button
                          onClick={() =>
                            change({
                              elements: scene.elements.filter(
                                (x) => x.id !== e.id,
                              ),
                            })
                          }
                        >
                          Entfernen
                        </button>
                      </div>
                      {editor(
                        e.text,
                        (v) =>
                          change({
                            elements: scene.elements.map((x, n) =>
                              n === i ? { ...x, text: v } : x,
                            ),
                          }),
                        e.title,
                        current.id + ":" + e.id,
                      )}
                      {[
                        "place",
                        "person",
                        "clue",
                        "handout",
                        "puzzle",
                      ].includes(e.kind) && (
                        <label>
                          Originalakte / optionaler Platzhalter
                          <select
                            value={e.referenceId}
                            onChange={(v) =>
                              change({
                                elements: scene.elements.map((x, n) =>
                                  n === i
                                    ? { ...x, referenceId: v.target.value }
                                    : x,
                                ),
                              })
                            }
                          >
                            <option value="">Noch nicht verknüpft</option>
                            {refs
                              .filter((r) =>
                                (
                                  ({
                                    place: ["PLACE"],
                                    person: ["NPC", "CHARACTER"],
                                    clue: ["CLUE"],
                                    handout: ["HANDOUT"],
                                    puzzle: ["RULE", "HANDOUT"],
                                  })[e.kind as "place"] || []
                                ).includes(r.type),
                              )
                              .map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.title}
                                </option>
                              ))}
                          </select>
                        </label>
                      )}
                      {["image", "audio", "video", "handout"].includes(
                        e.kind,
                      ) && (
                        <label>
                          Geschützte Datei
                          <select
                            value={e.fileId}
                            onChange={(v) =>
                              change({
                                elements: scene.elements.map((x, n) =>
                                  n === i
                                    ? { ...x, fileId: v.target.value }
                                    : x,
                                ),
                              })
                            }
                          >
                            <option value="">Keine Datei</option>
                            {files
                              .filter(
                                (f) =>
                                  e.kind === "handout" ||
                                  f.mime.startsWith(
                                    e.kind === "image"
                                      ? "image/"
                                      : e.kind + "/",
                                  ),
                              )
                              .map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name}
                                </option>
                              ))}
                          </select>
                        </label>
                      )}
                    </details>
                  ))}
                  <label>
                    Element hinzufügen
                    <select
                      value=""
                      onChange={(e) => {
                        const kind = e.target
                          .value as (typeof sceneElementKinds)[number];
                        if (kind) {
                          const elementId = crypto.randomUUID();
                          setElementFocus(elementId);
                          change({
                            elements: [
                              ...scene.elements,
                              {
                                id: elementId,
                                kind,
                                title: elementNames[kind],
                                text: "",
                                referenceId: "",
                                fileId: "",
                              },
                            ],
                          });
                        }
                      }}
                    >
                      <option value="">Baustein wählen …</option>
                      {sceneElementKinds.map((kind) => (
                        <option key={kind} value={kind}>
                          {elementNames[kind]}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </>
          ) : (
            <div className={s.empty}>
              <h2>Dein nächster Spielabend beginnt hier</h2>
              <p>
                Lege einen Spielabend an oder öffne eine bestehende Vorbereitung. Von dort aus verknüpfst du Schauplätze, Szenen und Medien. Nichts wird automatisch veröffentlicht.
              </p>
              <button disabled={busy} onClick={() => void create("session")}>
                Spielabend anlegen
              </button>
              <p role="status">{message}</p>
            </div>
          )}
        </main>
        <details className={s.context}>
          <summary>Kontext, Medien & Verlauf</summary>
          <div>
          <label>
            Private Datei hinzufügen
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = "";
              }}
            />
          </label>
          <small>
            JPG, PNG, WebP oder PDF bis 10 MB. Keine automatische
            Spielerfreigabe.
          </small>
          <p>Vorbereitung · ausschließlich SL</p>
          <p>
            Orte, Personen und Dateien bleiben in ihren zentralen Originalakten.
          </p>
          {scene?.parentId && (
            <button onClick={() => void open("scene", scene.parentId)}>
              Übergeordnete Szene öffnen
            </button>
          )}
          <details>
            <summary>Verlauf & Wiederherstellung</summary>
            <button
              disabled={!current || dirty}
              onClick={() => void loadHistory()}
            >
              Verlauf laden
            </button>
            {history.map((h) => (
              <div key={h.id}>
                <small>
                  {new Date(h.createdAt).toLocaleString("de-DE")} · Revision{" "}
                  {h.version}
                </small>
                <button disabled={dirty} onClick={() => void restore(h)}>
                  Wiederherstellen
                </button>
              </div>
            ))}
          </details>
          <h2>Tatsächlich geschehen</h2>
          <p>
            Separate Sitzungsereignisse; keine automatische Ableitung aus deiner
            Vorbereitung.
          </p>
          {moments
            .filter((m) =>
              current?.kind === "story"
                ? m.storyId === current.id
                : current?.kind === "session"
                  ? m.sessionId === current.id
                  : m.sceneId === current?.id,
            )
            .map((m) => (
              <p key={m.id}>
                {m.text}
                <small>{new Date(m.occurredAt).toLocaleString("de-DE")}</small>
              </p>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

