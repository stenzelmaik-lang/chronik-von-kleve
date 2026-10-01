"use client";
import { Heart, Droplets, Flame, Sparkles } from 'lucide-react';
import { healthLevels } from './character';
import styles from './character-studio.module.css';

type Props = {
  blood:number; bloodMax:number; bloodPerRound:unknown;
  willpower:number; permanentWillpower:number; health:string;
  freeXp:unknown; totalXp:unknown; editable:boolean; busy:boolean; status:string;
  onChange:(field:'blood'|'willpowerTemporary'|'health', value:unknown)=>void;
  onResetHealth:()=>void; onDevelopment:()=>void;
};

export function CharacterLiveVitals(p:Props) {
  const locked = !p.editable || p.busy;
  return <section className={styles.liveVitals} aria-label="Spielabend · aktuelle Werte" aria-busy={p.busy}>
    <div className={styles.liveMetric}>
      <span><Droplets size={15}/>Blut <small>{String(p.bloodPerRound ?? '–')} / Runde</small></span>
      <div><button type="button" aria-label="Blut verringern" disabled={locked||p.blood<=0} onClick={()=>p.onChange('blood',p.blood-1)}>−</button><output aria-label="Blutvorrat">{p.blood}<small> / {p.bloodMax}</small></output><button type="button" aria-label="Blut erhöhen" disabled={locked||p.blood>=p.bloodMax} onClick={()=>p.onChange('blood',p.blood+1)}>+</button></div>
    </div>
    <div className={styles.liveMetric}>
      <span><Flame size={15}/>Willenskraft <small>permanent {p.permanentWillpower}</small></span>
      <div><button type="button" aria-label="Willenskraft verringern" disabled={locked||p.willpower<=0} onClick={()=>p.onChange('willpowerTemporary',p.willpower-1)}>−</button><output aria-label="Willenskraft aktuell">{p.willpower}<small> / {p.permanentWillpower}</small></output><button type="button" aria-label="Willenskraft erhöhen" disabled={locked||p.willpower>=p.permanentWillpower} onClick={()=>p.onChange('willpowerTemporary',p.willpower+1)}>+</button></div>
    </div>
    <div className={styles.liveMetric}>
      <span><Heart size={15}/>Gesundheit</span>
      <div><select aria-label="Gesundheit" disabled={locked} value={p.health} onChange={e=>p.onChange('health',e.target.value)}>{healthLevels.map(l=><option key={l.name} value={l.name}>{l.name}{l.modifier==='0'?'':` (${l.modifier})`}</option>)}</select><button type="button" className={styles.resetVitals} aria-label="Gesundheit zurücksetzen" title="Temporäre Verletzungen zurücksetzen · mit Bestätigung" disabled={locked||p.health==='Gesund'} onClick={p.onResetHealth}>↺</button></div>
    </div>
    <div className={styles.liveMetric}>
      <span><Sparkles size={15}/>Erfahrung <small>{String(p.totalXp ?? '–')} gesamt</small></span>
      <button type="button" className={styles.xpShortcut} onClick={p.onDevelopment}><strong>{String(p.freeXp ?? '–')} <small>freie XP</small></strong><span>Entwicklung →</span></button>
    </div>
    <p role="status" className={p.status.startsWith('FEHLER')||p.status.startsWith('KONFLIKT')?styles.liveError:styles.liveStatus}>{p.status||'Gespeicherter Stand'}{!p.editable&&' · nur lesbar'}</p>
  </section>;
}
