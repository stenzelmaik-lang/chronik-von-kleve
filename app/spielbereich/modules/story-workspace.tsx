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
};
type Historic = { id: string; version: number; createdAt: string };
const endpoint = (kind: Kind) =>
  "/api/command-center/" +
  (kind === "session" ? "preparation" : kind === "scene" ? "scenes" : "story");
type Reply = {
  error?: string;
  message?: string;
  places: { id: string; title: string }[];
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
export function StoryWorkspace({ a }: { a: Actor }) {
  const [stories, setStories] = useState<StorySummary[]>([]),
    [sessions, setSessions] = useState<PreparedSession[]>([]),
    [scenes, setScenes] = useState<SceneSummary[]>([]),
    [refs, setRefs] = useState<CommandReference[]>([]),
    [moments, setMoments] = useState<MomentView[]>([]),
    [files, setFiles] = useState<{ id: string; name: string; mime: string }[]>(
      [],
    );
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
  const latest = useRef(current),
    baseline = useRef(saved),
    inflight = useRef(false),
    generation = useRef(0);
  useLayoutEffect(() => {
    latest.current = current;
    baseline.current = saved;
  }, [current, saved]);
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
      ...prep.places.map((p) => ({ ...p, type: "PLACE", summary: "" })),
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
  const dirty = !!current && JSON.stringify(current.document) !== saved;
  const accept = (next: Selection) => {
    window.history.replaceState(
      null,
      "",
      "/sl/command-center?" + next.kind + "=" + encodeURIComponent(next.id),
    );
    setCurrent(next);
    setSaved(JSON.stringify(next.document));
    setHistory([]);
    setRecent((old) =>
      [next.id, ...old.filter((id) => id !== next.id)].slice(0, 12),
    );
  };
  const save = useCallback(async () => {
    const start = latest.current;
    if (
      !start ||
      inflight.current ||
      JSON.stringify(start.document) === baseline.current
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
      });
      const next = selection(start.kind, data[start.kind]);
      if (token === generation.current) {
        setSaved(JSON.stringify(start.document));
        setCurrent((value) =>
          value?.id === start.id ? { ...value, version: next.version } : value,
        );
        setMessage(
          JSON.stringify(latest.current?.document) !==
            JSON.stringify(start.document)
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
        JSON.stringify(latest.current.document) !== baseline.current
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  async function leave() {
    if (inflight.current) return false;
    return (
      !dirty ||
      (await confirmation.ask(
        "Ungespeicherte Änderungen verwerfen und die andere Akte öffnen?",
      ))
    );
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
  async function create(kind: Kind, child = false) {
    if (!(await leave())) return;
    generation.current++;
    inflight.current = true;
    setBusy(true);
    setMessage("Legt neue Akte an …");
    let doc: Document;
    if (kind === "story") doc = emptyStory();
    else if (kind === "session")
      doc = sessionPreparationSchema.parse({ title: "Neue Sitzung" });
    else {
      doc = emptyScene(
        current?.kind === "story"
          ? current.id
          : current?.kind === "scene"
            ? (current.document as SceneDocument).storyId
            : "",
      );

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
      accept(selection(kind, result[kind]));
      setSection(kind === "scene" ? "narration" : "background");
      setMessage(kind === "scene" && current?.kind === "session" ? "Szene angelegt · bitte in der Sitzung auswählen. Noch keine Veröffentlichung." : "Neu angelegt · noch keine Veröffentlichung");
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
  }) {
    return (
      (!search ||
        (v.title + " " + (v.searchText || ""))
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (filter === "all" ||
        (filter === "favorite" && v.favorite) ||
        (filter === "pinned" && v.pinned) ||
        (filter === "recent" && recent.includes(v.id)))
    );
  }
  const doc = current?.document,
    story = current?.kind === "story" ? (doc as StoryDocument) : null,
    scene = current?.kind === "scene" ? (doc as SceneDocument) : null,
    session = current?.kind === "session" ? (doc as SessionPreparation) : null;
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
  const editor = (
    value: string,
    onChange: (v: string) => void,
    label: string,
    key: string,
  ) => (
    <RichTextEditor
      key={key}
      value={value}
      onChange={onChange}
      label={label}
      maximumPlainLength={current?.kind==='scene'?7000:10000}
      placeholder="Deine private Vorbereitung …"
      advanced
      files={files}
    />
  );
  const pick = (
    label: string,
    values: string[],
    options: { id: string; title: string }[],
    update: (ids: string[]) => void,
  ) => (
    <fieldset className={s.pick}>
      <legend>{label}</legend>
      {options.length ? (
        options.map((o) => (
          <label key={o.id}>
            <input
              type="checkbox"
              checked={values.includes(o.id)}
              onChange={(e) =>
                update(
                  e.target.checked
                    ? [...values, o.id]
                    : values.filter((id) => id !== o.id),
                )
              }
            />
            {o.title}
          </label>
        ))
      ) : (
        <small>Noch keine passenden zentralen Akten vorhanden.</small>
      )}
    </fieldset>
  );
  function tree(parent: string, storyId: string, depth = 0): React.ReactNode {
    if (depth > 20) return null;
    return scenes
      .filter((v) => v.parentId === parent && v.storyId === storyId)
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
          <h1>Storybuch</h1>
          <p>
            Deine Geschichten, Sitzungen und Szenen. Spielweltakten werden
            verknüpft.
          </p>
        </div>
        <a href="/spielbereich?bereich=sitzung">Zum Live-Spieltisch →</a>
      </header>
      <div className={s.columns}>
        <nav className={s.nav} aria-label="Storynavigation">
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
            <option value="all">Alle Akten</option>
            <option value="favorite">Favoriten</option>
            <option value="pinned">Angeheftet</option>
            <option value="recent">Zuletzt geöffnet</option>
          </select>
          <div className={s.actions}>
            <button disabled={busy} onClick={() => void create("story")}>
              + Story
            </button>
            <button disabled={busy} onClick={() => void create("session")}>
              + Sitzung
            </button>
            <button disabled={busy} onClick={() => void create("scene")}>
              + Szene
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
          <h2>Sitzungen</h2>
          {sessions
            .filter((v) =>
              matches({
                ...v.document,
                id: v.id,
                searchText:
                  richTextToPlainText(v.document.notes) +
                  " " +
                  v.document.summary,
              }),
            )
            .map((v) => (
              <div key={v.id}>
                <button
                  className={current?.id === v.id ? s.selected : ""}
                  onClick={() => void open("session", v.id)}
                >
                  ◷ {v.document.title}
                </button>
                {!search &&
                  filter === "all" &&
                  scenes
                    .filter(
                      (c) =>
                        v.document.sceneIds.includes(c.id),
                    )
                    .map((c) => (
                      <button
                        key={c.id}
                        onClick={() => void open("scene", c.id)}
                      >
                        ↳ {c.title}
                      </button>
                    ))}
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
              Leerer Arbeitsbestand. Lege deine erste Story oder Sitzung an.
            </p>
          )}
        </nav>
        <main className={s.main}>
          {current && doc ? (
            <>
              <div className={s.savebar}>
                <span role="status">{message}</span>
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
              <div className={s.meta}>
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
                  <h2>Sitzungsvorbereitung</h2>
                  {editor(
                    session.notes,
                    (v) => change({ notes: v }),
                    "Sitzungsvorbereitung",
                    current.id + ":notes",
                  )}
                  {pick(
                    "Handlungsstränge",
                    session.storyIds,
                    stories,
                    (storyIds) => change({ storyIds }),
                  )}
                  {pick("Szenen", session.sceneIds, scenes, (sceneIds) =>
                    change({ sceneIds }),
                  )}
                  {pick(
                    "Zentrale Orte",
                    session.placeIds,
                    refs.filter((r) => r.type === "PLACE"),
                    (placeIds) => change({ placeIds }),
                  )}
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
                    {sessions.filter((v) => v.document.sceneIds.includes(current.id)).map((v) => (
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
              <h2>Raum für deine Geschichte</h2>
              <p>
                Wähle eine Akte oder lege einen Handlungsstrang an. Nichts wird
                automatisch veröffentlicht oder als tatsächlich geschehen
                markiert.
              </p>
              <button disabled={busy} onClick={() => void create("story")}>
                Erste Story anlegen
              </button>
              <p role="status">{message}</p>
            </div>
          )}
        </main>
        <aside className={s.context}>
          <h2>Kontext</h2>
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
        </aside>
      </div>
    </div>
  );
}

