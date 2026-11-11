"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Plus, Search, Trash2, X, PenLine, MapPin, Mail, UserRound } from "lucide-react";
import type { Actor } from "@/domain/types";
import { formatCalendarDate } from "@/domain/calendar-date";
import { htmlToRichText } from "@/domain/location-rich-text";
import { draftDiffers, draftFromPage, plainText, searchPages, tagIndex, today, TAG_LENGTH, TAG_LIMIT, type NotebookPage, type PageDraft } from "@/domain/notebook";
import { api, ApiError } from "../api-client";
import { notebookEngagementTicket } from "../engagement-notebook-ticket";
import { currentPlayerDataScope, readPlayerData, storePlayerData } from "../player-data-cache";
import { RichTextEditor, RichTextView } from "../rich-text";
import { InfoButton } from "../info-button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import styles from "./notebook.module.css";

type Data = { readOnly: boolean; owner: { id: string; name: string }; pages: NotebookPage[]; characters: { id: string; title: string }[] };
type Status = "saved" | "dirty" | "saving" | "error" | "conflict";
const NEW = "neu", SAVE_DELAY = 1200;
const draftKey = (id: string) => "/ui/notebook-draft/" + id;
const statusText: Record<Status, string> = { saved: "Gespeichert", dirty: "Ungespeichert", saving: "Speichert …", error: "Nicht gespeichert", conflict: "Nicht gespeichert" };
const sourceLabel = { ort: "Ort", postfach: "Brief", figur: "Figur", notiz: "" } as const;

/** Explanation shown behind the info button, in the player area and at the table alike. */
export function NotebookHelp() {
  return <InfoButton title="So funktioniert dein Notizbuch">
    <ol>
      <li><strong>Neue Seite</strong> legt eine Seite an. Du schreibst sofort los.</li>
      <li>Das <strong>Thema</strong> ist freiwillig. Ohne Thema nennt die erste Zeile die Seite.</li>
      <li>Das <strong>Datum</strong> steht auf heute. Du kannst es ändern, zum Beispiel auf den Spielabend.</li>
      <li>Gespeichert wird von selbst, kurz nach dem Schreiben und beim Schließen. Oben rechts auf der Seite steht der Stand.</li>
      <li><strong>Schlagwörter</strong> vergibst du selbst: Namen, Orte, „offene Frage“. Darüber filterst und suchst du.</li>
    </ol>
    <p>Ideen für eine Seite: Was ist heute Nacht passiert? Wen habt ihr getroffen? Was willst du noch herausfinden?</p>
    <p>Dasselbe Notizbuch findest du im Spielerbereich und am Spieltisch (linke Leiste, unter „Notizzettel“). Ortsnotizen und Briefe, die du aus dem Postfach übernimmst, landen auch hier.</p>
    <p>Die Spielleitung kann dein Notizbuch lesen, aber nie ändern. Übernommene Briefe sieht sie nicht. <strong>Notizzettel</strong> sind etwas anderes: Sie liegen auf dem Tisch der Runde.</p>
  </InfoButton>;
}

/**
 * One notebook, one data source, two layouts: "wide" (list and page side by side, player area) and "narrow" (list,
 * then page; table drawer and small screens). With memberId the SL reads another player's notebook, never edits.
 */
