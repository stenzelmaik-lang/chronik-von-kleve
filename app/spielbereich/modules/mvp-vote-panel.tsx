"use client";
import {useCallback,useEffect,useState} from 'react';
import {Award,CheckCircle2} from 'lucide-react';
import {api} from './api-client';
import styles from './mvp-vote.module.css';

type Evening = {id:string;title:string;playedOn:string};
type Vote = {session:Evening;status:'none'|'open'|'closed';candidates:{id:string;name:string}[];myVote:string|null;totalVotes:number};

/** Private ballot in the existing player Rückblicke area. Never exposes other voters. */
export function MvpVotePanel({actorId}:{actorId:string}) {
  const [polls,setPolls]=useState<Evening[]>([]);
  const [selected,setSelected]=useState('');
  const [vote,setVote]=useState<Vote|null>(null);
  const [nominee,setNominee]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);

  const refresh=useCallback(async()=>{
    try{
      const result=await api<{openPolls:Evening[]}>('/api/mvp');
      setPolls(result.openPolls);
      setSelected(old=>result.openPolls.some(x=>x.id===old)?old:(result.openPolls[0]?.id??''));
      setError('');
    }catch(e){setError((e as Error).message);}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{
    if(!selected){setVote(null);setNominee('');return;}
    let active=true;
    api<{poll:Vote}>('/api/mvp?sessionId='+encodeURIComponent(selected))
      .then(response=>{if(active){setVote(response.poll);setNominee(response.poll.myVote??'');}})
      .catch(e=>{if(active)setError((e as Error).message);});
    return()=>{active=false;};
  },[selected]);

  const options=vote?.candidates.filter(c=>c.id!==actorId)??[];
  async function submit(){
    if(!vote||!nominee||busy)return;
    setBusy(true);setError('');
    try{
      const answer=await api<{poll:Vote}>('/api/mvp','POST',{action:'vote',sessionId:vote.session.id,nomineeId:nominee});
      setVote(answer.poll);setNominee(answer.poll.myVote??'');
    }catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  }
  if(!polls.length&&!error)return null;
  return <section className={styles.panel} aria-label="MVP-Auszeichnung nach dem Spielabend">
    <header><Award size={21} aria-hidden="true"/><div><h2>MVP der Runde</h2>
      <p>Welcher Mitspieler hat dich besonders beeindruckt? Du kannst eine andere teilnehmende Person nominieren.</p></div></header>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {loading?<p role="status">MVP-Abstimmungen werden geladen …</p>:!!polls.length&&<>
      {polls.length>1&&<label className={styles.field}>Spielabend
        <select value={selected} onChange={e=>setSelected(e.target.value)} disabled={busy}>
          {polls.map(p=><option key={p.id} value={p.id}>{p.playedOn} · {p.title}</option>)}
        </select>
      </label>}
      {vote?.status==='open'&&<div className={styles.form}>
        <label className={styles.field}>Deine Nominierung
          <select value={nominee} onChange={e=>setNominee(e.target.value)} disabled={busy}>
            <option value="">Mitspieler auswählen</option>
            {options.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <button type="button" className="button primary" disabled={busy||!nominee} onClick={()=>void submit()}>
          {busy?'Wird gespeichert …':vote.myVote?'Stimme ändern':'Stimme abgeben'}</button>
        {vote.myVote&&<p className={styles.saved} role="status"><CheckCircle2 size={16}/>Stimme gespeichert. Bis zum Abschluss kannst du sie ändern.</p>}
        <p className={styles.note}>Eine Stimme pro Spieler, keine Selbstwahl. Der MVP erhält nach SL-Entscheidung 1–2 Sonder-EP.</p>
      </div>}
    </>}
  </section>;
}
