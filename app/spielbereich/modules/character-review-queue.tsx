import { ShieldCheck } from 'lucide-react';
import type { CommandCharacterSummary } from '@/domain/character-live';
import styles from './command-center.module.css';

export function CharacterReviewQueue({characters,onSelect}:{characters:CommandCharacterSummary[];onSelect:(character:CommandCharacterSummary)=>void}) {
  const reviews=characters.filter(c=>c.state==='review').length;
  const requests=characters.reduce((sum,c)=>sum+c.pendingRequests,0);
  const pending=characters.filter(c=>c.state==='review'||c.pendingRequests>0);
  return <section className={styles.reviewQueue} aria-label="Offene Charakterprüfungen und Anträge">
    <header><ShieldCheck size={17}/><strong>Wartet auf dich</strong><span>{reviews} {reviews===1?'Charakterprüfung':'Charakterprüfungen'} · {requests} {requests===1?'Antrag':'Anträge'}</span></header>
    {pending.length?<div>{pending.map(c=><button type="button" key={c.id} onClick={()=>onSelect(c)}><strong>{c.title}</strong><small>{c.state==='review'?'Bogen prüfen':''}{c.state==='review'&&c.pendingRequests?' · ':''}{c.pendingRequests?`${c.pendingRequests} offene Anträge`:''} →</small></button>)}</div>:<p>Alle aktuellen Prüfungen und Anträge sind erledigt.</p>}
  </section>;
}
