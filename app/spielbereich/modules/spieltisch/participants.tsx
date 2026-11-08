'use client';
/* eslint-disable @next/next/no-img-element -- Existing private participant avatar endpoint. */
import {lazy,Suspense,useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {UserRound,ScrollText,Backpack,Mail,ChevronUp,Coffee,Armchair,Check,NotebookPen} from 'lucide-react';
import type {QuickAction} from './vitals';
import type {Actor} from '@/domain/types';
import {presenceLabels} from '@/domain/live-participants';
import type {Snapshot} from './types';
import type {ParticipantAction} from './participant-content';
import styles from './participants.module.css';
const Content=lazy(()=>import('./participant-content').then(m=>({default:m.ParticipantContent})));
const actions:{id:ParticipantAction;label:string;icon:typeof UserRound}[]=[{id:'profile',label:'Profil',icon:UserRound},{id:'sheet',label:'Charakterbogen',icon:ScrollText},{id:'inventory',label:'Inventar',icon:Backpack},{id:'messages',label:'Nachrichten',icon:Mail},{id:'notebook',label:'Notizbuch (lesen)',icon:NotebookPen}];
function Tip({label,children}:{label:string;children:ReactNode}){return <span className={styles.tip}>{children}<span role="tooltip">{label}</span></span>;}
/** The player's own values in the header menu: one simple choice and one button, nothing more. Rights stay server-side. */
export type OwnQuick={title:string;actions:QuickAction[];onRun:(command:Record<string,unknown>)=>Promise<boolean>};
function OwnValues({quick}:{quick:OwnQuick}){
 const [choice,setChoice]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState('');
 const action=quick.actions.find(x=>x.value===choice);
 if(!quick.actions.length)return <span className={styles.ownValues}><small>{quick.title}: gerade nichts selbst zu buchen</small></span>;
 return <span className={styles.ownValues} role="group" aria-label={'Eigene Werte: '+quick.title}>
  <select aria-label="Eigene Werte steuern" value={action?choice:''} disabled={busy} onChange={e=>{setChoice(e.target.value);setDone('');}}><option value="">{quick.title}: Wert ändern …</option>{quick.actions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select>
  <button type="button" aria-label="Ausführen" disabled={!action||busy} onClick={async()=>{if(!action)return;setBusy(true);try{if(await quick.onRun(action.command)){setDone(action.label+' gebucht.');setChoice('');}}finally{setBusy(false);}}}><Check size={17}/></button>
  <span className={styles.ownDone} role="status">{done}</span>
 </span>;
}
function Avatar({member:m}:{member:Snapshot['crew'][number]}){const [failed,setFailed]=useState(false);return <span className={styles.avatar}>{m.avatar&&!failed?<img src={m.avatar} alt="" onError={()=>setFailed(true)}/>:m.initials}<span className={styles.presence} data-state={m.presence}/></span>;}
export function Participants({a,sessionId,crew,onBeforeOpen,onOpenChange,onAway,presenceError,externalMedia,externalRoll,quick,openSheet=0,ownHint,onOwnHint,renderOwnSheet}:{a:Actor;sessionId:string;crew:Snapshot['crew'];onBeforeOpen:()=>void;onOpenChange:(open:boolean)=>void;onAway:(afk:boolean)=>Promise<void>;presenceError:string;externalMedia?:string;externalRoll?:string;quick?:OwnQuick|null;openSheet?:number;ownHint?:string;onOwnHint?:()=>void;renderOwnSheet?:(fallback:ReactNode)=>ReactNode}){
 const [memberId,setMember]=useState(''),[action,setAction]=useState<ParticipantAction|null>(null),[closing,setClosing]=useState(false),[pending,setPending]=useState(false);
 const menu=useRef<HTMLElement>(null),returnFocus=useRef<HTMLElement|null>(null),closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null),opened=useRef(false),forCheck=useRef(false);
 const member=crew.find(m=>m.id===memberId),open=!!member&&!!action&&!closing;
 const close=useCallback((collapse=false)=>{if(collapse)setMember('');if(!opened.current)return;opened.current=false;onOpenChange(false);setClosing(true);returnFocus.current?.focus();if(closeTimer.current)clearTimeout(closeTimer.current);closeTimer.current=setTimeout(()=>{setAction(null);setClosing(false);},matchMedia('(prefers-reduced-motion: reduce)').matches?0:180);},[onOpenChange]);
 useEffect(()=>()=>{if(closeTimer.current)clearTimeout(closeTimer.current);},[]);
 // A sheet opened for a check folds away completely once the roll is shown, so the result stays unobstructed.
 useEffect(()=>{if(externalMedia||externalRoll)queueMicrotask(()=>{close(forCheck.current);forCheck.current=false;});},[externalMedia,externalRoll,close]);
 useEffect(()=>{if(open)menu.current?.querySelector<HTMLButtonElement>('header button')?.focus();},[open,action,memberId]);
 useEffect(()=>{if(!member&&opened.current)queueMicrotask(()=>close(true));},[member,close]);
 useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key!=='Escape'||e.defaultPrevented||window.document.querySelector('dialog[open], [data-slot="dialog-content"]'))return;if(open){e.preventDefault();e.stopPropagation();close(true);}else if(memberId){e.preventDefault();setMember('');}};window.addEventListener('keydown',escape,true);return()=>window.removeEventListener('keydown',escape,true);},[open,memberId,close]);
 // A check opens the own character sheet right below the own name, the same drawer as the toolbar's "Charakterbogen".
 useEffect(()=>{if(!openSheet||!crew.some(m=>m.id===a.id))return;queueMicrotask(()=>{forCheck.current=true;if(closeTimer.current)clearTimeout(closeTimer.current);onBeforeOpen();returnFocus.current=window.document.querySelector<HTMLElement>('[data-own-member]');setMember(a.id);setClosing(false);setAction('sheet');opened.current=true;onOpenChange(true);});},[openSheet]); // eslint-disable-line react-hooks/exhaustive-deps -- Only an explicit request opens the sheet.
 const activate=(id:ParticipantAction,button:HTMLElement,target=memberId)=>{if(target===memberId&&action===id&&open){close();return;}if(closeTimer.current)clearTimeout(closeTimer.current);onBeforeOpen();returnFocus.current=button;setMember(target);setClosing(false);setAction(id);opened.current=true;onOpenChange(true);};
 return <><nav className={styles.crew} aria-label="Spielerleiste">{crew.map(m=><div className={styles.participant} key={m.id}><button className={styles.member} data-own-member={m.id===a.id||undefined} aria-label={m.name+' · '+presenceLabels[m.presence]+(m.id===a.id&&ownHint?' · '+ownHint:'')} aria-expanded={memberId===m.id} aria-controls={memberId===m.id?'participant-actions':undefined} data-selected={memberId===m.id} onClick={e=>{if(memberId===m.id){close(true);return;}activate('profile',e.currentTarget,m.id);}}><Avatar member={m}/><span className={styles.playerName}>{m.name}<small>{presenceLabels[m.presence]}</small></span></button>{m.id===a.id&&memberId!==a.id&&ownHint&&onOwnHint&&<button type="button" className={styles.ownHint} onClick={onOwnHint}>{ownHint}</button>}{memberId===m.id&&<div id="participant-actions" className={styles.actions} role="toolbar" aria-label={'Aktionen für '+m.name}>{actions.filter(x=>(x.id!=='notebook'||a.gm&&m.id!==a.id)&&(!['sheet','inventory'].includes(x.id)||a.gm||m.id===a.id)).map(x=><Tip key={x.id} label={x.label}><button aria-label={x.label+' für '+m.name} aria-pressed={action===x.id&&open} onClick={e=>activate(x.id,e.currentTarget)}><x.icon size={18}/></button></Tip>)}{m.id===a.id&&<Tip label={m.presence==='afk'?'Zurück an den Tisch':'AFK setzen'}><button aria-label={m.presence==='afk'?'Zurück an den Tisch':'AFK setzen'} aria-pressed={m.presence==='afk'} disabled={pending} onClick={async()=>{setPending(true);try{await onAway(m.presence!=='afk');}finally{setPending(false);}}}>{m.presence==='afk'?<Armchair size={18}/>:<Coffee size={18}/>}</button></Tip>}{m.id===a.id&&!a.gm&&quick&&<OwnValues quick={quick}/>}</div>}</div>)}</nav>
 {presenceError&&<span className={styles.connectionIssue} role="status">Anwesenheit wird erneut verbunden.</span>}
 {member&&action&&<section ref={menu} className={styles.drawer} data-closing={closing} role="dialog" aria-modal="false" aria-label={actions.find(x=>x.id===action)!.label+' · '+member.name} aria-hidden={closing||undefined} inert={closing} data-participant-menu onKeyDown={e=>{if(e.key!=='Tab'||window.document.querySelector('dialog[open],[data-slot="dialog-content"]'))return;const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"],a[href]')).filter(el=>el.offsetParent!==null);const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&window.document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&window.document.activeElement===last){e.preventDefault();first?.focus();}}}>
  <header><div><span className={styles.caption}>PERSÖNLICHE ANSICHT · {member.name}</span><h2>{actions.find(x=>x.id===action)!.label}</h2></div><Tip label="Menü nach oben schließen"><button aria-label="Ingame-Menü schließen" onClick={()=>close(true)}><ChevronUp size={21}/></button></Tip></header>
  <div className={styles.content}><Suspense fallback={<p role="status">Ansicht wird geladen …</p>}>{memberId===a.id&&action==='sheet'&&renderOwnSheet?renderOwnSheet(<Content key={memberId+':'+action} a={a} sessionId={sessionId} memberId={memberId} action={action}/>):<Content key={memberId+':'+action} a={a} sessionId={sessionId} memberId={memberId} action={action}/>}</Suspense></div>
 </section>}</>;
}
