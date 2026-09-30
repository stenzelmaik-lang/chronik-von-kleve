import {Compass, Radio} from 'lucide-react';
import styles from './session-stage.module.css';

/** Shared published scene presentation. No writes, authorization or derived rules. */
export function SessionStage({scene,subtitle,status,round}:{scene:string;subtitle:string;status:string;round:number}) {
  return <section className={styles.stage} aria-label="Veröffentlichte Szene">
    <div className={styles.overline}><span><Radio size={13}/> AKTUELLE SZENE</span><span>{status} · Runde {round}</span></div>
    <div className={styles.copy}><h2>{scene||'Die nächste Nacht wartet'}</h2><p>{subtitle||'Noch kein Szenentext veröffentlicht.'}</p></div>
    <Compass className={styles.sigil} size={160} strokeWidth={.45} aria-hidden="true"/>
    <div className={styles.rule}><span/> <small>CHRONIK VON KLEVE</small> <span/></div>
  </section>;
}
