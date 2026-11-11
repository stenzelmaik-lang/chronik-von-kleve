"use client";
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, RefreshCw, ScrollText, ShieldCheck } from 'lucide-react';
import type { Entry } from '@/domain/legacy';
import { prepareSessionDraft, sessionSettlementComplete, sessionSettlementPayload,
  type SessionDraft, type SessionPlayer, type SessionReceipt } from '@/domain/xp-session-desk';
import { api } from './api-client';
import { MvpVoteAdmin } from './mvp-vote-admin';
import styles from './xp-session-desk.module.css';

type ReceiptWithReversals = SessionReceipt & {participants: {characterId:string;attended:boolean;rewards: ({type:'session'|'story'|'mvp'|'sl_exception';amount:number;reason:string;status:'pending'|'booked'|'failed';scopeId:string;ledgerEntryId:string|null;reversed?:boolean})[]}[]};
type Evening = { id:string; playedOn:string; title:string; appointmentId:string|null;
  settlement:null|{id:string;status:'complete'|'partial'|'failed';revision:number;participants:number;bookedRewards:number;outstandingRewards:number} };
type Result = { status:'complete'|'partial'|'failed';complete:boolean;
  receipt:{id:string;status:'complete'|'partial'|'failed';revision:number};
  totals:{booked:number;alreadyBooked:number;failed:number};
  characters:{characterId:string;status:string;rewards:{status:string;type:string;error?:string}[]}[] };
const today = () => { const d=new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); };
const germanDay = (value:string) => value.split('-').reverse().join('.');
const labels:Record<string,string> = {complete:'Abgeschlossen',partial:'Teilweise gebucht',failed:'Fehlgeschlagen'};

