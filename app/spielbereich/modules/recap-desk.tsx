"use client";
import {useEffect,useState} from "react";
import {Eye,EyeOff,Plus,Save} from "lucide-react";
import type {Entry} from "@/domain/legacy";
import {api} from "./api-client";
import {RichTextEditor,RichTextView} from "./rich-text";
import styles from "./recap-desk.module.css";

/** A Rückblick is a Chronik entry of the domain (type "rueckblick"): draft = only SL, released = the whole round. */
export const isRecap=(e:Entry)=>e.body?.type==="rueckblick";
type Draft={id?:string;version?:number;title:string;sessionId:string;date:string;text:string;released:boolean};
const empty=():Draft=>({title:"",sessionId:"",date:new Date().toISOString().slice(0,10),text:"",released:false});
const when=(e:Entry)=>Date.parse(String(e.body.date||e.body.datetime||e.body.start||e.updated_at));

/** Kommandozentrale · Rückblicke: the SL writes what happened and releases it to the players. */
export function RecapDesk(){
  const [recaps,setRecaps]=useState<Entry[]|null>(null),[sessions,setSessions]=useState<Entry[]>([]),[draft,setDraft]=useState<Draft|null>(null);
  const [busy,setBusy]=useState(false),[status,setStatus]=useState(""),[error,setError]=useState(""),[reload,setReload]=useState(0),[now,setNow]=useState(0);
  useEffect(()=>{let live=true;Promise.all([api<{records:Entry[]}>("/api/records?kind=chronik&view=sl"),api<{records:Entry[]}>("/api/records?kind=sitzungen&view=sl")]).then(([c,s])=>{if(!live)return;setNow(Date.now());setRecaps(c.records.filter(isRecap).sort((x,y)=>when(y)-when(x)));setSessions(s.records);}).catch(e=>{if(live)setError((e as Error).message);});return()=>{live=false;};},[reload]);
  const past=sessions.filter(s=>Number.isFinite(when(s))&&when(s)<=now).sort((x,y)=>when(y)-when(x));
  function edit(e:Entry){setStatus("");setDraft({id:e.id,version:e.version,title:e.title,sessionId:String(e.body.sessionId||""),date:String(e.body.date||"").slice(0,10),text:String(e.body.text||""),released:e.visibility==="group"});}
  async function save(release:boolean){
    if(!draft)return;
    if(!draft.title.trim()){setStatus("Bitte einen Titel eingeben.");return;}
    setBusy(true);setStatus("");
    try{
      const res=await api<{id:string;version:number}>("/api/records","POST",{...(draft.id?{id:draft.id,version:draft.version}:{}),kind:"chronik",title:draft.title.trim(),visibility:release?"group":"sl",body:{type:"rueckblick",sessionId:draft.sessionId||undefined,date:draft.date,text:draft.text}});
      setDraft({...draft,id:res.id,version:res.version,released:release});
      setStatus(release?"Freigegeben: Die Runde sieht den Rückblick jetzt unter „Rückblicke“ und in der Chronik.":"Als Entwurf gespeichert. Nur du siehst ihn.");
      setReload(n=>n+1);
    }catch(e){setStatus((e as Error).message);}
    finally{setBusy(false);}
  }
  if(error)return <p role="alert" className="error-box">{error}</p>;
  if(!recaps)return <p role="status">Rückblicke werden geladen …</p>;
  return <div className={styles.desk}>
    <header className={styles.head}><div><h1>Rückblicke</h1><p>Was geschah am Spielabend? Schreib es auf und gib es frei, wenn die Runde es lesen soll. Freigegebene Rückblicke stehen bei den Spielern unter „Rückblicke“ und in der Chronik der Domäne.</p></div><button type="button" className="button primary" onClick={()=>{setStatus("");setDraft(empty());}}><Plus size={16}/>Neuer Rückblick</button></header>
    <div className={styles.columns}>
      <ul className={styles.list} aria-label="Rückblicke">{recaps.length?recaps.map(r=><li key={r.id}><button type="button" aria-current={draft?.id===r.id?"true":undefined} onClick={()=>edit(r)}><strong>{r.title}</strong><span>{String(r.body.date||"").slice(0,10)} · {r.visibility==="group"?"freigegeben":"Entwurf"}</span></button></li>):<li className={styles.empty}>Noch kein Rückblick geschrieben.</li>}</ul>
      {draft?<section className={styles.editor} aria-label="Rückblick bearbeiten">
        <label className={styles.field}><span>Titel</span><input value={draft.title} maxLength={200} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="Die Nacht am Hafen"/></label>
        <div className={styles.row}>
          <label className={styles.field}><span>Spielabend</span><select value={draft.sessionId} onChange={e=>{const s=past.find(x=>x.id===e.target.value);setDraft({...draft,sessionId:e.target.value,date:s?new Date(when(s)).toISOString().slice(0,10):draft.date,title:draft.title||(s?"Rückblick: "+s.title:"")});}}><option value="">Ohne Bezug</option>{past.map(s=><option key={s.id} value={s.id}>{s.title} · {new Date(when(s)).toLocaleDateString("de-DE")}</option>)}</select></label>
          <label className={styles.field}><span>Datum</span><input type="date" value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></label>
        </div>
        <div className={styles.split}><div><RichTextEditor value={draft.text} onChange={v=>setDraft({...draft,text:v})} label="Rückblick" placeholder="Was ist passiert? Wer war dabei? Welche Fragen bleiben?" maximumPlainLength={20000} disabled={busy}/></div><aside className={styles.preview} aria-label="So sieht es die Runde"><span>So sieht es die Runde</span>{draft.text.trim()?<RichTextView value={draft.text} readable/>:<p className={styles.empty}>Noch leer.</p>}</aside></div>
        <footer className={styles.actions}><button type="button" className="button" disabled={busy} onClick={()=>void save(false)}>{draft.released?<EyeOff size={16}/>:<Save size={16}/>}{draft.released?"Zurück auf Entwurf":"Als Entwurf speichern"}</button><button type="button" className="button primary" disabled={busy} onClick={()=>void save(true)}><Eye size={16}/>{draft.released?"Änderungen freigeben":"Für die Runde freigeben"}</button><span role="status">{status}</span></footer>
      </section>:<p className={styles.empty}>Wähle links einen Rückblick oder schreib einen neuen.</p>}
    </div>
  </div>;
}
