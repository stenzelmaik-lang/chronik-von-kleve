"use client";
import { useEffect, useState } from 'react';
import type { Actor } from '@/domain/types';
import type { PlayerScene } from '@/domain/story-scene';
import { api } from './api-client';

// Only the existing server-filtered reader projection, never preparation data.
export function DashboardScene({ a, characterId, onOpen }: { a: Actor; characterId: string | null; onOpen: () => void }) {
  const key = `${a.campaignId}:${a.id}:${characterId || ''}`;
  const [result, setResult] = useState<{ key: string; scenes: PlayerScene[]; error: boolean }>({ key: '', scenes: [], error: false });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    api<{ scenes: PlayerScene[] }>('/api/session-scenes' + (characterId ? '?characterId=' + encodeURIComponent(characterId) : ''))
      .then(data => { if (alive) setResult({ key, scenes: data.scenes, error: false }); })
      .catch(() => { if (alive) setResult({ key, scenes: [], error: true }); });
    return () => { alive = false; };
  }, [key, characterId, retry]);
  const current = result.key === key;
  const active = current ? result.scenes.filter(scene => scene.runs.some(run => run.status === 'active')) : [];
  if (current && !result.error && active.length === 0) return null;
  return <section aria-label="Freigegebener Szenenstand" className="panel dashboard-scene">
    <p className="eyebrow">AKTUELLER FREIGEGEBENER SZENENSTAND</p>
    {!current ? <p role="status">Szenenstand wird geladen …</p> : result.error ? <p role="alert">Szenenstand konnte nicht geprüft werden. <button className="button" onClick={() => setRetry(value => value + 1)}>Erneut prüfen</button></p> : <p>{active.map(scene => scene.title).join(' · ') || 'Keine aktive freigegebene Szene.'} <button className="button" onClick={onOpen}>Zum Spieltisch</button></p>}
  </section>;
}
