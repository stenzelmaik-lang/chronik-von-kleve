/* eslint-disable @next/next/no-img-element -- Authenticated file images. */
"use client";
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Entity } from '@/domain/types';
import { api } from './api-client';
import { describeDataError, requestPlayerData } from './player-data-cache';
import { loadNPCList, loadNPCDetail, npcListPath } from './npc-data';
import { safeImage } from './shared';
import { RichTextView } from './rich-text';
import { npcCardData } from './npc-card-data';
import cards from './npc-cards.module.css';

type Detail = Awaited<ReturnType<typeof loadNPCDetail>>;
export function NPCPanel({ dataScope, gm }: { dataScope: string; gm: boolean }) {
  const [entities, setEntities] = useState<Entity[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [refreshing, setRefreshing] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    requestPlayerData(dataScope, npcListPath, () => loadNPCList(api), { force: refresh > 0 })
      .then(value => { if (alive) { setEntities(value); setError(null); } })
      .catch(e => { if (alive) { setError(e); if (describeDataError(e).permission) { setEntities(null); setSelected(null); } } })
      .finally(() => { if (alive) setRefreshing(false); });
    return () => { alive = false; };
  }, [dataScope, refresh]);
  const list = (entities ?? []).filter(e => (e.title + ' ' + JSON.stringify(e.content)).toLowerCase().includes(search.toLowerCase()));
  return <>
    {entities && refreshing && <p className="muted" role="status">Wird aktualisiert …</p>}
    {error && <section role="alert" className="error-box"><h2>{describeDataError(error).title}</h2><p>{error.message}</p><button className="button" onClick={() => { setError(null); setRefreshing(true); setRefresh(n => n + 1); }}>Erneut versuchen</button></section>}
    {!entities && !error ? <div className="entry-grid">{[1, 2, 3].map(i => <Skeleton key={i} className="h-56 w-full" />)}</div> : entities && <>
      <div className="search-row"><Search size={18} /><input aria-label="NPC durchsuchen" placeholder="Persönlichkeiten durchsuchen …" value={search} onChange={e => setSearch(e.target.value)} /><span>{list.length} Einträge</span></div>
      {!list.length ? <Empty className="empty-night"><EmptyHeader><EmptyTitle>{search ? 'Keine passenden Einträge' : 'Hier beginnt die nächste Geschichte.'}</EmptyTitle><EmptyDescription>{search ? 'Versuche einen anderen Suchbegriff.' : gm ? 'Noch keine NPC-Originalobjekte vorhanden.' : 'Die Spielleitung hat hier noch keine Inhalte freigegeben.'}</EmptyDescription></EmptyHeader></Empty> : <div className={cards.grid}>{list.map(e => {
        const image = safeImage(e.content.image);
        const card = npcCardData(e);
        return <button key={e.id} className={cards.card} aria-label={`${e.title}${card.alias ? ` · ${card.alias}` : ''} – Akte öffnen`} onClick={() => setSelected(e.id)}>
          <span className={cards.portrait} aria-hidden="true">{gm && (e.defaultVisibility === 'sl_secret' || e.canonStatus === 'GM_SECRET') && <span className={cards.secret}>SL-INTERN</span>}{image ? <img src={image} alt="" loading="lazy" /> : <><span className={cards.placeholder}>{card.initials}</span><span className={cards.noPortrait}>Kein Bild hinterlegt</span></>}</span>
          <span className={cards.body}><span className={cards.name}>{e.title}</span>{card.alias && <span className={cards.alias}>{card.alias}</span>}<span className={cards.facts}>{card.facts.map(fact => <span key={fact.label} className={cards.fact}><span className={cards.factLabel}>{fact.label}</span><span className={cards.factValue}>{fact.value}</span></span>)}</span><span className={cards.open}>Akte öffnen <span aria-hidden="true">↗</span></span></span>
        </button>;
      })}</div>}
    </>}
    <Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="!max-w-5xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{entities?.find(e => e.id === selected)?.title ?? 'NPC'}</DialogTitle><DialogDescription>Für dich freigegebene Inhalte der Originalakte.</DialogDescription></DialogHeader>{selected && <NPCDetail key={selected} id={selected} entities={entities ?? []} gm={gm} onDenied={() => { setSelected(null); setEntities(null); setRefresh(n => n + 1); }} />}</DialogContent></Dialog>
  </>;
}
function NPCDetail({ id, entities, gm, onDenied }: { id: string; entities: Entity[]; gm: boolean; onDenied: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    loadNPCDetail(api, id, gm).then(d => { if (alive) setDetail(d); }).catch(e => {
      if (alive) { setError(e); if (describeDataError(e).permission) onDenied(); }
    });
    return () => { alive = false; };
    // The callback is deliberately not a load dependency: parent renders must not restart requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, gm, retry]);
  if (error) return <section role="alert" className="error-box"><p>{error.message}</p><button className="button" onClick={() => { setDetail(null); setError(null); setRetry(n => n + 1); }}>Erneut versuchen</button></section>;
  if (!detail) return <p role="status">Akte wird geladen …</p>;
  const text = (key: string) => typeof detail.entity.content[key] === 'string' ? detail.entity.content[key] as string : '';
  return <article>
    {['summary', 'text', 'description', 'goals', 'motives'].map(key => text(key) ? <section key={key}><RichTextView value={text(key)} /></section> : null)}
    <h2>Inhaltsbereiche</h2>{!detail.blocks.length && <p className="muted">Keine freigegebenen Inhaltsbereiche.</p>}
    {detail.blocks.map(block => <section key={block.id}><h3>{block.kind}</h3>{gm && block.visibility === 'sl_secret' && <p className="badge">SL-INTERN</p>}<RichTextView value={block.content} /></section>)}
    {gm && detail.entity.gmBody && <section><h2>SL-INTERN</h2><RichTextView value={detail.entity.gmBody} /></section>}
    <h2>Beziehungen</h2>{!detail.relationships.length ? <p className="muted">Keine freigegebenen Beziehungen.</p> : <ul>{detail.relationships.map(r => {
      const other = r.sourceId === id ? r.targetId : r.sourceId;
      return <li key={r.id}>{r.type} · {r.sourceId === id ? 'zu' : 'von'} {detail.relatedEntities.find(e => e.id === other)?.title ?? entities.find(e => e.id === other)?.title ?? 'Nicht verfügbare Akte'}</li>;
    })}</ul>}
  </article>;
}