/** A compact SL desk inside the existing preparation area, not a second character manager. */
export function XpSessionDesk({entries}:{entries:Entry[]}) {
  const [evenings,setEvenings]=useState<Evening[]>([]);
  const [stories,setStories]=useState<{ id: string; title: string }[]>([]);
  const [extra,setExtra]=useState<{ characterId: string; type: 'story' | 'sl_exception'; storyId: string; amount: number; reason: string } | null>(null);
  const [players,setPlayers]=useState<SessionPlayer[]|null>(null);
  const [selected,setSelected]=useState('');
  const [draft,setDraft]=useState<SessionDraft[]>([]);
  const [receipt,setReceipt]=useState<ReceiptWithReversals|null>(null);
  const [receiptVersion,setReceiptVersion]=useState(0);
  const [loading,setLoading]=useState(true);
  const [receiptLoading,setReceiptLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [failures,setFailures]=useState<string[]>([]);
  const [sessionRecordId,setSessionRecordId]=useState('');
  const [playedOn,setPlayedOn]=useState(today);

  const reload=useCallback(async()=>{
    setLoading(true);
    try {
      const [days,members,rewards]=await Promise.all([
        api<{evenings:Evening[]}>('/api/character-engine?playedEvenings=1'),
        api<{players:SessionPlayer[]}>('/api/members?characters=1'),
        api<{stories:{id:string;title:string}[]}>('/api/character-engine?rewardStories=1'),
      ]);
      setEvenings(days.evenings);setPlayers(members.players);setStories(rewards.stories);
      setSelected(old=>days.evenings.some(day=>day.id===old)?old:(days.evenings[0]?.id??''));
      setError('');
    }catch(e){setError((e as Error).message);}finally{setLoading(false);}
  },[]);
  useEffect(()=>{void reload();},[reload]);

  useEffect(()=>{
    if(!selected||!players){setDraft([]);setReceipt(null);return;}
    let cancelled=false;
    setReceiptLoading(true);
    api<{settlement:ReceiptWithReversals|null}>('/api/character-engine?settlement='+encodeURIComponent(selected))
      .then(result=>{if(cancelled)return;setReceipt(result.settlement);setDraft(prepareSessionDraft(players,result.settlement));})
      .catch(e=>{if(!cancelled){setError((e as Error).message);setDraft([]);}})
      .finally(()=>{if(!cancelled)setReceiptLoading(false);});
    return()=>{cancelled=true;};
  },[selected,players,receiptVersion]);

  const completed=entries.filter(e=>e.kind==='sitzungen'&&e.id&&(
    e.body.status==='Abgeschlossen'||
    (e.body.sl_preparation as {document?:{status?:string}}|undefined)?.document?.status==='completed'
  ));
  const current=evenings.find(e=>e.id===selected);
  const attendees=draft.filter(d=>d.attended).length;
  const sessionTotal=draft.reduce((sum,d)=>sum+(d.attended?d.sessionAmount:0),0);
  const extraTotal=draft.reduce((sum,d)=>sum+d.extraRewards.reduce((sub,r)=>sub+r.amount,0),0);
  const change=(id:string,patch:Partial<SessionDraft>)=>{
    setDraft(rows=>rows.map(row=>row.characterId===id?{...row,...patch}:row));
    setNotice('');setFailures([]);
  };

  async function register(){
    if(!sessionRecordId||!playedOn){setError('Bitte einen abgeschlossenen Sitzungseintrag und den Spieltag auswählen.');return;}
    setBusy(true);setError('');setNotice('');
    try{
      const result=await api<{session:{id:string};created:boolean}>('/api/character-engine','POST',{
        action:'played_session_register',sessionRecordId,playedOn,
      });
      await reload();setSelected(result.session.id);setReceiptVersion(n=>n+1);
      setNotice(result.created?'Gespielter Abend registriert. Die EP können jetzt abgerechnet werden.':'Der bereits registrierte Abend wurde geöffnet.');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }

  async function settle(){
    let payload;
    try{payload=sessionSettlementPayload(selected,draft);}
    catch(e){setError((e as Error).message);return;}
    if(!window.confirm('EP für '+germanDay(current?.playedOn??'')+' buchen? '+attendees+' anwesend, '+sessionTotal+' reguläre EP. Bereits gebuchte Punkte werden nicht erneut ausgezahlt.'))return;
    setBusy(true);setError('');setNotice('');setFailures([]);
    try{
      const result=await api<Result>('/api/character-engine','POST',payload);
      const unresolved=result.characters.flatMap(row=>row.rewards.filter(r=>r.status==='failed')
        .map(r=>(draft.find(d=>d.characterId===row.characterId)?.title??row.characterId)+': '+(r.error??'Vergabe fehlgeschlagen')));
      setFailures(unresolved);
      setNotice(sessionSettlementComplete(result)?
        'Abrechnung gespeichert: '+result.totals.booked+' neu gebucht, '+result.totals.alreadyBooked+' bereits vorhanden.':
        'Die Abrechnung ist noch nicht vollständig. Erfolgreiche Vergaben bleiben erhalten; der Rest kann erneut gesendet werden.');
      await reload();setReceiptVersion(n=>n+1);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }

  return <section className={styles.desk} aria-label="SL-Erfahrungspunkteabrechnung">
    <header className={styles.heading}>
      <div><p className="eyebrow">CHRONIPLAY · SPIELLEITUNG</p><h3>Erfahrungspunkte abrechnen</h3>
      <p>Ein Abend, alle Charaktere. Jede Buchung bleibt im vorhandenen EP-Ledger nachvollziehbar.</p></div>
      <button type="button" className="button" disabled={busy||loading} onClick={()=>{setNotice('');void reload();}}><RefreshCw size={15}/>Aktualisieren</button>
    </header>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {notice&&<p className={styles.notice} role="status">{notice}</p>}
    {failures.length>0&&<div className={styles.error} role="alert"><strong>Offene Vergaben</strong><ul>{failures.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
    {loading&&<p role="status">Abrechnungen und Charaktere werden geladen …</p>}
    <div className={styles.toolbar}>
      <label>Registrierter Spielabend
        <select value={selected} disabled={busy||loading} onChange={e=>{setSelected(e.target.value);setExtra(null);setNotice('');setFailures([]);}}>
          <option value="">Bitte auswählen</option>
          {evenings.map(e=><option key={e.id} value={e.id}>{germanDay(e.playedOn)} · {e.title} · {e.settlement?labels[e.settlement.status]:'Nicht abgerechnet'}</option>)}
        </select>
      </label>
      {current&&<div className={styles.status} role="status"><ScrollText size={16}/>{current.settlement?
        labels[current.settlement.status]+' · '+current.settlement.bookedRewards+' gebucht · '+current.settlement.outstandingRewards+' offen':
        'Noch kein Abrechnungsbeleg'}</div>}
    </div>
    <details className={styles.register}>
      <summary>Gespielten Abend registrieren</summary>
      <p>Wähle einen wirklich abgeschlossenen Sitzungseintrag. Ein Kalendertermin allein gilt nicht als gespielt.</p>
      <div className={styles.registerFields}>
        <label>Sitzungseintrag
          <select value={sessionRecordId} onChange={e=>setSessionRecordId(e.target.value)} disabled={busy}>
            <option value="">Abgeschlossene Sitzung auswählen</option>
            {completed.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </label>
        <label>Gespielt am<input type="date" max={today()} value={playedOn} onChange={e=>setPlayedOn(e.target.value)} disabled={busy}/></label>
        <button className="button" type="button" disabled={busy||!sessionRecordId||!playedOn} onClick={()=>void register()}>Spielabend registrieren</button>
      </div>
      {!completed.length&&<p className={styles.hint}>Kein abgeschlossener Sitzungseintrag verfügbar. Schließe zuerst den Eintrag in der Sitzungsverwaltung ab.</p>}
    </details>
    {current&&(receiptLoading?<p role="status">Abrechnungsbeleg wird geladen …</p>:<>
      <div className={styles.summary}>
        <div><strong>{attendees}</strong><span>Anwesende Charaktere</span></div>
        <div><strong>{sessionTotal}</strong><span>Reguläre EP geplant</span></div>
        <div><strong>{extraTotal}</strong><span>Zusatz-EP im Beleg</span></div>
      </div>
      <p className={styles.hint}>Anwesenheit wird von dir gesetzt. Für abwesende Figuren ist eine begründete SL-Sondervergabe möglich.</p>
      {!draft.length?<p>Keine bestätigten Charaktere für diese Chronik gefunden.</p>:<div className={styles.characters}>
        {draft.map(row=>{
          const locked=row.sessionLocked||row.extraRewards.some(r=>r.status==='booked');
          return <article key={row.characterId} className={styles.character}>
            <div className={styles.characterName}>
              <div><strong>{row.title}</strong><small>{row.playerName}{row.historical?' · früherer Beleg':''}</small></div>
              <label className={styles.attendance}><input type="checkbox" checked={row.attended} disabled={busy||locked||row.historical}
                onChange={e=>change(row.characterId,{attended:e.target.checked,sessionAmount:e.target.checked?Math.max(1,row.sessionAmount):0})}/>Teilgenommen</label>
            </div>
            <div className={styles.characterFields}>
              <label>Reguläre EP<input type="number" min="0" max="5" step="1" value={row.sessionAmount}
                disabled={busy||!row.attended||row.sessionLocked||row.historical}
                onChange={e=>change(row.characterId,{sessionAmount:Number(e.target.value)})}/></label>
              <label>Begründung<input type="text" maxLength={2000} value={row.sessionReason}
                disabled={busy||!row.attended||row.sessionAmount===0||row.sessionLocked||row.historical}
                onChange={e=>change(row.characterId,{sessionReason:e.target.value})}/></label>
              <span className={styles.rewardState}>{row.sessionLocked?<><CheckCircle2 size={15}/>Bereits gebucht</>:
                row.attended&&row.sessionAmount>0?'Zur Vergabe vorgesehen':'Keine Vergabe'}</span>
            </div>
            {row.extraRewards.length>0&&<div className={styles.extras}><strong>Zusatzvergaben</strong>
              {row.extraRewards.map((reward,index)=><p key={index}>{reward.type==='story'?'Storybogen':reward.type==='mvp'?'MVP':'SL-Sondervergabe'} · {reward.amount} EP · {reward.reason}
                <small> ({reward.reversed?'storniert':reward.status==='booked'?'gebucht':'noch offen'})</small>
                {reward.status==='pending' && <button type="button" className="button" disabled={busy} onClick={()=>change(row.characterId,{extraRewards:row.extraRewards.filter((_,i)=>i!==index)})}>Entfernen</button>}
              </p>)}</div>}
            {!row.historical && <button type="button" className="button" disabled={busy} onClick={()=>setExtra({characterId:row.characterId,type:'sl_exception',storyId:'',amount:1,reason:''})}>Zusatz-EP vormerken</button>}
            {extra?.characterId===row.characterId && <form className="stack-form" onSubmit={event=>{
              event.preventDefault();
              if (row.extraRewards.some(x=>x.type===extra.type&&(x.type!=='story'||x.storyId===extra.storyId))) {
                setError('Diese Quelle steht bereits in der Abrechnung.');return;
              }
              change(row.characterId,{extraRewards:[...row.extraRewards,{type:extra.type,amount:extra.amount,reason:extra.reason,
                ...(extra.type==='story'?{storyId:extra.storyId}:{}),status:'pending'}]});setExtra(null);
            }}>
              <label>Kategorie<select value={extra.type} onChange={event=>setExtra({...extra,type:event.target.value as 'story'|'sl_exception',amount:1})}>
                <option value="sl_exception">SL-Sondervergabe</option>{row.attended&&stories.length>0&&<option value="story">Abgeschlossener Storybogen</option>}</select></label>
              {extra.type==='story'&&<label>Storybogen<select required value={extra.storyId} onChange={event=>setExtra({...extra,storyId:event.target.value})}>
                <option value="">Auswählen</option>{stories.map(story=><option key={story.id} value={story.id}>{story.title}</option>)}</select></label>}
              <label>EP<input required type="number" min={1} max={extra.type==='story'?3:1000} value={extra.amount} onChange={event=>setExtra({...extra,amount:Number(event.target.value)})}/></label>
              <label>Begründung<input required minLength={3} maxLength={2000} value={extra.reason} onChange={event=>setExtra({...extra,reason:event.target.value})}/></label>
              <button className="button" disabled={busy}>Vormerken</button><button className="button" type="button" onClick={()=>setExtra(null)}>Abbrechen</button>
            </form>}
          </article>;
        })}
      </div>}
      <footer className={styles.footer}>
        <p><ShieldCheck size={16}/>Gebuchte Punkte werden nicht überschrieben. Stornos stehen im Charakter-Ledger; die Übersicht zeigt zunächst den ursprünglichen Buchungsstatus.</p>
        <button className="button primary" type="button" disabled={busy||receiptLoading||!draft.length} onClick={()=>void settle()}>
          {busy?'Wird verbucht …':'EP für die Runde bestätigen'}</button>
      </footer>
      <MvpVoteAdmin key={current.id} sessionId={current.id} players={players??[]} draft={draft}
        receiptStatus={current.settlement?.status??null}
        onBooked={()=>{void reload();setReceiptVersion(n=>n+1);}}/>
      {receipt&&<p className={styles.hint}><Clock3 size={14}/>Der Abrechnungsbeleg bleibt erhalten. Teilfehler können mit denselben Angaben erneut bestätigt werden.</p>}
    </>)}
    {!loading&&!evenings.length&&<p className={styles.hint}>Noch keine gespielten Abende registriert. Verwende oben „Gespielten Abend registrieren“.</p>}
  </section>;
}
