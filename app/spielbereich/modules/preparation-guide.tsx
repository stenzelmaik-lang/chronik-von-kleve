import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import s from './story-workspace.module.css';

export function PreparationGuide({label,steps,active,busy,onStep,onFinish,finishLabel,children}:{
  label:string; steps:readonly {id:string;label:string;hint:string}[];active:string;busy:boolean;
  onStep:(id:string)=>void;onFinish:()=>void;finishLabel:string;children:ReactNode;
}) {
  const index=Math.max(0,steps.findIndex(step=>step.id===active));
  const step=steps[index];
  return <section className={s.guide} aria-label={label}>
    <nav className={s.guideSteps} aria-label={`${label} Schritte`}>{steps.map((item,position)=><button key={item.id} type="button" disabled={busy} aria-current={position===index?'step':undefined} aria-label={item.label} onClick={()=>onStep(item.id)}><span>{position+1}</span>{item.label}</button>)}</nav>
    <header className={s.guideHead}><p>Schritt {index+1} von {steps.length} · {label}</p><h2>{step.label}</h2><p>{step.hint}</p><small>Du kannst Bereiche direkt anwählen und optionale Angaben überspringen. Beim Wechsel wird gespeichert.</small></header>
    <div className={s.guideBody}>{children}</div>
    <footer className={s.guideFooter}>
      <button type="button" disabled={busy||index===0} onClick={()=>onStep(steps[index-1].id)}><ArrowLeft size={16} aria-hidden="true"/>Zurück</button>
      {index<steps.length-1?<><button type="button" disabled={busy} onClick={()=>onStep(steps[index+1].id)}>Bereich überspringen</button><button type="button" className={s.guidePrimary} disabled={busy} onClick={()=>onStep(steps[index+1].id)}>Speichern & weiter<ArrowRight size={16} aria-hidden="true"/></button></>:<button type="button" className={s.guidePrimary} disabled={busy} onClick={onFinish}><Check size={16} aria-hidden="true"/>{finishLabel}</button>}
    </footer>
  </section>;
}
