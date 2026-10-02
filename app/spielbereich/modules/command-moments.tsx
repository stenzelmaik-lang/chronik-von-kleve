"use client";
import { useEffect, useRef, useState } from 'react';
import { Feather, LockKeyhole, Check } from 'lucide-react';
import type { CommandWorkspace, MomentView } from '@/domain/command-workspace';
import { api } from './api-client';
import styles from './command-workspace.module.css';
export function CommandMoments({ moments, focus, onChanged, onDirty }: { moments: MomentView[]; focus: CommandWorkspace['focus']; onChanged: () => void; onDirty: (dirty: boolean) => void }) {
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const requestId = useRef<string | null>(null);
  useEffect(() => { onDirty(!!text.trim()); }, [text, onDirty]);
  async function add(e: React.FormEvent) {
    e.preventDefault(); if (busy || !text.trim() || !focus.sessionId) return; setBusy(true); setError(''); requestId.current ||= crypto.randomUUID();
    try { await api('/api/command-center/moments', 'POST', { clientRequestId: requestId.current, text, sessionId: focus.sessionId, storyId: focus.storyId, references: [...new Set([focus.characterId, focus.placeId].filter(Boolean))] }); setText(''); requestId.current = null; onChanged(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const visible = moments.filter(m => !focus.sessionId || m.sessionId === focus.sessionId);
  return <div className={styles.moments}><p className={styles.private}><LockKeyhole size={12}/>SL-Protokoll · tatsächlich geschehen</p><form onSubmit={e => void add(e)}><label className={styles.field}>Ein Moment der heutigen Sitzung<textarea aria-label="Tatsächliches Ereignis notieren" rows={3} maxLength={3000} placeholder="Was ist wirklich passiert? Ein Satz genügt." value={text} onChange={e => { setText(e.target.value); requestId.current = null; }}/></label><div className={styles.buttonRow}><small>{focus.sessionId ? 'Sitzung und ausgewählte Akten werden verknüpft.' : 'Speichere zuerst eine Sitzung im Szenenwerkzeug.'}</small><button className={styles.primary} disabled={busy || !focus.sessionId || !text.trim()}><Feather size={14}/>{busy ? 'Speichert …' : 'Moment festhalten'}</button></div></form>{error && <p role="alert" className={styles.error}>{error}</p>}<ol className={styles.timeline}>{visible.map(m => <li key={m.id}><span className={styles.timelineMark}><Check size={11}/></span><time>{new Date(m.occurredAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time><p>{m.text}</p>{m.storyId && <small>Mit Handlungsstrang verknüpft</small>}</li>)}</ol>{!visible.length && <div className={styles.blankText}><Feather size={24}/><p>Noch keine tatsächlichen Ereignisse festgehalten.</p></div>}<p className={styles.hint}>Keine automatische Kanonfestlegung. Vorbereitete Möglichkeiten bleiben eigenständig.</p></div>;
}
