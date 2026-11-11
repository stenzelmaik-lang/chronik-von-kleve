"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActiveEngagement, engagementCategoryForSection } from '@/domain/engagement-browser';
import type { engagementSummary, recordEngagementPulse } from '@/server/engagement-activity';
import { publishNotebookTicket } from './engagement-notebook-ticket';

const endpoint = '/api/engagement';
const label = {
  character: 'Charakter',
  notebook: 'Notizbuch',
  codex: 'Codex',
  story: 'Chronik und Spielwelt',
  other: 'Weitere Bereiche',
};

function duration(seconds: number) {
  if (seconds < 60) return seconds + ' s';
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? hours + ' Std. ' + minutes % 60 + ' Min.' : minutes + ' Min.';
}

function useActivityTracking(section: string, scope: string, enabled: boolean, onPulse: () => void) {
  const category = engagementCategoryForSection(section);
  const heldTicket = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || !category) return;

    const state = new ActiveEngagement();
    const listeners = new AbortController();
    let request: AbortController | undefined;
    let timer: number | undefined;

    function pause() {
      state.pause();
      if (category === 'notebook') publishNotebookTicket(scope, null);
      request?.abort();
      request = undefined;
      window.clearTimeout(timer);
      timer = undefined;
    }

    function tick() {
      window.clearTimeout(timer);
      if (document.visibilityState !== 'visible' || !document.hasFocus() || !navigator.onLine) {
        pause();
        return;
      }
      const steady = performance.now(), wall = Date.now();
      if (!request && state.due(steady, wall)) {
        const ticket = heldTicket.current;
        const restart = !!ticket && !state.continuing;
        if (restart && category === 'notebook') publishNotebookTicket(scope, null);
        state.sent(steady, wall);
        const pending = new AbortController();
        request = pending;
        void fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, ...(ticket ? { ticket } : {}), ...(restart ? { restart } : {}) }),
          signal: pending.signal,
        }).then(async response => {
          if (pending.signal.aborted) return;
          if ([401, 403, 404].includes(response.status)) {
            pause();
            listeners.abort();
            return;
          }
          if (!response.ok) throw new Error('Aktivitätsmessung fehlgeschlagen.');
          const result: Awaited<ReturnType<typeof recordEngagementPulse>> = await response.json();
          if (pending.signal.aborted) return;
          heldTicket.current = result.ticket;
          if (category === 'notebook') publishNotebookTicket(scope, result.ticket);
          if (result.seconds > 0 && section === 'dashboard') onPulse();
        }).catch(() => {
          if (!pending.signal.aborted) {
            heldTicket.current = null;
            if (category === 'notebook') publishNotebookTicket(scope, null);
          }
        }).finally(() => {
          if (request === pending) request = undefined;
        });
      }
      if (state.active) timer = window.setTimeout(tick, 1_000);
      else pause();
    }

    function interact(event: Event) {
      if (!event.isTrusted || (event instanceof KeyboardEvent && (event.repeat || event.isComposing))) return;
      if (document.visibilityState !== 'visible' || !document.hasFocus() || !navigator.onLine) return;
      state.interact(performance.now(), true, Date.now());
      tick();
    }

    const options = { passive: true, signal: listeners.signal };
    for (const event of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(event, interact, options);
    for (const event of ['blur', 'offline', 'pagehide']) window.addEventListener(event, pause, options);
    document.addEventListener('freeze', pause, options);
    document.addEventListener('visibilitychange', pause, options);
    return () => { listeners.abort(); pause(); };
  }, [category, enabled, onPulse, scope, section]);
}

export function EngagementActivity({ section, scope }: { section: string; scope: string }) {
  const [enabled, setEnabled] = useState(false);
  const [revision, setRevision] = useState(0);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof engagementSummary>> | null>(null);
  const [failed, setFailed] = useState(false);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useActivityTracking(section, scope, enabled, refresh);

  useEffect(() => {
    if (section !== 'dashboard') return;
    const request = new AbortController();
    void fetch(endpoint, { signal: request.signal }).then(async response => {
      if (!response.ok) throw new Error('Aktivitätsübersicht nicht verfügbar.');
      const data = await response.json() as Awaited<ReturnType<typeof engagementSummary>>;
      if (request.signal.aborted) return;
      setSummary(data);
      setFailed(false);
    }).catch(() => { if (!request.signal.aborted) setFailed(true); });
    return () => request.abort();
  }, [revision, section]);

  if (section !== 'dashboard') return null;
  const current = summary?.window;
  return <section className="panel">
    <h2>Aktive Zeit</h2>
    <label>
      <input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /> Messung für diesen Besuch einschalten
    </label>
    <p className="muted">Die Messung pausiert bei Inaktivität, außerhalb des sichtbaren Tabs und am Spieltisch. Gespeichert werden Zeitsummen pro Tag und Bereich.</p>
    {failed && <p role="status">Die Übersicht konnte nicht geladen werden. <button className="button" onClick={refresh}>Erneut laden</button></p>}
    {!failed && summary && <>
      <ul>
        <li>Heute · {duration(summary.todaySeconds)}</li>
        <li>Letzte 7 Tage · {duration(summary.weekSeconds)}</li>
        {current?.status !== 'no-played-session' && <li>Seit dem letzten Spielabend · {duration(summary.intervalSeconds)}</li>}
      </ul>
      {Object.keys(summary.categories).length > 0 && <ul aria-label="Zeit nach Bereich">
        {Object.entries(summary.categories).map(([key, seconds]) =>
          <li key={key}>{label[key as keyof typeof label]} · {duration(seconds)}</li>
        )}
      </ul>}
      {current?.status === 'no-played-session' && <p>Zeitziele erscheinen nach dem ersten registrierten Spielabend.</p>}
      {current?.status === 'waiting' && <p>Die Zeitziele warten auf den nächsten Spieltermin.</p>}
      {current?.status === 'unsupported' && <p>Für diesen langen Spielabstand lassen sich keine Zeitziele berechnen.</p>}
      {summary.awardsEnabled && <>
        <p>Für EP bestätigte Vorbereitung · {duration(summary.verifiedSeconds)}</p>
        {summary.recipient && <p>Empfängerfigur · {summary.recipient} · {summary.bookedStages.length} von 2 EP gebucht</p>}
        <p className="muted">EP-Zeit entsteht beim Schreiben einer Figurnotiz im Spielerbereich. Die erste bestätigte Notiz legt die Figur für dieses Intervall fest.</p>
      </>}
      {current && 'targets' in current && summary.progress && <>
        {current.status === 'preview' && <p>Vorschau bis zur Terminbestätigung</p>}
        <p>Zeitziel für Stufe 1 · {duration(Math.ceil(current.targets.firstSeconds / 60) * 60)}<br />
          Zeitziel für Stufe 2 · {duration(Math.ceil(current.targets.fullSeconds / 60) * 60)}</p>
        <label>{summary.awardsEnabled ? 'EP-Fortschritt' : 'Zeitfortschritt'} · {summary.progress.percent} % <progress max={100} value={summary.progress.percent} /></label>
        {!summary.awardsEnabled && <p className="muted">Die gemessene Zeit dient als Vorschau. EP benötigen zusätzlich einen verifizierten Aktivitätsnachweis.</p>}
      </>}
    </>}
  </section>;
}
