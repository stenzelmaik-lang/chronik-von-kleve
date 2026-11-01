import React,{useEffect,useRef,useState} from 'react';
import {FastForward,X,Users} from 'lucide-react';
import {v20OutcomeLabel,type V20Report} from '@/domain/w10';
import styles from './stage.module.css';
export type DicePresentation={id:string;dice:readonly number[];target:number;motionSeed:readonly number[];report?:V20Report};
type Metrics={duration:number;asleep:boolean;contacts:number;diePairs:number;computeMs:number;endValues:number[];seed:number[];traySides:number};
type View={ready:Promise<void>;dispose:()=>void;finish:()=>void};
export function DiceEffect({result,author,title,animate=true,onClose,onCloseShared,pendingCount=0,nextTitle,nextAuthor,onNext}:{result:DicePresentation;author:string;title?:string;animate?:boolean;onClose:()=>void;onCloseShared?:()=>Promise<void>;pendingCount?:number;nextTitle?:string;nextAuthor?:string;onNext:()=>void}){
  const host=useRef<HTMLDivElement>(null),skip=useRef<HTMLButtonElement>(null),close=useRef<HTMLButtonElement>(null),view=useRef<View|null>(null),finishRequested=useRef(!animate);
  const profile=new URLSearchParams(location.search),testStatic=profile.get('testMotion')==='reduce',testCanvasOff=profile.get('testCanvas')==='off';
  const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches||testStatic),[phase,setPhase]=useState<'preparing'|'rolling'|'settled'|'fallback'>('preparing'),[error,setError]=useState(''),[failureReason,setFailureReason]=useState(''),[metrics,setMetrics]=useState<Metrics|null>(null),[closing,setClosing]=useState(false);
  const [requested,setRequested]=useState(!animate);
  const moving=phase==='preparing'||phase==='rolling';
  function finish(){setRequested(true);finishRequested.current=true;view.current?.finish();}
  useEffect(()=>{(animate&&!reduced&&!testCanvasOff?skip:close).current?.focus();},[]); // eslint-disable-line react-hooks/exhaustive-deps -- Initial focus only; later focus changes follow user actions.
  useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>{setReduced(media.matches||testStatic);if(media.matches||testStatic)finish();};media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[testStatic]);
  useEffect(()=>{
    const controller=new AbortController();
    if(testCanvasOff){queueMicrotask(()=>{if(!controller.signal.aborted)setPhase('fallback');});return()=>controller.abort();}
    void (async()=>{
      try{
        const {createDiceView}=await import('./dice-webgl.mjs');if(controller.signal.aborted||!host.current)return;
        const created=createDiceView(host.current,result,{signal:controller.signal,staticStart:finishRequested.current||reduced,onMetrics:(value:Metrics)=>{if(!controller.signal.aborted){setMetrics(value);setPhase('rolling');}},onSettled:()=>{if(!controller.signal.aborted){setPhase('settled');if(window.document.activeElement===skip.current)close.current?.focus();}},onFailure:(issue:Error)=>{if(!controller.signal.aborted){setFailureReason(issue.message);setPhase('fallback');}}});
        view.current=created;if(finishRequested.current)created.finish();await created.ready;
      }catch(issue){if(!controller.signal.aborted){setFailureReason((issue as Error).message);setPhase('fallback');}}
    })();
    return()=>{controller.abort();view.current?.dispose();};
  },[result.id,testCanvasOff]); // eslint-disable-line react-hooks/exhaustive-deps -- Immutable roll identity owns the renderer; polling must never restart a throw.
  useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(event.key!=='Escape'||window.document.querySelector('dialog[open]'))return;event.preventDefault();event.stopPropagation();if(moving)finish();else onClose();};window.document.addEventListener('keydown',escape);return()=>window.document.removeEventListener('keydown',escape);},[moving,onClose]);
  return <section className={styles.diceEffect} role="region" aria-label="Gemeinsamer Würfelwurf" data-roll-id={result.id} data-phase={phase} data-fallback={phase==='fallback'} data-large={result.dice.length>10} data-end-values={metrics?.endValues.join(',')} data-contacts={metrics?.contacts} data-die-pairs={metrics?.diePairs} data-duration={metrics?.duration} data-compute-ms={metrics?.computeMs} data-motion-seed={metrics?.seed.join('-')} data-tray-sides={metrics?.traySides} data-render-error={failureReason}>
    <header><div><small>{title||'Freier Wurf'} · {author}</small><h2>{result.dice.length} W10 <span>SG {result.target}</span></h2></div><div>{moving&&<button ref={skip} onClick={finish} aria-label="Würfelanimation überspringen"><FastForward size={17}/><span>Ergebnis zeigen</span></button>}{onCloseShared&&<button aria-label="Wurf fuer die gesamte Runde schliessen" disabled={closing} onClick={async()=>{setClosing(true);setError('');try{await onCloseShared();}catch(issue){setError((issue as Error).message);}finally{setClosing(false);}}}><Users size={17}/><span>Für alle schließen</span></button>}<button ref={close} onClick={onClose} aria-label="Würfelansicht nur für mich schließen" title="Nur für mich schließen"><X size={19}/></button></div></header>
    {pendingCount>0&&<button className={styles.nextRoll} disabled={moving} onClick={onNext}>Neuer Wurf: {nextTitle||'Freier Wurf'}{nextAuthor?' · '+nextAuthor:''}{pendingCount>1?' (+'+(pendingCount-1)+')':''} · ansehen</button>}
    {phase!=='fallback'&&<div className={styles.diceCanvasArea}><div ref={host} className={styles.diceWebgl}/>{phase==='preparing'&&<p className={styles.dicePreparing} role="status">{requested||reduced?'Endbild wird bereitgestellt …':'Würfel werden aufgelegt …'}</p>}</div>}
    {phase==='fallback'&&<div className={styles.diceStaticTray} aria-label="Statische Würfelschale">{result.dice.map((v,i)=><span key={i} className={styles.staticDie}>{v}</span>)}</div>}
    <div className={styles.diceReadout}><ol className={styles.diceValues} aria-label="Feststehende W10-Einzelergebnisse" aria-live="polite">{result.dice.map((value,index)=><li key={index} aria-label={'Würfel '+(index+1)+': '+value} data-value={value} className={result.report?.cancelledSuccessIndices.includes(index)?styles.cancelledDie:value===1?styles.oneDie:''}>{value}</li>)}</ol>
      <p className={styles.diceScope}>{result.report&&<><strong data-outcome={result.report.outcome}>{v20OutcomeLabel[result.report.outcome]} · {result.report.netSuccesses} {result.report.netSuccesses===1?'Erfolg':'Erfolge'}</strong>{result.report.cancelled>0&&<> · {result.report.cancelled} durch Einsen aufgehoben</>}</>}</p>
      {(reduced||phase==='fallback')&&<small className={styles.diceHelp}>{reduced?'Reduzierte Bewegung.':'Vereinfachte Ansicht.'}</small>}{error&&<p role="alert">{error}</p>}
    </div>
  </section>;
}
