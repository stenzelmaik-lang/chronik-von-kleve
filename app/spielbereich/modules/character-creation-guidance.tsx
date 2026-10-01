import { creationGuidance } from '@/domain/character-guidance';
import { automaticFreebieBreakdown, freebieCosts } from '@/domain/character-engine';
import styles from './character-studio.module.css';

export function CharacterCreationGuidance({ body, campaignId, step }: { body:Record<string,unknown>; campaignId:string; step:string }) {
  const g = creationGuidance(campaignId, body);
  const visible = g.groups.filter(group => group.step === step);
  const costs = automaticFreebieBreakdown(body);
  return <section className={styles.guidance} aria-label="Erschaffungsbudget">
    <div className={styles.guidanceHeader}><strong>{g.budget.freebies.remaining} Freebies verfügbar <small>· {g.budget.freebies.spent} / {g.budget.freebies.limit} verwendet</small></strong><span>{g.reviewReady ? 'Bereit zur SL-Prüfung' : g.saveable ? 'Entwurf speicherbar · noch nicht prüfungsbereit' : 'Eingaben korrigieren'}</span></div>
    {visible.length > 0 && <div className={styles.budgetChips}>{visible.map(({label,line})=><span key={label} data-complete={line.remaining===0}>{label}<b>{line.spent} / {line.limit}</b><small>{line.remaining>0?`noch ${line.remaining}`:'verteilt'}{line.freebieCost?` · +${line.freebieCost} Freebies`:''}</small></span>)}</div>}
    <p>{!g.saveable?g.draftReason:g.reviewReady?g.reviewReason:step==='identity'?'Du kannst jederzeit einen unvollständigen Entwurf speichern. Vor dem Einreichen müssen die regulären Punkte verteilt und notwendige SL-Freigaben geklärt sein.':g.reviewReason}</p>
    <details><summary>Alle Restpunkte & Freebie-Preise</summary><div className={styles.budgetChips}>{g.missing.map(m=><span key={m.label}>{m.label}<b>noch {m.remaining} Punkte</b></span>)}{g.missing.length===0&&<span>Alle regulären Punkte verteilt.</span>}</div><p>Zusätzliche Stufe: Attribut {freebieCosts.attribute} · Fähigkeit {freebieCosts.ability} · Disziplin {freebieCosts.discipline} · Hintergrund {freebieCosts.background} · Tugend {freebieCosts.virtue} · Menschlichkeit {freebieCosts.humanity} · Willenskraft {freebieCosts.willpower} Freebies. Die Kosten erscheinen vor dem Klick. Rücknahmen geben Freebies zurück.</p>{costs.length>0&&<p>Verwendet: {costs.map(c=>`${c.target}: ${c.total} Freebies`).join(' · ')}</p>}</details>
  </section>;
}
