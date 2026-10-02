"use client";
import { useEffect, useRef, useState } from 'react';
import { Send, Eye, LockKeyhole, Check, ArrowLeft } from 'lucide-react';
import { api } from './api-client';
import styles from './command-workspace.module.css';
export function CommandDispatch({ members, initialRecipient, onChanged, onDirty }: { members: { id: string; name: string }[]; initialRecipient: string; onChanged: () => void; onDirty: (dirty: boolean) => void }) {
  const [chosen, setChosen] = useState<string[]>(initialRecipient ? [initialRecipient] : []), [title, setTitle] = useState(''), [text, setText] = useState('');
  const [review, setReview] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const requestId = useRef<string | null>(null);
  useEffect(() => { onDirty(!!title.trim() || !!text.trim()); }, [title, text, onDirty]);
  function changed() { requestId.current = null; setNotice(''); setReview(false); }
  async function send() {
    if (busy || !chosen.length) return; setBusy(true); setError(''); requestId.current ||= crypto.randomUUID();
    try { const r = await api<{ sent: number }>('/api/messages', 'POST', { clientRequestId: requestId.current, recipients: chosen, title, text }); setNotice(`Persönlicher Brief an ${r.sent} ${r.sent === 1 ? 'Person' : 'Personen'} zugestellt.`); setReview(false); setTitle(''); setText(''); setChosen([]); requestId.current = null; onChanged(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className={styles.dispatch}><p className={styles.private}><LockKeyhole size={12}/>Öffnen ist kein Versand.</p>{notice && <p className={styles.success} role="status"><Check size={15}/>{notice}</p>}{review ? <>
    <p className={styles.eyebrow}>VOR DEM SENDEN PRÜFEN</p><h2 className={styles.documentTitle}>{title}</h2><div className={styles.letterText}>{text}</div><div className={styles.recipientReview}><strong>Nur diese Empfänger</strong>{chosen.map(id => <span key={id}>{members.find(m => m.id === id)?.name || 'Nicht mehr verfügbar'}</span>)}</div><p className={styles.hint}>Persönlicher Brief. Keine Gruppenfreigabe und keine automatische Entdeckung.</p><div className={styles.buttonRow}><button disabled={busy} onClick={() => setReview(false)}><ArrowLeft size={14}/>Bearbeiten</button><button className={styles.primary} disabled={busy || chosen.some(id => !members.some(m => m.id === id))} onClick={() => void send()}><Send size={14}/>{busy ? 'Wird zugestellt …' : 'An diese Personen senden'}</button></div>
  </> : <><fieldset className={styles.recipientList}><legend>Wer soll den Brief erhalten?</legend>{members.map(m => <label key={m.id}><input type="checkbox" checked={chosen.includes(m.id)} onChange={e => { setChosen(old => e.target.checked ? [...old, m.id] : old.filter(id => id !== m.id)); changed(); }}/>{m.name}</label>)}</fieldset><label className={styles.field}>Betreff<input aria-label="Regie-Nachrichtenbetreff" maxLength={160} placeholder="Eine persönliche Erinnerung …" value={title} onChange={e => { setTitle(e.target.value); changed(); }}/></label><label className={styles.field}>Inhalt<textarea aria-label="Regie-Nachrichteninhalt" rows={7} maxLength={20000} value={text} placeholder="Nur der Text, den diese Personen lesen dürfen …" onChange={e => { setText(e.target.value); changed(); }}/></label><button className={styles.primary} disabled={!chosen.length || !title.trim() || !text.trim()} onClick={() => setReview(true)}><Eye size={14}/>Empfänger & Inhalt prüfen</button></>}{error && <p role="alert" className={styles.error}>{error}</p>}
  </div>;
}
