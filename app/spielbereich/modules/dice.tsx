"use client";
import { Dices } from "lucide-react";
import { useState } from "react";

export function DicePanel({sharedRoll,disabled=false}:{sharedRoll?:(pool:number,target:number)=>Promise<number[]>;disabled?:boolean}={}) {
  const [pool, setPool] = useState(5),
    [target, setTarget] = useState(6),
    [dice, setDice] = useState<number[]>([]);
  const [rolling,setRolling]=useState(false),[error,setError]=useState('');
  return (
    <section className="panel dice-panel">
      <h2>W10-Würfelpool</h2>
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
          if(sharedRoll){setRolling(true);try{setDice(await sharedRoll(pool,target));}catch(issue){setError((issue as Error).message);}finally{setRolling(false);}return;}
          const ds = Array.from({ length: pool }, () => {
            const n = new Uint32Array(1);
            do {
              crypto.getRandomValues(n);
            } while (n[0] >= 4294967290);
            return (n[0] % 10) + 1;
          });
          setDice(ds);
        }}
      >
        <Dices size={20} /> {rolling?'Wurf wird gesendet …':sharedRoll?'Würfeln & Zielgruppe zeigen':'Würfeln'}
      </button>
      {error&&<p role="alert">{error}</p>}
      <div className="dice-results" aria-live="polite">
        {dice.map((d, i) => (
          <span key={i} className={d >= target ? "die success" : "die"}>
            {d}
          </span>
        ))}
      </div>
      {dice.length > 0 && (
        <p>
          {dice.filter((d) => d >= target).length} Würfel erreichen die Schwelle{" "}
          {target}. Einsen: {dice.filter((d) => d === 1).length}.
        </p>
      )}
      <p className="muted">
        Rohwurf ohne automatische Patzer-, Hunger- oder Hausregel-Auswertung.
      </p>
      {!sharedRoll&&<a href="/spielbereich?bereich=sitzung">Gemeinsame Würfe am Live-Spieltisch senden ↗</a>}
    </section>
  );
}
