"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Plus, Save, History, Link2, LockKeyhole, Pencil, Check, X } from 'lucide-react';
import { storySectionLabels, type StoryDocument, type StoryView, type StorySection, type StoryHistory, type CommandReference } from '@/domain/command-workspace';
import { api, ApiError } from './api-client';
import { RichTextEditor, RichTextView } from './rich-text';
import styles from './command-workspace.module.css';
import type { SceneSummary } from '@/domain/story-scene';
import sceneStyles from './story-scene.module.css';

type Props = { allowEditing?: boolean; id: string; version?: number; references: CommandReference[]; scenes:SceneSummary[];onOpenScene:(id:string)=>void; onChanged: () => void; onDirty: (dirty: boolean) => void; onOpenReference: (reference: CommandReference) => void; onDenied: () => void; ask: (text: string) => Promise<boolean> };
const documentOf = (s: StoryView): StoryDocument => ({ title: s.title, sections: s.sections, references: s.references, possibilities: s.possibilities });
export function CommandStory({ allowEditing = true, id, version, references, scenes, onOpenScene, onChanged, onDirty, onOpenReference, onDenied, ask }: Props) {
  const [story, setStory] = useState<StoryView | null>(null), [document, setDocument] = useState<StoryDocument | null>(null);
  const [editing, setEditing] = useState(false), [section, setSection] = useState<StorySection>('core');
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState('');
  const [history, setHistory] = useState<StoryHistory[] | null>(null), [remote, setRemote] = useState<StoryView | null>(null), [referenceSearch, setReferenceSearch] = useState('');
  const [possibilityTitle, setPossibilityTitle] = useState(''), [editorGeneration, setEditorGeneration] = useState(0);
  const current = useRef<StoryDocument | null>(null), revision = useRef(0), inFlight = useRef(false);
  const dirtyRef = useRef(false), alive = useRef(true);
  const changedCallback = useRef(onChanged), deniedCallback = useRef(onDenied), dirtyCallback = useRef(onDirty);
  useEffect(() => { changedCallback.current = onChanged; deniedCallback.current = onDenied; dirtyCallback.current = onDirty; }, [onChanged, onDenied, onDirty]);
  useEffect(() => {
    alive.current = true; return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    let active = true;
    api<{ story: StoryView }>('/api/command-center/story?id=' + encodeURIComponent(id)).then(r => {
      if (!active) return;
      if (dirtyRef.current || inFlight.current) { if (r.story.version !== revision.current) { setRemote(r.story); setError('Eine andere Fassung wurde gespeichert. Deine offenen Eingaben bleiben erhalten; prüfe den Vergleich.'); } return; }
      const updated = revision.current !== r.story.version; setStory(r.story); const doc = documentOf(r.story); setDocument(doc); current.current = doc; revision.current = r.story.version; if (updated) setEditorGeneration(n => n + 1);
    }).catch(e => { if (active) { setError(e.message); if (e instanceof ApiError && [401, 403].includes(e.status)) deniedCallback.current(); } });
    return () => { active = false; };
  }, [id, version]);
  function change(doc: StoryDocument) { setDocument(doc); current.current = doc; dirtyRef.current = true; setDirty(true); dirtyCallback.current(true); setSaved(''); }
  const save = useCallback(async () => {
    if (!current.current || inFlight.current) return;
    const sent = current.current; inFlight.current = true; setBusy(true); setError('');
    try {
      const r = await api<{ story: StoryView }>('/api/command-center/story', 'POST', { action: 'save', id, version: revision.current, document: sent });
      if (!alive.current) return;
      revision.current = r.story.version; setStory(r.story); setRemote(null);
      const unchanged = JSON.stringify(current.current) === JSON.stringify(sent); dirtyRef.current = !unchanged; setDirty(!unchanged); dirtyCallback.current(!unchanged);
      setSaved('Privat gespeichert · ' + new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })); changedCallback.current();
    } catch (e) {
      if (!alive.current) return;
      setError((e as Error).message);
      if (e instanceof ApiError && [401, 403].includes(e.status)) deniedCallback.current();
      if (e instanceof ApiError && e.status === 409) { try { const r = await api<{ story: StoryView }>('/api/command-center/story?id=' + encodeURIComponent(id)); setRemote(r.story); } catch { /* Preserve the local input. */ } }
    } finally { inFlight.current = false; setBusy(false); }
  }, [id]);
  useEffect(() => { if (!dirty || busy || error) return; const timer = window.setTimeout(() => void save(), 1000); return () => window.clearTimeout(timer); }, [dirty, busy, document, error, save]);
  async function loadHistory() { try { const r = await api<{ history: StoryHistory[] }>('/api/command-center/story?id=' + encodeURIComponent(id) + '&history=1'); setHistory(r.history); } catch (e) { setError((e as Error).message); } }
  async function restore(item: StoryHistory) {
    if (!allowEditing) return;
    if (!await ask('Diesen historischen Stand als neue aktuelle Fassung übernehmen? Die bisherige Historie bleibt erhalten.')) return;
    if (inFlight.current || dirty && !await ask('Deine ungespeicherten Eingaben verwerfen?')) return;
    inFlight.current = true; setBusy(true); setError('');
    try { const r = await api<{ story: StoryView }>('/api/command-center/story', 'POST', { action: 'restore', id, version: revision.current, historyId: item.id }); revision.current = r.story.version; setStory(r.story); const doc = documentOf(r.story); setDocument(doc); current.current = doc; setEditorGeneration(n => n + 1); dirtyRef.current = false; setDirty(false); dirtyCallback.current(false); setHistory(null); changedCallback.current(); setSaved('Historischer Stand als neue Fassung gespeichert.'); } catch (e) { setError((e as Error).message); } finally { inFlight.current = false; setBusy(false); }
  }
  if (!story || !document) return <div className={styles.empty}><BookOpen size={30}/><p role={error ? 'alert' : 'status'}>{error || 'Plotdossier wird geladen …'}</p></div>;
  const linked = document.references.map(ref => references.find(r => r.id === ref)).filter((r): r is CommandReference => !!r);
  const available = references.filter(r => !document.references.includes(r.id) && (r.title + ' ' + r.type).toLowerCase().includes(referenceSearch.toLowerCase())).slice(0, 8);
  return <div className={styles.story}>
    {scenes.some(s=>s.storyId===id)&&<nav className={sceneStyles.relatedScenes} aria-label="Szenen dieses Handlungsstrangs">{scenes.filter(s=>s.storyId===id).map(s=><button key={s.id} onClick={()=>onOpenScene(s.id)}>{s.title}</button>)}</nav>}
    <div className={styles.documentBar}><span className={styles.private}><LockKeyhole size={12}/>Nur Spielleitung</span><button disabled={!allowEditing} title={!allowEditing ? "Im Command Center bearbeiten" : undefined} onClick={() => setEditing(!editing)} aria-pressed={editing}><Pencil size={14}/>{editing ? 'Lesen' : 'Bearbeiten'}</button><button onClick={() => void loadHistory()}><History size={14}/><span>Verlauf</span></button></div>
    {editing ? <label className={styles.field}>Titel des Handlungsstrangs<input aria-label="Titel des Handlungsstrangs" value={document.title} maxLength={200} onChange={e => change({ ...document, title: e.target.value })}/></label> : <h2 className={styles.documentTitle}>{document.title}</h2>}
    <nav className={styles.sectionTabs} aria-label="Storyabschnitte">{Object.entries(storySectionLabels).map(([key, label]) => <button key={key} aria-pressed={section === key} onClick={() => setSection(key as StorySection)}>{label}{document.sections[key as StorySection] ? <i/> : null}</button>)}</nav>
    {editing ? <RichTextEditor key={section + '-' + editorGeneration} label={storySectionLabels[section]} value={document.sections[section]} maximumPlainLength={10000} placeholder="Deine vorbereiteten Informationen …" onChange={value => change({ ...document, sections: { ...document.sections, [section]: value } })}/> : <div className={styles.storyText}>{document.sections[section] ? <RichTextView value={document.sections[section]}/> : <div className={styles.blankText}><BookOpen size={23}/><p>Dieser Abschnitt ist noch leer.</p><button disabled={!allowEditing} onClick={() => setEditing(true)}>Informationen ergänzen</button></div>}</div>}
    <section className={styles.references}><h3><Link2 size={14}/>Verknüpfte Akten</h3><div>{linked.map(r => <span key={r.id}><button onClick={() => onOpenReference(r)}>{r.title}</button>{editing && <button aria-label={'Verknüpfung ' + r.title + ' entfernen'} onClick={() => change({ ...document, references: document.references.filter(ref => ref !== r.id) })}><X size={12}/></button>}</span>)}</div>{!linked.length && <p>Verweise auf die vorhandenen Akten; Inhalte werden nicht kopiert.</p>}{editing && <><input aria-label="Akte zum Verknüpfen suchen" placeholder="Ort, NSC, Fraktion oder Handout suchen" value={referenceSearch} onChange={e => setReferenceSearch(e.target.value)}/>{referenceSearch && available.map(r => <button className={styles.searchRow} key={r.id} onClick={() => { change({ ...document, references: [...document.references, r.id] }); setReferenceSearch(''); }}><span>{r.title}</span><small>{r.type}</small><Plus size={14}/></button>)}</>}</section>
    <details className={styles.fold}><summary>Vorbereitete Möglichkeiten · {document.possibilities.filter(p => p.status === 'open').length} offen</summary><p>Optionen für deine Regie. Eine Momentnotiz erledigt sie niemals automatisch.</p>{document.possibilities.map(p => <article key={p.id} className={styles.possibility}><strong>{p.title}</strong>{p.text && <p>{p.text}</p>}{editing ? <><textarea aria-label={'Vorbereitung ' + p.title} value={p.text} maxLength={3000} onChange={e => change({ ...document, possibilities: document.possibilities.map(old => old.id === p.id ? { ...old, text: e.target.value } : old) })}/><select aria-label={'Stand ' + p.title} value={p.status} onChange={e => change({ ...document, possibilities: document.possibilities.map(old => old.id === p.id ? { ...old, status: e.target.value as typeof p.status } : old) })}><option value="open">Offene Möglichkeit</option><option value="used">Von mir ausgespielt</option><option value="discarded">Verworfen</option></select></> : <small>{p.status === 'open' ? 'Vorbereitet · offen' : p.status === 'used' ? 'Als ausgespielt markiert' : 'Verworfen'}</small>}</article>)}{editing && <form className={styles.inlineForm} onSubmit={e => { e.preventDefault(); if (!possibilityTitle.trim()) return; change({ ...document, possibilities: [...document.possibilities, { id: crypto.randomUUID(), title: possibilityTitle.trim(), text: '', status: 'open' }] }); setPossibilityTitle(''); }}><input aria-label="Neue vorbereitete Möglichkeit" placeholder="Eine mögliche Entwicklung …" value={possibilityTitle} maxLength={200} onChange={e => setPossibilityTitle(e.target.value)}/><button disabled={!possibilityTitle.trim() || document.possibilities.length >= 50}><Plus size={15}/>Ergänzen</button></form>}</details>
    {error && <p role="alert" className={styles.error}>{error}</p>}{remote && <details open className={styles.conflict}><summary>Vergleich mit dem inzwischen gespeicherten Stand</summary><h3>{remote.title}</h3><RichTextView value={remote.sections[section]}/><button disabled={busy} onClick={async () => { if (!await ask('Deine aktuelle lokale Fassung bewusst über den angezeigten Serverstand speichern?')) return; revision.current = remote.version; setRemote(null); setError(''); void save(); }}>Meine Fassung nach Vergleich speichern</button></details>}
    {history && <section className={styles.history}><h3>Gespeicherte Fassungen</h3>{history.map(h => <div key={h.id}><span>Fassung {h.version} · {new Date(h.createdAt).toLocaleString('de-DE')}</span><button disabled={busy || !allowEditing} onClick={() => void restore(h)}>Wiederherstellen</button></div>)}<button onClick={() => setHistory(null)}>Verlauf schließen</button></section>}
    <footer className={styles.saveStatus}><span role="status">{busy ? 'Speichert …' : dirty ? 'Änderungen offen' : saved || 'Gespeicherter privater Stand'}</span>{dirty && <button disabled={busy || !document.title.trim()} onClick={() => void save()}><Save size={14}/>Jetzt speichern</button>}{!dirty && <Check size={13}/>}</footer>
  </div>;
}
