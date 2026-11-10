"use client";
import { Dices } from "lucide-react";
import { useState } from "react";
import {rollD10Pool,evaluateNormalV20,v20OutcomeLabel,type W10LogEntry} from "../../../domain/w10";

export function DicePanel({sharedRoll,disabled=false,onResult,mode='raw',history=[],sharedLabel='Würfeln & Zielgruppe zeigen',onShowRoll}:{sharedLabel?:string;onShowRoll?:(id:string)=>void;sharedRoll?:(pool:number,target:number)=>Promise<number[]>;disabled?:boolean;onResult?:(dice:readonly number[],target:number)=>void;mode?:'raw'|'v20-normal';history?:readonly W10LogEntry[]}={}) {
  const [pool, setPool] = useState(5),
    [target, setTarget] = useState(6),
    [dice, setDice] = useState<number[]>([]);
  const [rolling,setRolling]=useState(false),[error,setError]=useState('');
  const [rolledTarget,setRolledTarget]=useState(6);
  const report=mode==='v20-normal'?(history[0]?.report||(dice.length?evaluateNormalV20(dice,rolledTarget):undefined)):undefined;
  const shownDice=report?.dice||dice;
  const shownTarget=report?.target??rolledTarget;
  return (
    <section className="panel dice-panel">
      <h2>{mode==='v20-normal'?'V20 · normale Probe':'W10-Würfelpool'}</h2>
      <div className="form-grid">
        <label className="field">
          <span>Anzahl Würfel · 1 bis 30</span>
          <input
            type="number"
            min="1"
            max="30"
            value={pool}
            onChange={(e) => setPool(Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Erfolg ab · 2 bis 10</span>
          <input
            type="number"
            min="2"
            max="10"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
          />
        </label>
      </div>
      <button
        className="button primary"
        disabled={
          disabled || rolling ||
          !Number.isInteger(pool) ||
          pool < 1 ||
          pool > 30 ||
          !Number.isInteger(target) ||
          target < 2 ||
          target > 10
        }
        onClick={async () => {
          setError('');
          if(sharedRoll){setRolling(true);try{const ds=await sharedRoll(pool,target);setDice(ds);setRolledTarget(target);onResult?.([...ds],target);}catch(issue){setError((issue as Error).message);}finally{setRolling(false);}return;}
          try{const ds=rollD10Pool(pool);setDice(ds);setRolledTarget(target);onResult?.([...ds],target);}catch(issue){setError((issue as Error).message);}
        }}
      >
        <Dices size={20} /> {rolling?'Wurf wird gesendet …':sharedRoll?sharedLabel:'Würfeln'}
      </button>
      {error&&<p role="alert">{error}</p>}
      <div className="dice-results" aria-live="polite">
        {shownDice.map((d, i) => (
          <span key={i} className={report?.cancelledSuccessIndices.includes(i)?'die cancelled':report&&d===1?'die one':d>=shownTarget?'die success':'die'} title={report?.cancelledSuccessIndices.includes(i)?'Durch eine Eins aufgehobener Erfolg':d===1&&report?'Eins – streicht einen Erfolg':undefined}>
            {d}
          </span>
        ))}
      </div>
      {report&&<div className={'v20-result '+report.outcome} data-outcome={report.outcome} role="status"><strong>{v20OutcomeLabel[report.outcome]}{report.netSuccesses>0?' · '+report.netSuccesses+' Nettoerfolg'+(report.netSuccesses===1?'':'e'):''}</strong><p>{report.rawSuccesses} Erfolge ab {report.target} · {report.ones} Einsen · {report.cancelled} aufgehoben.</p>{report.outcome==='failure'&&report.rawSuccesses>0&&<small>Ein Erfolg war dabei: trotz übriger Einsen kein Patzer.</small>}</div>}
      {!report&&dice.length > 0 && (
        <p>
          {dice.filter((d) => d >= rolledTarget).length} Würfel erreichen die Schwelle{" "}
          {rolledTarget}. Einsen: {dice.filter((d) => d === 1).length}.
        </p>
      )}
      <p className="muted">
        {mode==='v20-normal'?'Normale V20-Probe. Keine Spezialisierungen, Willenskraft-, Schadens-, Absorptions- oder Hausregeln.':'Rohwurf ohne automatische Patzer-, Hunger- oder Hausregel-Auswertung.'}
      </p>
      <p className="muted">{sharedRoll?'Der Server':'Dein Browser'} zieht die Würfelaugen zufällig. Jede Seite hat pro Würfel eine Chance von 10 %.</p>
      {mode==='v20-normal'&&history.length>0&&<details className="w10-history"><summary>Ergebnisprotokoll ({history.length})</summary><ol>{history.map(entry=><li key={entry.id} data-roll-id={entry.id}><header><strong>{v20OutcomeLabel[entry.report.outcome]}</strong><time dateTime={entry.at}>{new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(entry.at))}</time></header><p>{entry.report.dice.length} W10 · Schwierigkeit {entry.report.target}<br/>Werte: {entry.report.dice.join(', ')}</p><small>{entry.report.rawSuccesses} Erfolge − {entry.report.cancelled} durch {entry.report.ones} Einsen aufgehoben = {entry.report.netSuccesses} Nettoerfolge.</small>{onShowRoll&&<button onClick={()=>onShowRoll(entry.id)}>Wurf anzeigen</button>}</li>)}</ol></details>}
      {!sharedRoll&&<a href="/spielbereich?bereich=sitzung">Gemeinsame Würfe am Live-Spieltisch senden ↗</a>}
    </section>
  );
}
