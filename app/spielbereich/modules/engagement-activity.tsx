"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Clock3, X } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ActiveEngagement, engagementCategoryForSection } from '@/domain/engagement-browser';
import type { engagementSummary, recordEngagementPulse } from '@/server/engagement-activity';
import { publishNotebookTicket } from './engagement-notebook-ticket';
import styles from './dashboard.module.css';

const endpoint = '/api/engagement';
const label = {
  character: 'Charakter',
  notebook: 'Notizbuch',
  codex: 'Codex',
  story: 'Chronik und Spielwelt',
  other: 'Weitere Bereiche',
};
const goalStatus = {
  'no-played-session': 'Zeitziele erscheinen nach dem ersten registrierten Spielabend.',
  waiting: 'Zeitziele erscheinen, sobald der nächste Spielabend geplant ist.',
  unsupported: 'Für diesen Spielabstand gibt es kein Zeitziel.',
};

function duration(seconds: number) {
  if (seconds === 0) return '0 Min.';
  if (seconds < 60) return seconds + ' s';
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${minutes} Min.`;
  return remainder ? `${hours} Std. ${remainder} Min.` : `${hours} Std.`;
}

function compactDuration(seconds: number) {
  if (seconds > 0 && seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours} h`;
}

export function EngagementTracker({ section, scope, enabled, onPulse }: {
  section: string; scope: string; enabled: boolean; onPulse: () => void;
}) {
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
  return null;
}

export function EngagementOverview({ enabled, revision }: { enabled: boolean; revision: number }) {
  const [retry, setRetry] = useState(0);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof engagementSummary>> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const request = new AbortController();
    void fetch(endpoint, { signal: request.signal }).then(async response => {
      if (!response.ok) throw new Error('Aktivitätsübersicht nicht verfügbar.');
      const data = await response.json() as Awaited<ReturnType<typeof engagementSummary>>;
      if (request.signal.aborted) return;
      setSummary(data);
      setFailed(false);
    }).catch(() => { if (!request.signal.aborted) setFailed(true); });
    return () => request.abort();
  }, [revision, retry]);

  const current = summary?.window;
  const targets = current && 'targets' in current ? current.targets : null;
  const progressLabel = summary?.awardsEnabled ? 'EP-Fortschritt' : 'Zeitfortschritt';
  const triggerLabel = summary ? `Aktive Zeit, heute ${duration(summary.todaySeconds)}` : 'Aktive Zeit anzeigen';
  return <Dialog>
    <DialogTrigger className={styles.activityButton} aria-label={triggerLabel} title={triggerLabel}>
      <Clock3 size={15} aria-hidden="true" />
      <span className={styles.activityButtonLabel}>Aktive Zeit</span>
      {summary && <strong>{compactDuration(summary.todaySeconds)}</strong>}
    </DialogTrigger>
    <DialogContent className={styles.activityDialog} showCloseButton={false}>
      <DialogHeader className={styles.activityDialogHeader}>
        <DialogTitle>Aktive Zeit</DialogTitle>
        <DialogDescription className="sr-only">Deine gemessene Zeit und der Fortschritt zu den Zeitzielen.</DialogDescription>
        <DialogClose className={styles.activityClose} aria-label="Schließen"><X size={18} aria-hidden="true" /></DialogClose>
      </DialogHeader>
      {!enabled && <p>Die Messung ist in deinem <Link href="/profil#aktivitaetsmessung">Profil</Link> ausgeschaltet.</p>}
      {failed && <div className={styles.activityFeedback}>
        <p role="status">{summary ? 'Die aktive Zeit konnte nicht aktualisiert werden.' : 'Die aktive Zeit konnte nicht geladen werden.'}</p>
        <button type="button" onClick={() => setRetry(value => value + 1)}>Erneut laden</button>
      </div>}
      {!failed && !summary && <p role="status">Aktive Zeit wird geladen …</p>}
      {summary && current && <>
        <dl className={styles.activityTotals}>
          <div><dt>Heute</dt><dd>{duration(summary.todaySeconds)}</dd></div>
          <div><dt>Letzte 7 Tage</dt><dd>{duration(summary.weekSeconds)}</dd></div>
        </dl>
        {targets && summary.progress ? <div className={styles.activityGoals}>
          <div className={styles.activityProgressLabel}>
            <span>{progressLabel}{current.status === 'preview' && ' · Vorschau'}</span>
            <strong>{summary.progress.percent} %</strong>
          </div>
          <div className={styles.activityTrack}>
            <progress aria-label={progressLabel} max={100} value={summary.progress.percent} />
          </div>
          <div className={styles.activityStages}>
            <span>Stufe 1 · {duration(Math.ceil(targets.firstSeconds / 60) * 60)}</span>
            <span>Stufe 2 · {duration(Math.ceil(targets.fullSeconds / 60) * 60)}</span>
          </div>
          {summary.awardsEnabled && <p>{duration(summary.verifiedSeconds)} für EP bestätigt</p>}
        </div> : current.status in goalStatus && <p>{goalStatus[current.status as keyof typeof goalStatus]}</p>}
        <div className={styles.activityDetails}>
          <dl>
            {current.status !== 'no-played-session' && <div><dt>Seit dem letzten Spielabend</dt><dd>{duration(summary.intervalSeconds)}</dd></div>}
            {Object.entries(summary.categories).map(([key, seconds]) =>
              <div key={key}><dt>{label[key as keyof typeof label]}</dt><dd>{duration(seconds)}</dd></div>
            )}
            {summary.awardsEnabled && !targets && <div><dt>Für EP bestätigte Vorbereitung</dt><dd>{duration(summary.verifiedSeconds)}</dd></div>}
          </dl>
          {summary.recipient && <p>{summary.recipient} · {summary.bookedStages.length} von 2 EP gebucht</p>}
          {summary.awardsEnabled ? <p>Für Engagement-EP prüft ChroniPlay gespeicherte Figurnotizen. Die erste bestätigte Notiz legt die Figur für diesen Zeitraum fest.</p>
            : <p>Die Zeitanzeige dient als Vorschau. EP setzen bestätigte Vorbereitung voraus.</p>}
        </div>
      </>}
    </DialogContent>
  </Dialog>;
}
