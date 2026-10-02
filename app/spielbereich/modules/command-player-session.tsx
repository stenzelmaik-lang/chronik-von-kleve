"use client";
import { useEffect, useState } from 'react';
import type { Actor, Entity } from '@/domain/types';
import type { Entry } from '@/domain/legacy';
import { api } from './api-client';
import { SessionPanel } from './session';
import styles from './command-center.module.css';
import type { PlayerScene } from '@/domain/story-scene';
import { ScenePlayerView } from './scene-player-view';
import sceneStyles from './story-scene.module.css';
export type PlayerCommandData = { sessions: Entry[]; handouts: { id: string; title: string; text: string }[]; scenes?:PlayerScene[] };
export function PlayerSession({ entries, a, onRefresh, preview }: { entries: Entry[]; a: Actor; onRefresh: () => void; preview?: PlayerCommandData }) {
  const [data, setData] = useState<PlayerCommandData>({ sessions: entries, handouts: [] }), [error, setError] = useState('');
  const [characterId,setCharacterId]=useState(''),[characters,setCharacters]=useState<{id:string;title:string}[]>([]);
  useEffect(()=>{let live=true;if(!preview)queueMicrotask(()=>{if(live)setCharacterId(new URLSearchParams(window.location.search).get('sceneCharacter')||'');});return()=>{live=false;};},[preview]);
  useEffect(() => {
    if (preview) return;
    let live = true, busy = false;
    const load = async () => {
      if (busy) return; busy = true;
      try {
        const [records, entities,sceneData] = await Promise.all([api<{ records: Entry[] }>('/api/records?kind=sitzungen'), api<{ entities: Entity[] }>('/api/entities'+(characterId?'?characterId='+encodeURIComponent(characterId):'')),api<{scenes:PlayerScene[];characters:typeof characters}>('/api/session-scenes'+(characterId?'?characterId='+encodeURIComponent(characterId):''))]);
        if (live) { setData({ sessions: records.records, scenes:sceneData.scenes, handouts: entities.entities.filter(e => e.type === 'HANDOUT').map(e => ({ id: e.id, title: e.title, text: typeof e.content.text === 'string' ? e.content.text : '' })) });setCharacters(sceneData.characters); setError(''); }
      } catch (e) { if (live) { setData({ sessions: [], handouts: [],scenes:[] }); setError((e as Error).message); } } finally { busy = false; }
    };
    void load(); window.addEventListener('focus', load);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 10000);
    return () => { live = false; window.removeEventListener('focus', load); window.clearInterval(timer); };
  }, [a.id, a.campaignId, preview,characterId]);
  const visible = preview || data;
  return <div className={styles.player}>
    {!preview && <header className={styles.playerTitle}><p className="eyebrow">DEIN SPIELTISCH</p><h1>Die aktuelle Nacht</h1><span>Szene, Reihenfolge und freigegebene Hinweise an einem Ort.</span></header>}
    {error && <p role="alert" className={styles.notice}>Der Spielstand konnte nicht aktualisiert werden: {error}</p>}
    {!preview&&<label className={sceneStyles.playerCharacter}>Wissensansicht<select aria-label="Charakterwissen auswählen" value={characterId} onChange={e=>{setCharacterId(e.target.value);setData({sessions:[],handouts:[],scenes:[]});const url=new URL(window.location.href);if(e.target.value)url.searchParams.set('sceneCharacter',e.target.value);else url.searchParams.delete('sceneCharacter');window.history.replaceState(window.history.state,'',url);}}><option value="">Nur gemeinsames Gruppenwissen</option>{characters.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select><small>Persönliche Entdeckungen bleiben beim ausgewählten Charakter.</small>{error&&characterId&&<button onClick={()=>{setCharacterId('');const url=new URL(window.location.href);url.searchParams.delete('sceneCharacter');window.history.replaceState(window.history.state,'',url);}}>Zur Gruppenansicht</button>}</label>}
    <ScenePlayerView scenes={visible.scenes||[]}/>
    <SessionPanel key={visible.sessions.map(e => e.id + ':' + e.version).join(',')} entries={visible.sessions} a={{ ...a, gm: false, role: 'player' }} onRefresh={onRefresh} compact/>
    <section className={styles.playerHandouts}><p className="eyebrow">FÜR DICH FREIGEGEBEN</p><h2>Hinweise & Handouts</h2>{visible.handouts.map(h => <article className={styles.handout} key={h.id}><h3>{h.title}</h3><p>{h.text || 'Kein Text hinterlegt. Zugehörige Dateien findest du im Dokumentbereich.'}</p></article>)}{!error && !visible.handouts.length && <p className={styles.muted}>Neue Freigaben erscheinen hier automatisch.</p>}</section>
    {!preview && <p className={styles.sync}>Abgleich alle zehn Sekunden und bei Rückkehr zum Fenster.</p>}
  </div>;
}
