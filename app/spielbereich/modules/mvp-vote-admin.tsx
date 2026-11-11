"use client";
import {useEffect,useMemo,useState} from 'react';
import {Award,CheckCircle2,RefreshCw} from 'lucide-react';
import {api} from './api-client';
import type {SessionPlayer,SessionDraft} from '@/domain/xp-session-desk';
import styles from './mvp-vote-admin.module.css';
type View={session:{id:string;title:string;playedOn:string};status:'none'|'open'|'closed';
  candidates:{id:string;name:string}[];totalVotes:number;myVote:string|null;
  results?:{nomineeId:string;votes:number}[]};
type SettlementResult={complete:boolean;status:string;receipt:{status:string}};
export function MvpVoteAdmin({sessionId,players,draft,receiptStatus,onBooked}:{
  sessionId:string;players:SessionPlayer[];draft:SessionDraft[];receiptStatus:'complete'|'partial'|'failed'|null;onBooked:()=>void;
}){
  const [poll,setPoll]=useState<View|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [selected,setSelected]=useState(''),[characterId,setCharacterId]=useState(''),[amount,setAmount]=useState<1|2>(1);
  useEffect(()=>{let active=true;setPoll(null);setError('');
    api<{poll:View}>('/api/mvp?sessionId='+encodeURIComponent(sessionId)).then(r=>{if(active)setPoll(r.poll);})
      .catch(e=>{if(active)setError((e as Error).message);});
    return()=>{active=false;};
  },[sessionId]);
  const winners=useMemo(()=>{const votes=poll?.results??[];const max=Math.max(0,...votes.map(v=>v.votes));
    return votes.filter(v=>v.votes===max&&v.votes>0).map(v=>({id:v.nomineeId,votes:v.votes,
      name:poll?.candidates.find(c=>c.id===v.nomineeId)?.name??'Teilnehmer'}));
  },[poll]);
  const recipient=selected&&winners.some(w=>w.id===selected)?selected:(winners[0]?.id??'');
  const characterChoices=(players.find(p=>p.id===recipient)?.characters??[])
    .filter(c=>draft.some(d=>d.characterId===c.id&&d.attended));
  const target=characterChoices.some(c=>c.id===characterId)?characterId:(characterChoices[0]?.id??'');
  const booked=draft.some(d=>d.extraRewards.some(e=>e.type==='mvp'&&e.status==='booked'));
  async function act(action:'open'|'close'){
    setBusy(true);setError('');
    try{const r=await api<{poll:View}>('/api/mvp','POST',{action,sessionId});setPoll(r.poll);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function award(){
    if(!target||booked)return;
    const winner=players.find(p=>p.id===recipient)?.name??'ausgewählter Spieler';
    if(!window.confirm('MVP-Auszeichnung für '+winner+' mit '+amount+' EP endgültig verbuchen?'))return;
    setBusy(true);setError('');
    try{
      const r=await api<SettlementResult>('/api/character-engine','POST',{
        action:'xp_settlement',sessionId,entries:[{characterId:target,attended:true,
          rewards:[{type:'mvp',amount,reason:'MVP-Auszeichnung nach Abstimmung des Spielabends'}]}],
      });
      if(r.status!=='complete'||!r.complete||r.receipt.status!=='complete')throw new Error('Die Vergabe wurde nur teilweise abgeschlossen. Bitte den Beleg prüfen, bevor du sie wiederholst.');
      onBooked();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section className={styles.panel} aria-label="MVP-Abstimmung verwalten">
    <header><Award size={19} aria-hidden="true"/><div><h4>MVP-Auszeichnung</h4><p>Die Runde würdigt besondere Leistungen mit 1–2 Sonder-EP.</p></div>
      <button type="button" className="button" aria-label="MVP-Stand neu laden" disabled={busy}
        onClick={()=>{setPoll(null);api<{poll:View}>('/api/mvp?sessionId='+encodeURIComponent(sessionId)).then(r=>setPoll(r.poll)).catch(e=>setError((e as Error).message));}}>
        <RefreshCw size={15}/></button>
    </header>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {!poll?<p role="status">MVP-Wahl wird geladen …</p>:<>
      {poll.status==='none'&&<div className={styles.line}>
        <p>Die Abstimmung ist noch nicht geöffnet.</p>
        <button type="button" className="button" disabled={busy||receiptStatus!=='complete'||poll.candidates.length<2}
          onClick={()=>void act('open')}>Abstimmung eröffnen</button>
        {receiptStatus!=='complete'&&<small>Vorher die Anwesenheit und Sitzungsabrechnung abschließen.</small>}
      </div>}
      {poll.status==='open'&&<div className={styles.line}>
        <p><strong>{poll.totalVotes}</strong> von {poll.candidates.length} teilnehmenden Spielern haben abgestimmt.</p>
        <button type="button" className="button" disabled={busy} onClick={()=>{if(window.confirm('MVP-Abstimmung jetzt schließen?'))void act('close');}}>Abstimmung schließen</button>
      </div>}
      {poll.status==='closed'&&<div className={styles.line}>
        <p><CheckCircle2 size={15}/>Die Abstimmung ist abgeschlossen: {poll.totalVotes} Stimmen.</p>
        {!winners.length?<p>Keine Stimmen abgegeben. Es wird kein MVP vorgeschlagen.</p>:<>
          {winners.length>1&&<p>Gleichstand – die Spielleitung wählt aus den gleichplatzierten Personen.</p>}
          <div className={styles.controls}>
            <label>MVP
              <select value={recipient} disabled={busy||booked} onChange={e=>{setSelected(e.target.value);setCharacterId('');}}>
                {winners.map(w=><option key={w.id} value={w.id}>{w.name} · {w.votes} {w.votes===1?'Stimme':'Stimmen'}</option>)}
              </select>
            </label>
            <label>Charakter
              <select value={target} disabled={busy||booked} onChange={e=>setCharacterId(e.target.value)}>
                {characterChoices.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            <label>Sonder-EP
              <select value={amount} disabled={busy||booked} onChange={e=>setAmount(Number(e.target.value)===2?2:1)}>
                <option value="1">1 EP</option><option value="2">2 EP</option>
              </select>
            </label>
            <button type="button" className="button primary" disabled={busy||booked||!target}
              onClick={()=>void award()}>{booked?'MVP bereits verbucht':'MVP-EP vergeben'}</button>
          </div>
          <p className={styles.note}>Die MVP-Belohnung wird über das vorhandene EP-Ledger gebucht. Keine weitere Auszeichnung im selben Abend vergeben.</p>
        </>}
      </div>}
    </>}
  </section>;
}
