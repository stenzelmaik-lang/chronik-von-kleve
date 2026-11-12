import { BarChart3, ChevronRight, List, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { groupDiceRolls, summarizeDiceRolls } from './dice-journal-data';
import { rollOutcome } from './live-check-panel';
import type { DiceEvent } from './types';
import styles from './dice-journal.module.css';

const time = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });

export function DiceJournal({ events, epoch, statisticsExcludedIds, onShow, onClearStatistics, onReset, busy }: {
  events: readonly DiceEvent[];
  statisticsExcludedIds: ReadonlySet<string>;
  onShow: (id: string) => void;
  onClearStatistics: (authorId: string) => void;
  epoch: number;
  onReset?: (expectedEpoch: number) => Promise<boolean>;
  busy: boolean;
}) {
  const [view, setView] = useState<'journal' | 'statistics'>('journal');
  const [filter, setFilter] = useState('');
  const [confirmEpoch, setConfirmEpoch] = useState<number | null>(null);
  const groups = useMemo(() => groupDiceRolls(events), [events]);
  const author = groups.find(group => group.authorId === filter);
  const shownGroups = author ? [author] : groups;

  return <div className={styles.journal}>
    <div className={styles.views} role="group" aria-label="Würfelansicht">
      <button type="button" aria-pressed={view === 'journal'} onClick={() => setView('journal')}>
        <List aria-hidden="true" /> Protokoll
      </button>
      <button type="button" aria-pressed={view === 'statistics'} onClick={() => setView('statistics')}>
        <BarChart3 aria-hidden="true" /> Statistik
      </button>
    </div>
    <label className={styles.filter}>
      Würfelnde Person
      <select value={author?.authorId ?? ''} onChange={event => setFilter(event.target.value)} disabled={!groups.length}>
        <option value="">Alle Würfelnden</option>
        {groups.map(group => <option key={group.authorId} value={group.authorId}>{group.authorName}</option>)}
      </select>
    </label>

    {view === 'journal' ? shownGroups.length > 0 ? <ol className={styles.diceLog} aria-label="Würfe nach Person">
      {shownGroups.map(group => <li key={group.authorId} className={styles.group}>
        <header className={styles.person}>
          <h3>{group.authorName}</h3>
          <span>{group.rolls.length} {group.rolls.length === 1 ? 'Wurf' : 'Würfe'}</span>
        </header>
        <ol className={styles.rolls}>
          {group.rolls.map(event => <li key={event.id}>
            <button type="button" className={styles.roll} onClick={() => onShow(event.id)}>
              <span className={styles.rollIdentity}>
                <strong>{event.checkRef?.title || 'Freier Wurf'}</strong>
                <small>{event.roll.pool} W10 · SG {event.roll.target}{Number.isFinite(Date.parse(event.at)) && <> · <time dateTime={event.at}>{time.format(Date.parse(event.at))}</time></>}</small>
              </span>
              <span className={styles.outcome} data-outcome={event.result.outcome}>{rollOutcome(event)}</span>
              <ChevronRight aria-hidden="true" />
            </button>
          </li>)}
        </ol>
      </li>)}
    </ol> : <p className={styles.empty}>Das Würfelprotokoll ist leer.</p> :
      <DiceStatistics events={author?.rolls ?? events} excluded={statisticsExcludedIds}
        onClear={() => onClearStatistics(author?.authorId ?? '')} />}
    {view === 'journal' && onReset && events.length > 0 &&
      <div className={styles.reset}>
        {confirmEpoch === epoch ? <>
          <p>Alle bisherigen Würfe aus dem Protokoll dieses Spielabends ausblenden? Das gilt für alle am Tisch.</p>
          <button type="button" disabled={busy} onClick={async () => {
            if (await onReset(confirmEpoch)) { setConfirmEpoch(null); setFilter(''); }
          }}>Für alle zurücksetzen</button>
          <button type="button" disabled={busy} onClick={() => setConfirmEpoch(null)}>Abbrechen</button>
        </> : <button type="button" disabled={busy} onClick={() => setConfirmEpoch(epoch)}>
          <RotateCcw aria-hidden="true" /> Protokoll zurücksetzen
        </button>}
      </div>}
  </div>;
}

function DiceStatistics({ events, excluded, onClear }: {
  events: readonly DiceEvent[];
  excluded: ReadonlySet<string>;
  onClear: () => void;
}) {
  const summary = summarizeDiceRolls(events, excluded);
  const maxFaceCount = Math.max(1, ...summary.faces);

  return <section className={styles.statistics} aria-label="Würfelstatistik">
    <dl className={styles.metrics}>
      <div><dt>Würfe</dt><dd>{summary.rolls}</dd></div>
      <div><dt>Erfolgreich</dt><dd data-outcome="success">{summary.success}</dd></div>
      <div><dt>Fehlschläge</dt><dd data-outcome="failure">{summary.failure}</dd></div>
      <div><dt>Patzer</dt><dd data-outcome="botch">{summary.botch}</dd></div>
    </dl>
    {summary.dice > 0 ? <div className={styles.distribution}>
      <header><h3>Gewürfelte Augen</h3><span>{summary.dice} W10</span></header>
      <ol className={styles.bars} aria-label="Häufigkeit je Augenzahl">
        {summary.faces.map((count, index) => <li key={index} aria-label={`Augenzahl ${index + 1}, ${count}-mal`}>
          <span aria-hidden="true">{count}</span>
          <span className={styles.barTrack} aria-hidden="true">
            <span className={styles.barFill} style={{ height: `${100 * count / maxFaceCount}%` }} />
          </span>
          <b aria-hidden="true">{index + 1}</b>
        </li>)}
      </ol>
    </div> : <p className={styles.empty} role="status">In dieser Auswertung stehen noch keine Würfe.</p>}
    <footer className={styles.reset}>
      <button type="button" className={styles.clear} onClick={onClear} disabled={!summary.rolls}>
        <RotateCcw aria-hidden="true" /> Statistik leeren
      </button>
      <p>Setzt die Statistik der gewählten Ansicht in diesem Tab auf null.</p>
    </footer>
  </section>;
}
