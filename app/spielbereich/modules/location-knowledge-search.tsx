'use client';
import {useEffect,useState} from 'react';
import {api} from './api-client';
import styles from './location-library.module.css';
type Result={title:string;context:string;snippet:string;href:string};
export function LocationKnowledgeSearch({placeId,view='player',viewerId}:{placeId?:string;view?:string;viewerId?:string}){
  const [q,setQ]=useState(''),[all,setAll]=useState(false),[results,setResults]=useState<Result[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{if(q.trim().length<2)return;let active=true;const timer=setTimeout(()=>{setBusy(true);api<{results:Result[]}>(`/api/locations/search?q=${encodeURIComponent(q)}&view=${view}${viewerId?"&viewerId="+encodeURIComponent(viewerId):""}${!all&&placeId?'&placeId='+encodeURIComponent(placeId):''}`).then(data=>{if(active){setResults(data.results);setError('');}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});},300);return()=>{active=false;clearTimeout(timer);};},[q,all,placeId,view,viewerId]);
  return <section className={styles.library} aria-label="Ortswissen suchen"><h3>Ortswissen durchsuchen</h3><div className={styles.tools}><label className="field"><span>Suchbegriff</span><input type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Beschreibung, Raum oder Erkenntnis …"/></label>{placeId&&<label><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/> Alle Orte durchsuchen</label>}</div>{error&&<p role="alert">{error}</p>}{busy&&<p role="status">Suche läuft …</p>}{q.trim().length>=2&&!busy&&<><p role="status">{results.length} Treffer</p>{results.map((r,i)=><a className={styles.notice} key={r.href+':'+i} href={r.href}><strong>{r.title}</strong><small> · {r.context}</small><p>{r.snippet}</p></a>)}</>}</section>;
}
