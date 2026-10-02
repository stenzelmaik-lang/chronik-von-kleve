"use client";
import { useEffect, useState } from 'react';
import { Search, Star, LockKeyhole } from 'lucide-react';
import type { Entity } from '@/domain/types';
import type { CommandReference } from '@/domain/command-workspace';
import { api, ApiError } from './api-client';
import { RichTextView } from './rich-text';
import styles from './command-workspace.module.css';
export function CommandDossier({ id, references, favorites, onSelect, onFavorite, onDenied }: { id: string; references: CommandReference[]; favorites: string[]; onSelect: (id: string) => void; onFavorite: (id: string) => void; onDenied: () => void }) {
  const [search, setSearch] = useState(''), [result, setResult] = useState<{ id: string; entity?: Entity; error?: string } | null>(null);
  useEffect(() => { if (!id) return; let live = true; api<{ entities: Entity[] }>('/api/entities?id=' + encodeURIComponent(id)).then(r => { if (live) setResult({ id, entity: r.entities[0] }); }).catch(e => { if (live) { setResult({ id, error: e.message }); if (e instanceof ApiError && [401, 403].includes(e.status)) onDenied(); } }); return () => { live = false; }; }, [id, onDenied]);
  const candidates = references.filter(r => ['NPC', 'FACTION', 'CLUE', 'HANDOUT', 'RULE'].includes(r.type) && (r.title + ' ' + r.summary).toLowerCase().includes(search.toLowerCase())).sort((a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id))).slice(0, 40);
  const entity = result?.id === id ? result.entity : null;
  const text = (name: string) => typeof entity?.content[name] === 'string' ? entity.content[name] as string : '';
  return <div><label className={styles.searchField}><Search size={14}/><input aria-label="NSC und Akten suchen" placeholder="NSC, Fraktion, Hinweis …" value={search} onChange={e => setSearch(e.target.value)}/></label>{!id || search ? <div className={styles.dossierList}>{candidates.map(r => <div key={r.id}><button className={styles.searchRow} onClick={() => { onSelect(r.id); setSearch(''); }}><span><strong>{r.title}</strong><small>{r.type} · {r.summary}</small></span></button><button className={styles.iconButton} aria-label={r.title + ' als Favorit'} aria-pressed={favorites.includes(r.id)} onClick={() => onFavorite(r.id)}><Star size={14}/></button></div>)}{!candidates.length && <p className={styles.hint}>Keine passenden vorhandenen Akten.</p>}</div> : entity ? <article className={styles.story}><p className={styles.private}><LockKeyhole size={12}/>Bestehende Kampagnenakte</p><h2 className={styles.documentTitle}>{entity.title}</h2>{['summary', 'text', 'description', 'goals', 'motives'].map(key => text(key) ? <section key={key}><RichTextView value={text(key)}/></section> : null)}{entity.gmBody && <details className={styles.fold}><summary>Vertrauliche SL-Informationen</summary><RichTextView value={entity.gmBody}/></details>}<button onClick={() => onSelect('')}>Zur Aktenauswahl</button></article> : <p role={result?.id === id && result.error ? 'alert' : 'status'}>{result?.id === id && result.error || 'Akte wird geladen …'}</p>}</div>;
}
