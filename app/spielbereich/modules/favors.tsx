"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { HeartHandshake } from 'lucide-react';
import { favorDirections, favorKinds, type FavorAction, type FavorKind, type FavorDirection } from '@/domain/favors-ledger';
import type { favorsOverview } from '@/server/favors-ledger';
import { api } from './api-client';

type Overview = Awaited<ReturnType<typeof favorsOverview>>;
type Obligation = Overview['obligations'][number];
const kindLabel = { trade: 'Direkter Handel', favor: 'Gefallen', debt: '∆-Schuld' };
const statusLabel = {
  proposed: 'Vorgeschlagen', confirmed: 'Bestätigt', called: 'Eingefordert', partial: 'Teilweise erfüllt',
  disputed: 'Bestritten', fulfilled: 'Erfüllt', forgiven: 'Erlassen', rejected: 'Abgelehnt',
};
const actionLabel = {
  amend: 'Vorschlag bearbeiten', confirm: 'Bestätigen', reject: 'Ablehnen', call: 'Einfordern',
  fulfill: 'Erfüllung eintragen', dispute: 'Bestreiten', resolve: 'Streit klären', forgive: 'Erlassen', transfer: 'Übertragen',
};
const historyLabel = { ...actionLabel, propose: 'Vorgeschlagen' };
const closed = (row: Obligation) => ['fulfilled', 'forgiven', 'rejected'].includes(row.status);
const empty = { characterId: '', npcId: '', kind: 'debt' as FavorKind, direction: 'owes' as FavorDirection, amount: 1,
  description: '', terms: '', dueOn: '', gmNote: '', legacyKey: '', visibility: 'parties' as 'parties' | 'sl' };

