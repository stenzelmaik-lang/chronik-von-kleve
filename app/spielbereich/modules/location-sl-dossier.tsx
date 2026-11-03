/* eslint-disable @next/next/no-img-element -- Confidential images retain their existing authenticated CMS endpoint. */
"use client";

import { useCallback, useMemo, useState } from 'react';
import { LocationKnowledgeSearch } from './location-knowledge-search';
import { LocationChapters } from './location-chapters';
import { LocationMediaGallery } from './location-media-gallery';
import { ChevronDown, Shield } from 'lucide-react';
import type { PlaceProjection } from '@/domain/location-types';
import { slDossierEntries } from '@/domain/location-dossier';
import { RichTextView } from './rich-text';
import styles from './location-sl-dossier.module.css';

export function LocationSLDossier({ projection, selectedId, onSelect, initialSelectedId,onNavigate,releaseControls }: {
  projection: PlaceProjection; selectedId?: string; onSelect?: (id: string) => void; initialSelectedId?: string;onNavigate?:(href:string)=>boolean; releaseControls?:React.ReactNode;
}) {
  const entries = useMemo(() => slDossierEntries(projection), [projection]);
  const [selection, setSelection] = useState(initialSelectedId || projection.location.id);
  const [adopted,setAdopted]=useState<Record<string,boolean>>({});
  const chosen = entries.find(entry => entry.id === (selectedId ?? selection)) ?? entries[0];
  const shown = chosen ? [chosen] : [];
  const keyFor = (id: string, chapter: string) => id + ':' + chapter;
  const [expanded, setExpanded] = useState<Set<string>>(()=>{
    const first=chosen?.chapters.find(chapter=>!chapter.overview);
    return new Set(chosen&&first?[keyFor(chosen.id,first.key)]:[]);
  });
  const chapterKeys = chosen?.chapters.filter(chapter => !chapter.overview).map(chapter => keyFor(chosen.id, chapter.key))??[];

  function select(id: string) {
    setSelection(id);
    const first=entries.find(entry=>entry.id===id)?.chapters.find(chapter=>!chapter.overview);
    setExpanded(new Set(first?[keyFor(id,first.key)]:[]));
    onSelect?.(id);
  }

  // Defensive UI boundary; the existing API enforces authorization before any data arrives.
  if (!entries.length) return null;
  return <section className={styles.dossier} aria-label="Internes Ortswissen" data-sl-location-dossier={projection.location.id}>
    <header className={styles.header}><div><h2>{projection.location.title}</h2><p><Shield size={15} aria-hidden="true"/> Nur Spielleitung · gespeicherte interne Informationen</p></div></header>
    <div className={styles.tools}>
      <label className={styles.field}><span>Ort, Bereich oder Raum</span><select value={chosen?.id ?? ''} onChange={event => { select(event.target.value); }}>
        {entries.map(entry => <option key={entry.id} value={entry.id}>{entry.kind === 'Hauptort' ? entry.title : entry.kind + ': ' + entry.title + (entry.kind === 'Raum' ? ' · ' + entry.parentTitle : '')}</option>)}
      </select></label>

    </div>
    <details><summary>Ortswissen durchsuchen</summary><LocationKnowledgeSearch onNavigate={onNavigate} placeId={projection.location.id} view="sl"/></details>
    {shown.map(entry => {
      const area=projection.location.areas.find(item=>item.viewKey===entry.id);
      const room=projection.location.areas.flatMap(item=>item.rooms).find(item=>item.viewKey===entry.id);
      const introduction=entry.kind==='Hauptort'?(projection.location.atmosphere||projection.location.summary):area?.playerHint||room?.short;
      return <article key={entry.id} className={styles.entry}>
      <div className={styles.identity}><div><span>{entry.kind}{entry.parentTitle ? ' in ' + entry.parentTitle : ''}</span><h3>{entry.title}</h3></div></div>
      {releaseControls}
      <section className={styles.overview} aria-label={'Schnellübersicht: ' + entry.title}>
        <h4>Orientierung</h4>
        <dl><div><dt>Hauptort</dt><dd>{projection.location.title}</dd></div>{entry.parentTitle && entry.parentTitle !== projection.location.title && <div><dt>Übergeordnet</dt><dd>{entry.parentTitle}</dd></div>}</dl>
        {entry.children.length > 0 && <div className={styles.children}><span>{entry.kind === 'Hauptort' ? 'Bereiche' : 'Räume dieses Bereichs'}</span><div>{entry.children.map(child => <button type="button" key={child.id} onClick={() => { select(child.id); }}>{child.title}</button>)}</div></div>}
        {!adopted[entry.id]&&entry.chapters.filter(chapter => chapter.overview).map(chapter => <RichTextView key={chapter.key} value={chapter.content} readable flowing className={styles.prose}/>)}
      </section>
      {introduction&&<section className={styles.context}>
        <h4>Beschreibung im SL-Dossier</h4><RichTextView value={introduction} readable flowing className={styles.prose}/>
      </section>}
      {!adopted[entry.id]&&!entry.chapters.length && <p className={styles.empty}>Für diesen Eintrag sind noch keine internen Texte gespeichert. Interne Kapitel pflegst du in der Ortsredaktion unter „Nur Spielleitung · vertraulich“.</p>}
      {!adopted[entry.id]&&chapterKeys.length>0&&<div className={styles.chapterTools}><p>Interne Kapitel</p><div><button type="button" disabled={!chapterKeys.length || chapterKeys.every(key => expanded.has(key))} onClick={() => setExpanded(current => new Set([...current, ...chapterKeys]))}>Alle öffnen</button><button type="button" disabled={!chapterKeys.some(key => expanded.has(key))} onClick={() => setExpanded(current => new Set([...current].filter(key => !chapterKeys.includes(key))))}>Alle schließen</button></div></div>}
      <div className={styles.chapters}>{!adopted[entry.id]&&entry.chapters.filter(chapter => !chapter.overview).map(chapter => {
        const key = keyFor(entry.id, chapter.key);
        return <details key={key} className={styles.chapter} open={expanded.has(key)} onToggle={event => {
          const open = event.currentTarget.open;
          setExpanded(current => { if (current.has(key) === open) return current; const next = new Set(current); if (open) next.add(key); else next.delete(key); return next; });
        }}><summary><span>{chapter.title}</span><ChevronDown size={18} aria-hidden="true"/></summary><div className={styles.chapterContent}><RichTextView value={chapter.content} readable flowing className={styles.prose}/></div></details>;
      })}</div>
      <SavedChapters entityId={entry.id} onAdopted={setAdopted}/>
      <LocationMediaGallery media={entry.id===projection.location.id?projection.location.media:projection.location.areas.flatMap(area=>[{id:area.viewKey,media:area.media},...area.rooms.map(room=>({id:room.viewKey,media:room.media}))]).find(n=>n.id===entry.id)?.media}/>
      {entry.image && <figure className={styles.image}><img src={entry.image} alt={'Vertrauliche Ortsunterlage: ' + entry.title} loading="lazy"/><figcaption>Interne Ortsunterlage</figcaption></figure>}
      {entry.source && <p className={styles.source}>Herkunft: {entry.source}</p>}
    </article>;})}
  </section>;
}

function SavedChapters({entityId,onAdopted}:{entityId:string;onAdopted:React.Dispatch<React.SetStateAction<Record<string,boolean>>>}){
 const adopted=useCallback((value:boolean)=>onAdopted(current=>current[entityId]===value?current:{...current,[entityId]:value}),[entityId,onAdopted]);
 return <LocationChapters entityId={entityId} readOnly onAdopted={adopted}/>;
}
