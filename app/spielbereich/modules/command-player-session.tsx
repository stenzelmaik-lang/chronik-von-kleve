"use client";
import { useEffect, useState } from 'react';
import type { Actor, Entity } from '@/domain/types';
import type { Entry } from '@/domain/legacy';
import { api } from './api-client';
import { SessionPanel } from './session';
import styles from './command-center.module.css';
export type PlayerCommandData = { sessions: Entry[]; handouts: { id: string; title: string; text: string }[] };
export function PlayerSession({ entries, a, onRefresh, preview }: { entries: Entry[]; a: Actor; onRefresh: () => void; preview?: PlayerCommandData }) {
  const [data, setData] = useState<PlayerCommandData>({ sessions: entries, handouts: [] }), [error, setError] = useState('');
  useEffect(() => {
    if (preview) return;
    let live = true, busy = false;
    const load = async () => {
      if (busy) return; busy = true;
      try {
        const [records, entities] = await Promise.all([api<{ records: Entry[] }>('/api/records?kind=sitzungen'), api<{ entities: Entity[] }>('/api/entities')]);
        if (live) { setData({ sessions: records.records, handouts: entities.entities.filter(e => e.type === 'HANDOUT').map(e => ({ id: e.id, title: e.title, text: typeof e.content.text === 'string' ? e.content.text : '' })) }); setError(''); }
      } catch (e) { if (live) { setData({ sessions: [], handouts: [] }); setError((e as Error).message); } } finally { busy = false; }
    };
    void load(); window.addEventListener('focus', load);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 10000);
    return () => { live = false; window.removeEventListener('focus', load); window.clearInterval(timer); };
  }, [a.id, a.campaignId, preview]);
  const visible = preview || data;
  return <div className={styles.player}>
    {!preview && <header className={styles.playerTitle}><p className="eyebrow">DEIN SPIELTISCH</p><h1>Die aktuelle Nacht</h1><span>Szene, Reihenfolge und freigegebene Hinweise an einem Ort.</span></header>}
    {error && <p role="alert" className={styles.notice}>Der Spielstand konnte nicht aktualisiert werden: {error}</p>}
    <SessionPanel key={visible.sessions.map(e => e.id + ':' + e.version).join(',')} entries={visible.sessions} a={{ ...a, gm: false, role: 'player' }} onRefresh={onRefresh} compact/>
    <section className={styles.playerHandouts}><p className="eyebrow">FÜR DICH FREIGEGEBEN</p><h2>Hinweise & Handouts</h2>{visible.handouts.map(h => <article className={styles.handout} key={h.id}><h3>{h.title}</h3><p>{h.text || 'Kein Text hinterlegt. Zugehörige Dateien findest du im Dokumentbereich.'}</p></article>)}{!error && !visible.handouts.length && <p className={styles.muted}>Neue Freigaben erscheinen hier automatisch.</p>}</section>
    {!preview && <p className={styles.sync}>Abgleich alle zehn Sekunden und bei Rückkehr zum Fenster.</p>}
  </div>;
}