export function FavorPanel({ sl }: { sl: boolean }) {
  const path = '/api/favors?view=' + (sl ? 'sl' : 'player');
  const [data, setData] = useState<Overview | null>(null);
  const [draft, setDraft] = useState(empty);
  const [editing, setEditing] = useState<{ row: Obligation; action: FavorAction } | null>(null);
  const [event, setEvent] = useState({ reason: '', amount: 1, npcId: '', description: '', terms: '', dueOn: '', gmNote: '' });
  const [history, setHistory] = useState<{ id: string; rows: Overview['history'] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [crisisEdit, setCrisisEdit] = useState<{ id: string; decision: string } | null>(null);
  const retry = useRef<{ signature: string; id: string } | null>(null);
  const sending = useRef(false);
  const load = useCallback(async () => { setData(await api<Overview>(path)); }, [path]);
  useEffect(() => { void load().catch(error => setError((error as Error).message)); }, [load]);

  async function send(body: object, after: () => void) {
    if (sending.current) return;
    sending.current = true;
    const signature = JSON.stringify(body);
    if (retry.current?.signature !== signature) retry.current = { signature, id: crypto.randomUUID() };
    setBusy(true); setError(''); setNotice('');
    try {
      await api(path, 'POST', { ...body, operationId: retry.current.id });
      retry.current = null;
      after(); setNotice('Gespeichert.');
      await load();
    } catch (error) { setError((error as Error).message); }
    finally { sending.current = false; setBusy(false); }
  }
  function begin(row: Obligation, action: FavorAction) {
    setEditing({ row, action });
    setEvent({ reason: '', amount: action === 'amend' ? row.tier ?? row.markers : 1, npcId: '',
      description: row.description, terms: row.terms, dueOn: row.dueOn ?? '', gmNote: row.gmNote ?? '' });
  }

  function entry(row: Obligation) {
    return <article key={row.id} className="panel stack-form">
      <h3>{row.character} {row.direction === 'owes' ? 'schuldet' : 'hat eine Forderung an'} {row.npc}</h3>
      <p><strong>{statusLabel[row.status]}</strong> · {kindLabel[row.kind]}
        {row.tier ? ' · Stufe ' + row.tier : row.kind === 'debt' ? ' · ' + row.remaining + ' von ' + row.markers + ' ∆ offen' : ''}
      </p>
      <p>{row.description}</p>
      {row.terms && <p>Bedingungen · {row.terms}</p>}
      {row.dueOn && <p>Fällig · <time dateTime={row.dueOn}>{new Date(row.dueOn + 'T12:00:00Z').toLocaleDateString('de-DE')}</time></p>}
      {sl && row.gmNote && <p>SL-Notiz · {row.gmNote}</p>}
      <div className="flex flex-wrap gap-2">
        {row.actions.map(action => <button key={action} type="button" className="button" disabled={busy} onClick={() => begin(row, action)}>{actionLabel[action]}</button>)}
        <button type="button" className="button" onClick={() => {
          if (history?.id === row.id) { setHistory(null); return; }
          void api<Overview>(path + '&id=' + encodeURIComponent(row.id)).then(value => setHistory({ id: row.id, rows: value.history }))
            .catch(error => setError((error as Error).message));
        }} aria-expanded={history?.id === row.id}>Verlauf</button>
      </div>
      {history?.id === row.id && <ol>{history.rows.map(item => <li key={item.version}>
        <time dateTime={item.at}>{new Date(item.at).toLocaleDateString('de-DE')}</time>
        {' · ' + historyLabel[item.action as keyof typeof historyLabel]}{item.actor && ' · ' + item.actor}{item.reason && ' · ' + item.reason}
      </li>)}</ol>}
      {editing?.row.id === row.id && <form className="stack-form" onSubmit={e => {
        e.preventDefault();
        const { action } = editing;
        void send({ id: row.id, version: row.version, action, reason: event.reason,
          ...(action === 'fulfill' && row.kind === 'debt' ? { amount: event.amount } : {}),
          ...(action === 'transfer' ? { npcId: event.npcId } : {}),
          ...(action === 'amend' ? { description: event.description, terms: event.terms, dueOn: event.dueOn || null, gmNote: event.gmNote,
            ...(row.kind === 'favor' ? { tier: event.amount } : row.kind === 'debt' ? { markers: event.amount } : {}) } : {}),
        }, () => { setEditing(null); setHistory(null); });
      }}>
        <h4>{actionLabel[editing.action]}</h4>
        {editing.action === 'fulfill' && row.kind === 'debt' && <label className="field"><span>Erfüllte ∆</span>
          <input required type="number" min={1} max={row.remaining} value={event.amount} onChange={e => setEvent({ ...event, amount: Number(e.target.value) })} />
        </label>}
        {editing.action === 'transfer' && <label className="field"><span>Neuer NSC</span>
          <select required value={event.npcId} onChange={e => setEvent({ ...event, npcId: e.target.value })}><option value="">Bitte wählen</option>
            {data?.npcs.filter(npc => npc.id !== row.npcId).map(npc => <option key={npc.id} value={npc.id}>{npc.title}</option>)}
          </select>
        </label>}
        {editing.action === 'amend' && <>
          <label className="field"><span>Verpflichtung</span><textarea required minLength={3} maxLength={2000} value={event.description} onChange={e => setEvent({ ...event, description: e.target.value })} /></label>
          <label className="field"><span>Bedingungen</span><input maxLength={2000} value={event.terms} onChange={e => setEvent({ ...event, terms: e.target.value })} /></label>
          <label className="field"><span>Fällig am</span><input type="date" value={event.dueOn} onChange={e => setEvent({ ...event, dueOn: e.target.value })} /></label>
          <label className="field"><span>SL-Notiz</span><textarea maxLength={2000} value={event.gmNote} onChange={e => setEvent({ ...event, gmNote: e.target.value })} /></label>
          {row.kind !== 'trade' && <label className="field"><span>{row.kind === 'favor' ? 'Stufe' : '∆-Marker'}</span>
            <input required type="number" min={1} max={row.kind === 'favor' ? 3 : 20} value={event.amount} onChange={e => setEvent({ ...event, amount: Number(e.target.value) })} />
          </label>}
        </>}
        <label className="field"><span>Grund für den Verlauf</span><input required minLength={3} maxLength={2000} value={event.reason} onChange={e => setEvent({ ...event, reason: e.target.value })} /></label>
        <div className="flex flex-wrap gap-2">
          <button className="button primary" disabled={busy}>Speichern</button>
          <button type="button" className="button" onClick={() => setEditing(null)}>Abbrechen</button>
        </div>
      </form>}
    </article>;
  }

  return <div className="feature-stack">
    {error && <p role="alert" className="error-box">{error} <button className="button" type="button" onClick={() => {
      setError(''); void load().catch(error => setError((error as Error).message));
    }}>Erneut laden</button></p>}
    {notice && <p role="status">{notice}</p>}
    {!data && !error && <p role="status">Gefallen werden geladen …</p>}
    {data && <>
      {sl && <section className="panel">
        <h2>Schuldenkrisen</h2>
        {data.crises.every(crisis => crisis.closedAt) ? <p>Keine offene Schuldenkrise.</p> : <ul>{data.crises.filter(crisis => !crisis.closedAt).map(crisis =>
          <li key={crisis.id} className="stack-form">
            <strong>{crisis.character} schuldet {crisis.npc} {crisis.markers} ∆</strong>
            {crisis.decision && <p>{crisis.decision}</p>}
            {crisisEdit?.id === crisis.id ? <form className="stack-form" onSubmit={event => {
              event.preventDefault();
              void send({ action: 'decide-crisis', id: crisis.id, version: crisis.version, decision: crisisEdit.decision }, () => setCrisisEdit(null));
            }}>
              <label className="field"><span>Entscheidung der Spielleitung</span><textarea required minLength={3} maxLength={2000} value={crisisEdit.decision}
                onChange={event => setCrisisEdit({ id: crisis.id, decision: event.target.value })} /></label>
              <div className="flex flex-wrap gap-2"><button className="button primary" disabled={busy}>Entscheidung speichern</button>
                <button type="button" className="button" onClick={() => setCrisisEdit(null)}>Abbrechen</button></div>
            </form> : <button type="button" className="button" onClick={() => setCrisisEdit({ id: crisis.id, decision: crisis.decision ?? '' })}>Entscheidung festhalten</button>}
          </li>)}</ul>}
        {data.crises.some(crisis => crisis.closedAt) && <details><summary>Abgeschlossene Krisen</summary>
          <ul>{data.crises.filter(crisis => crisis.closedAt).map(crisis => <li key={crisis.id}>{crisis.character} · {crisis.npc}{crisis.decision && ' · ' + crisis.decision}</li>)}</ul>
        </details>}
      </section>}
      <section className="panel">
        <h2>Verpflichtung vorschlagen</h2>
        {(!data.characters.length || !data.npcs.length) && <p>Für einen Vorschlag brauchst du eine verfügbare Figur und einen bekannten NSC.</p>}
        <form className="favor-form" onSubmit={e => {
          e.preventDefault();
          void send({ action: 'propose', characterId: draft.characterId, npcId: draft.npcId, kind: draft.kind, direction: draft.direction,
            description: draft.description, terms: draft.terms, dueOn: draft.dueOn || undefined, legacyKey: draft.legacyKey || undefined,
            visibility: draft.visibility, ...(sl && draft.gmNote ? { gmNote: draft.gmNote } : {}),
            ...(draft.kind === 'debt' ? { markers: draft.amount } : draft.kind === 'favor' ? { tier: draft.amount } : {}),
          }, () => setDraft(empty));
        }}>
          <label className="field"><span>Figur</span><select required value={draft.characterId} onChange={e => setDraft({ ...draft, characterId: e.target.value })}><option value="">Bitte wählen</option>
            {data.characters.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <label className="field"><span>NSC</span><select required value={draft.npcId} onChange={e => setDraft({ ...draft, npcId: e.target.value })}><option value="">Bitte wählen</option>
            {data.npcs.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <label className="field"><span>Richtung</span><select value={draft.direction} onChange={e => setDraft({ ...draft, direction: e.target.value as FavorDirection })}>
            {favorDirections.map(direction => <option key={direction} value={direction}>{direction === 'owes' ? 'Figur schuldet dem NSC' : 'NSC schuldet der Figur'}</option>)}</select></label>
          <label className="field"><span>Art</span><select value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as FavorKind, amount: 1 })}>
            {favorKinds.map(kind => <option key={kind} value={kind}>{kindLabel[kind]}</option>)}</select></label>
          {draft.kind !== 'trade' && <label className="field"><span>{draft.kind === 'debt' ? '∆-Marker' : 'Gefallen-Stufe'}</span>
            <input required type="number" min={1} max={draft.kind === 'debt' ? 20 : 3} value={draft.amount} onChange={e => setDraft({ ...draft, amount: Number(e.target.value) })} /></label>}
          <label className="field"><span>Fällig am</span><input type="date" value={draft.dueOn} onChange={e => setDraft({ ...draft, dueOn: e.target.value })} /></label>
          <label className="field wide"><span>Verpflichtung</span><textarea required minLength={3} maxLength={2000} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
          <label className="field wide"><span>Bedingungen</span><input maxLength={2000} value={draft.terms} onChange={e => setDraft({ ...draft, terms: e.target.value })} /></label>
          {sl && <>
            <label className="field"><span>Sichtbarkeit</span><select value={draft.visibility} onChange={e => setDraft({ ...draft, visibility: e.target.value as 'parties' | 'sl' })}>
              <option value="parties">Beteiligte und SL</option><option value="sl">Nur SL</option></select></label>
            <label className="field wide"><span>SL-Notiz</span><textarea maxLength={2000} value={draft.gmNote} onChange={e => setDraft({ ...draft, gmNote: e.target.value })} /></label>
          </>}
          {draft.legacyKey && <button type="button" className="button wide" onClick={() => setDraft(empty)}>Übernahme abbrechen</button>}
          <button className="button primary wide" disabled={busy || !data.characters.length || !data.npcs.length}><HeartHandshake size={17} /> Vorschlag speichern</button>
        </form>
      </section>
      <h2>Offene Verpflichtungen</h2>
      {data.obligations.some(row => !closed(row)) ? data.obligations.filter(row => !closed(row)).map(entry) : <p>Keine offenen Verpflichtungen.</p>}
      {data.obligations.some(closed) && <details><summary>Archiv</summary>{data.obligations.filter(closed).map(entry)}</details>}
      {data.legacy.length > 0 && <details className="panel"><summary>Alte private Einträge</summary>
        <ul>{data.legacy.map(old => <li key={old.key}>
          <strong>{old.npc || 'Kontakt'} · {old.value > 0 ? '+' : ''}{old.value}</strong>
          <p>{[old.date, old.status, old.note].filter(Boolean).join(' · ')}</p>
          {old.imported ? <span>Als Vorschlag übernommen</span> : <button type="button" className="button" onClick={() => setDraft({
            ...empty, legacyKey: old.key, kind: 'favor', direction: old.value < 0 ? 'owes' : 'owed', description: (old.note || old.npc).slice(0, 2000),
          })}>Als Vorschlag übernehmen</button>}
        </li>)}</ul>
      </details>}
    </>}
  </div>;
}