export function Notebook({ a, layout, memberId }: { a: Actor; layout: "wide" | "narrow"; memberId?: string }) {
  const [data, setData] = useState<Data | null>(null), [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<string | null>(null), [draft, setDraft] = useState<PageDraft | null>(null);
  const [status, setStatus] = useState<Status>("saved"), [problem, setProblem] = useState("");
  const [query, setQuery] = useState(""), [tag, setTag] = useState(""), [tagInput, setTagInput] = useState("");
  const [richEdit, setRichEdit] = useState<string | null>(null), [confirmDelete, setConfirmDelete] = useState(false), [characterId, setCharacterId] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const live = useRef({ draft: null as PageDraft | null, dirty: false, saving: false, characterId: "" });
  const readOnly = !!data?.readOnly;
  const engagementScope = `${a.campaignId}:${a.id}`;
  const path = "/api/notebook" + (memberId && memberId !== a.id ? "?member=" + encodeURIComponent(memberId) : "");

  const load = useCallback(async () => {
    try { const next = await api<Data>(path); setData(next); setLoadError(""); return next; }
    catch (e) { setLoadError((e as Error).message); return null; }
  }, [path]);
  useEffect(() => { let active = true; api<Data>(path).then(next => { if (active) { setData(next); setLoadError(""); } }).catch(e => { if (active) setLoadError((e as Error).message); }); return () => { active = false; }; }, [path]);

  const pages = useMemo(() => data?.pages || [], [data]);
  const page = selected && selected !== NEW ? pages.find(p => p.id === selected) || null : null;
  const base = page ? { ...page, text: richEdit ?? page.text } : null;
  const dirty = !!draft && !readOnly && draftDiffers(draft, base);
  const shown = useMemo(() => searchPages(pages, query, tag), [pages, query, tag]);
  const tags = useMemo(() => tagIndex(pages), [pages]);
  const characterName = (id: string | null) => data?.characters.find(c => c.id === id)?.title || "";

  // Drafts live in the shared player data cache of the open player area (same memory the other tools use).
  const keepDraft = useCallback((next: PageDraft | null) => {
    const scope = currentPlayerDataScope();
    if (!scope || !next) return;
    storePlayerData(scope, draftKey(next.pageId), next);
  }, []);
  const dropDraft = useCallback((id: string) => { const scope = currentPlayerDataScope(); if (scope) storePlayerData<PageDraft | null>(scope, draftKey(id), null); }, []);
  const storedDraft = (id: string) => { const scope = currentPlayerDataScope(); return scope ? readPlayerData<PageDraft | null>(scope, draftKey(id))?.value || undefined : undefined; };

  useEffect(() => { live.current = { ...live.current, draft, dirty, characterId }; if (dirty) keepDraft(draft); }, [draft, dirty, characterId, keepDraft]);

  const save = useCallback(async (asNew = false) => {
    const current = live.current.draft;
    if (!current || live.current.saving) return;
    live.current.saving = true; setStatus("saving"); setProblem("");
    const creating = asNew || current.pageId === NEW;
    try {
      const result = await api<{ page: NotebookPage }>("/api/notebook", "POST", { action: "save", ...(creating ? {} : { id: current.pageId, version: current.baseVersion }), title: current.title, text: current.text, date: current.date, tags: current.tags, ...(creating && live.current.characterId ? { characterId: live.current.characterId } : {}), engagementTicket: notebookEngagementTicket(engagementScope) });
      const saved = result.page;
      setData(old => old ? { ...old, pages: [saved, ...old.pages.filter(p => p.id !== saved.id)] } : old);
      dropDraft(current.pageId);
      setRichEdit(null);
      const latest = live.current.draft;
      // Typing may have continued while the request ran: keep that text and save it next.
      const moved = latest && latest !== current ? { ...latest, pageId: saved.id, baseVersion: saved.version } : draftFromPage(saved);
      setSelected(saved.id); setDraft(moved);
      setStatus(latest && latest !== current ? "dirty" : "saved");
    } catch (e) {
      const conflict = e instanceof ApiError && e.status === 409;
      setStatus(conflict ? "conflict" : "error");
      setProblem(conflict ? "Diese Seite wurde an anderer Stelle geändert, zum Beispiel in einem zweiten Fenster. Dein Entwurf ist noch da." : (e as Error).message + " Dein Entwurf bleibt erhalten.");
    } finally { live.current.saving = false; }
  }, [dropDraft, engagementScope]);

  // Autosave shortly after typing stops.
  useEffect(() => {
    if (!dirty || (status !== "saved" && status !== "dirty")) return;
    const timer = window.setTimeout(() => void save(), SAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [draft, dirty, status, save]);

  // Closing the drawer, leaving the page or switching the tab: send what is not saved yet.
  useEffect(() => {
    const flush = () => {
      const { draft: current, dirty: open, characterId: figure } = live.current;
      if (!current || !open || readOnly) return;
      const creating = current.pageId === NEW;
      if (creating && live.current.saving) return;
      try { void fetch("/api/notebook", { method: "POST", keepalive: true, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", ...(creating ? {} : { id: current.pageId, version: current.baseVersion }), title: current.title, text: current.text, date: current.date, tags: current.tags, ...(creating && figure ? { characterId: figure } : {}) }) }); } catch { /* the draft stays in memory */ }
    };
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); flush(); };
  }, [readOnly]);

  function open(next: NotebookPage) {
    if (live.current.dirty) void save();
    setRichEdit(null); setProblem(""); setConfirmDelete(false);
    const kept = storedDraft(next.id);
    const fresh = draftFromPage(next);
    setSelected(next.id); setDraft(kept && kept.baseVersion === next.version ? kept : fresh);
    setStatus(kept && kept.baseVersion === next.version && draftDiffers(kept, next) ? "dirty" : "saved");
  }
  function create() {
    if (live.current.dirty) void save();
    setRichEdit(null); setProblem(""); setCharacterId("");
    const kept = storedDraft(NEW);
    setSelected(NEW); setDraft(kept || { pageId: NEW, baseVersion: null, title: "", text: "", date: today(), tags: [] }); setStatus(kept ? "dirty" : "saved");
    queueMicrotask(() => textRef.current?.focus());
  }
  function back() { if (live.current.dirty) void save(); setSelected(null); setDraft(null); setRichEdit(null); }
  const patch = (change: Partial<PageDraft>) => { setDraft(d => d ? { ...d, ...change } : d); setStatus(s => s === "conflict" || s === "saving" ? s : "dirty"); };
  function addTag(raw: string) {
    const value = raw.trim().replace(/\s+/g, " ").slice(0, TAG_LENGTH);
    if (!value || !draft || draft.tags.length >= TAG_LIMIT || draft.tags.some(t => t.toLowerCase() === value.toLowerCase())) { setTagInput(""); return; }
    patch({ tags: [...draft.tags, value] }); setTagInput("");
  }
  async function reloadSaved() {
    if (!draft) return;
    dropDraft(draft.pageId);
    const next = await load();
    const fresh = next?.pages.find(p => p.id === draft.pageId);
    setRichEdit(null); setProblem("");
    if (fresh) { setDraft(draftFromPage(fresh)); setStatus("saved"); } else back();
  }
  async function remove() {
    if (!page) return;
    try {
      await api("/api/notebook", "POST", { action: "delete", id: page.id, version: page.version });
      dropDraft(page.id);
      setData(old => old ? { ...old, pages: old.pages.filter(p => p.id !== page.id) } : old);
      setConfirmDelete(false); setSelected(null); setDraft(null);
    } catch (e) { setConfirmDelete(false); setProblem((e as Error).message); }
  }

  if (loadError && !data) return <div className={styles.notice} role="alert"><p>Das Notizbuch konnte nicht geladen werden: {loadError}</p><button type="button" onClick={() => void load()}>Erneut laden</button></div>;
  if (!data) return <p className={styles.notice} role="status">Notizbuch wird geladen …</p>;

  const narrow = layout === "narrow";
  const shownStatus: Status = status === "saved" && dirty ? "dirty" : status === "dirty" && !dirty ? "saved" : status;
  const editing = !!draft && (selected === NEW || !!page);
  const list = <section className={styles.index} aria-label="Seiten im Notizbuch">
    {!readOnly && <button type="button" className={styles.newPage} onClick={create}><Plus size={17} aria-hidden="true" />Neue Seite</button>}
    <label className={styles.search}><Search size={15} aria-hidden="true" /><span className={styles.srOnly}>Notizbuch durchsuchen</span><input type="search" value={query} placeholder="Suchen in Thema, Text, Schlagwörtern" onChange={e => setQuery(e.target.value)} /></label>
    {!!tags.length && <div className={styles.tagFilter} role="group" aria-label="Nach Schlagwort filtern">
      <button type="button" aria-pressed={!tag} onClick={() => setTag("")}>Alle</button>
      {tags.map(t => <button type="button" key={t} aria-pressed={tag === t} onClick={() => setTag(tag === t ? "" : t)}>{t}</button>)}
    </div>}
    <p className={styles.count} role="status">{shown.length === pages.length ? `${pages.length} ${pages.length === 1 ? "Seite" : "Seiten"}` : `${shown.length} von ${pages.length} Seiten`}</p>
    {!pages.length ? <p className={styles.empty}>{readOnly ? "Noch keine Seite in diesem Notizbuch." : "Noch keine Seite. Halte fest, was am Abend geschah und welche Fragen offen sind."}</p>
      : !shown.length ? <p className={styles.empty}>Keine Seite passt zur Suche.</p>
      : <ol className={styles.pageList}>{shown.map(p => <li key={p.id}><button type="button" aria-current={selected === p.id ? "true" : undefined} onClick={() => open(p)}>
        <time dateTime={p.date}>{formatCalendarDate(p.date)}</time>
        <strong>{p.title}</strong>
        <span className={styles.excerpt}>{plainText(p.text).replace(/\s+/g, " ").slice(0, 90)}</span>
        {(p.source !== "notiz" || p.tags.length > 0) && <span className={styles.meta}>{p.source !== "notiz" && <em>{p.source === "figur" ? characterName(p.characterId) || sourceLabel.figur : sourceLabel[p.source]}</em>}{p.tags.slice(0, 4).map(t => <span key={t}>{t}</span>)}</span>}
      </button></li>)}</ol>}
  </section>;

  const sheet = editing && draft ? <article className={styles.paper} aria-label={readOnly ? "Notizbuchseite lesen" : "Notizbuchseite"}>
    <div className={styles.spiral} aria-hidden="true" />
    <div className={styles.sheet}>
      <header className={styles.pageHead}>
        {narrow && <button type="button" className={styles.back} onClick={back}><ArrowLeft size={16} aria-hidden="true" />Alle Seiten</button>}
        <span className={styles.saveState} data-state={readOnly ? "read" : shownStatus} role="status">{readOnly ? "Nur lesen" : statusText[shownStatus]}</span>
        <label className={styles.topic}><span>Thema</span>{readOnly ? <strong>{page?.title}</strong> : <input value={draft.title} maxLength={200} placeholder={page?.autoTitle || selected === NEW ? "freiwillig – sonst zählt die erste Zeile" : ""} onChange={e => patch({ title: e.target.value })} />}</label>
        <label className={styles.date}><span>Datum</span>{readOnly ? <time dateTime={draft.date}>{formatCalendarDate(draft.date)}</time> : <input type="date" value={draft.date} required onChange={e => e.target.value && patch({ date: e.target.value })} />}</label>
        {selected === NEW && !!data.characters.length && <label className={styles.figure}><span>Figur</span><select value={characterId} onChange={e => setCharacterId(e.target.value)}><option value="">keine Zuordnung</option>{data.characters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>}
        {page && page.source !== "notiz" && <p className={styles.origin}>{page.source === "ort" ? <><MapPin size={13} aria-hidden="true" />Ortsnotiz</> : page.source === "postfach" ? <><Mail size={13} aria-hidden="true" />Aus dem Postfach übernommen</> : <><UserRound size={13} aria-hidden="true" />Figurnotiz{characterName(page.characterId) ? " · " + characterName(page.characterId) : ""}</>}{page.visibility === "group" ? " · für die Gruppe freigegeben" : page.visibility === "sl" ? " · für die SL freigegeben" : ""}</p>}
      </header>
      <div className={styles.writing}>
        {readOnly ? (page?.rich ? <RichTextView value={page.text} /> : <p className={styles.plain}>{page?.text}</p>)
          : page?.rich && richEdit === null ? <><RichTextView value={draft.text} /><button type="button" className={styles.richEdit} onClick={() => { const converted = draft.text.startsWith("cvk-html-v1:") ? htmlToRichText(draft.text.slice("cvk-html-v1:".length)) : draft.text; setRichEdit(converted); patch({ text: converted }); }}><PenLine size={15} aria-hidden="true" />Formatierten Text bearbeiten</button></>
          : richEdit !== null ? <RichTextEditor value={draft.text} onChange={text => patch({ text })} label="Text der Seite" placeholder="Schreib hier …" maximumPlainLength={30000} />
          : <textarea ref={textRef} className={styles.lines} aria-label="Text der Seite" value={draft.text} maxLength={90000} placeholder="Was ist passiert? Was willst du noch herausfinden?" onChange={e => patch({ text: e.target.value })} />}
      </div>
      <footer className={styles.pageFoot}>
        <div className={styles.tags} role="group" aria-label="Schlagwörter dieser Seite">
          {draft.tags.map(t => <span key={t}>{t}{!readOnly && <button type="button" aria-label={"Schlagwort " + t + " entfernen"} onClick={() => patch({ tags: draft.tags.filter(x => x !== t) })}><X size={12} /></button>}</span>)}
          {!readOnly && draft.tags.length < TAG_LIMIT && <input aria-label="Schlagwort hinzufügen" list="notebook-tags" value={tagInput} maxLength={TAG_LENGTH} placeholder="+ Schlagwort" onChange={e => setTagInput(e.target.value)} onBlur={() => addTag(tagInput)} onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } }} />}
          <datalist id="notebook-tags">{tags.map(t => <option key={t} value={t} />)}</datalist>
        </div>
        {!readOnly && page && <button type="button" className={styles.delete} onClick={() => setConfirmDelete(true)}><Trash2 size={15} aria-hidden="true" />Seite löschen</button>}
      </footer>
      {problem && <div className={styles.problem} role="alert"><p>{problem}</p>
        {status === "conflict" && <div><button type="button" onClick={() => void save(true)}>Als neue Seite speichern</button><button type="button" onClick={() => void reloadSaved()}>Gespeicherte Fassung laden</button></div>}
        {status === "error" && <div><button type="button" onClick={() => void save()}>Erneut speichern</button></div>}
      </div>}
    </div>
  </article> : <div className={styles.placeholder}><p>{readOnly ? "Wähle links eine Seite." : "Wähle eine Seite oder beginne eine neue."}</p></div>;

  return <div className={`${styles.notebook} ${narrow ? styles.narrow : styles.wide}`} data-editing={editing || undefined}>
    {readOnly && <p className={styles.readNote}>Notizbuch von {data.owner.name} · nur lesen. Übernommene Briefe sind ausgeblendet.</p>}
    {(!narrow || !editing) && list}
    {(!narrow || editing) && sheet}
    <AlertDialog open={confirmDelete} onOpenChange={value => { if (!value) setConfirmDelete(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Seite löschen?</AlertDialogTitle>
          <AlertDialogDescription>{page?.deletion === "archive" ? "Diese Figurnotiz wird archiviert. Sie verschwindet aus dem Notizbuch und aus der Charakterverwaltung, bleibt aber gespeichert." : "Die Seite wird dauerhaft gelöscht. Das lässt sich nicht rückgängig machen."}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Behalten</AlertDialogCancel><AlertDialogAction onClick={e => { e.preventDefault(); void remove(); }}>{page?.deletion === "archive" ? "Archivieren" : "Löschen"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
