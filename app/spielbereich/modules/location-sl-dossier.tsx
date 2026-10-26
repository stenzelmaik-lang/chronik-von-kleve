/* eslint-disable @next/next/no-img-element -- Confidential images retain their existing authenticated CMS endpoint. */
"use client";

import { useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Shield, X } from 'lucide-react';
import type { PlaceProjection } from '@/domain/location-types';
import { searchSlDossier, slDossierEntries } from '@/domain/location-dossier';
import { RichTextView } from './rich-text';
import styles from './location-sl-dossier.module.css';

export function LocationSLDossier({ projection, selectedId, onSelect, initialSelectedId }: {
  projection: PlaceProjection; selectedId?: string; onSelect?: (id: string) => void; initialSelectedId?: string;
}) {
  const entries = useMemo(() => slDossierEntries(projection), [projection]);
  const [selection, setSelection] = useState(initialSelectedId || projection.location.id);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const beforeSearch = useRef<Set<string>>(new Set());
  const searchId = useId();
  const chosen = entries.find(entry => entry.id === (selectedId ?? selection)) ?? entries[0];
  const matches = useMemo(() => searchSlDossier(entries, query), [entries, query]);
  const shown = query.trim() ? matches : chosen ? [chosen] : [];
  const keyFor = (id: string, chapter: string) => id + ':' + chapter;
  const chapterKeys = shown.flatMap(entry => entry.chapters.filter(chapter => !chapter.overview).map(chapter => keyFor(entry.id, chapter.key)));

  function select(id: string) { setSelection(id); onSelect?.(id); }
  function search(value: string) {
    if (!query.trim() && value.trim()) beforeSearch.current = new Set(expanded);
    setQuery(value);
    setExpanded(value.trim()
      ? new Set(searchSlDossier(entries, value).flatMap(entry => entry.chapters.map(chapter => keyFor(entry.id, chapter.key))))
      : new Set(beforeSearch.current));
  }

  // Defensive UI boundary; the existing API enforces authorization before any data arrives.
  if (!entries.length) return null;
  return <section className={styles.dossier} aria-label="Internes Ortswissen" data-sl-location-dossier={projection.location.id}>
    <header className={styles.header}><div><h2>{projection.location.title}</h2><p><Shield size={15} aria-hidden="true"/> Nur Spielleitung · gespeicherte interne Informationen</p></div></header>
    <div className={styles.tools}>
      <label className={styles.field}><span>Ort, Bereich oder Raum</span><select value={chosen?.id ?? ''} onChange={event => { select(event.target.value); search(''); }}>
        {entries.map(entry => <option key={entry.id} value={entry.id}>{entry.kind === 'Hauptort' ? entry.title : entry.kind + ': ' + entry.title + (entry.kind === 'Raum' ? ' · ' + entry.parentTitle : '')}</option>)}
      </select></label>
      <div className={styles.field}><label htmlFor={searchId}>Ortswissen durchsuchen</label><div className={styles.search}><Search size={17} aria-hidden="true"/><input id={searchId} type="search" value={query} onChange={event => search(event.target.value)} placeholder="Im gesamten Ort suchen …"/>{query && <button type="button" onClick={() => search('')} aria-label="Ortswissensuche leeren"><X size={16} aria-hidden="true"/></button>}</div></div>
    </div>
    <div className={styles.chapterTools}><p role="status">{query.trim() ? `${shown.length} ${shown.length === 1 ? 'passender Eintrag' : 'passende Einträge'}` : 'Schnellübersicht und interne Kapitel'}</p><div><button type="button" disabled={!chapterKeys.length || chapterKeys.every(key => expanded.has(key))} onClick={() => setExpanded(current => new Set([...current, ...chapterKeys]))}>Alle öffnen</button><button type="button" disabled={!chapterKeys.some(key => expanded.has(key))} onClick={() => setExpanded(current => new Set([...current].filter(key => !chapterKeys.includes(key))))}>Alle schließen</button></div></div>
    {!shown.length && <div className={styles.empty}><h3>Keine passende Ortsinformation</h3><p>Versuche einen anderen Begriff oder leere die Suche.</p><button type="button" onClick={() => search('')}>Suche leeren</button></div>}
    {shown.map(entry => <article key={entry.id} className={styles.entry}>
      <div className={styles.identity}><div><span>{entry.kind}{entry.parentTitle ? ' in ' + entry.parentTitle : ''}</span><h3>{entry.title}</h3></div>{query.trim() && entry.id !== chosen?.id && <button type="button" onClick={() => { select(entry.id); search(''); }}>Eintrag öffnen</button>}</div>
      <section className={styles.overview} aria-label={'Schnellübersicht: ' + entry.title}>
        <h4>Schnellübersicht</h4>
        <dl><div><dt>Hauptort</dt><dd>{projection.location.title}</dd></div>{entry.parentTitle && entry.parentTitle !== projection.location.title && <div><dt>Übergeordnet</dt><dd>{entry.parentTitle}</dd></div>}</dl>
        {entry.children.length > 0 && <div className={styles.children}><span>{entry.kind === 'Hauptort' ? 'Bereiche' : 'Räume dieses Bereichs'}</span><div>{entry.children.map(child => <button type="button" key={child.id} onClick={() => { select(child.id); search(''); }}>{child.title}</button>)}</div></div>}
        {entry.chapters.filter(chapter => chapter.overview).map(chapter => <RichTextView key={chapter.key} value={chapter.content} readable flowing className={styles.prose}/>)}
      </section>
      {!entry.chapters.length && <p className={styles.empty}>Für diesen Eintrag sind noch keine internen Texte gespeichert. Interne Kapitel pflegst du in der Ortsredaktion unter „Nur Spielleitung · vertraulich“.</p>}
      <div className={styles.chapters}>{entry.chapters.filter(chapter => !chapter.overview).map(chapter => {
        const key = keyFor(entry.id, chapter.key);
        return <details key={key} className={styles.chapter} open={expanded.has(key)} onToggle={event => {
          const open = event.currentTarget.open;
          setExpanded(current => { if (current.has(key) === open) return current; const next = new Set(current); if (open) next.add(key); else next.delete(key); return next; });
        }}><summary><span>{chapter.title}</span><ChevronDown size={18} aria-hidden="true"/></summary><div className={styles.chapterContent}><RichTextView value={chapter.content} readable flowing className={styles.prose}/></div></details>;
      })}</div>
      {entry.image && <figure className={styles.image}><img src={entry.image} alt={'Vertrauliche Ortsunterlage: ' + entry.title} loading="lazy"/><figcaption>Interne Ortsunterlage</figcaption></figure>}
      {entry.source && <p className={styles.source}>Herkunft: {entry.source}</p>}
    </article>)}
  </section>;
}
