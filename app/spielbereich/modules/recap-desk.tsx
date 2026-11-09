"use client";
import {useEffect,useState} from "react";
import {Eye,EyeOff,Plus,Save} from "lucide-react";
import type {Entry} from "@/domain/legacy";
import {api} from "./api-client";
import {RichTextEditor,RichTextView} from "./rich-text";
import styles from "./recap-desk.module.css";

/** Two kinds of Chronik entries: a Rückblick (also on the Zuflucht and under Rückblicke) and a plain Chronik entry. */
export const isRecap=(e:Entry)=>e.body?.type==="rueckblick";
type Kind="rueckblick"|"chronik";
type Draft={id?:string;version?:number;kind:Kind;title:string;sessionId:string;date:string;text:string;released:boolean;base:Record<string,unknown>};
const empty=(kind:Kind):Draft=>({kind,title:"",sessionId:"",date:new Date().toISOString().slice(0,10),text:"",released:false,base:{}});
const when=(e:Entry)=>Date.parse(String(e.body.date||e.body.datetime||e.body.start||e.updated_at));
const kindLabel:Record<Kind,string>={rueckblick:"Rückblick",chronik:"Chronik-Eintrag"};

/** Kommandozentrale · Rückblicke & Chronik: one desk, two kinds; the overview comes first. */
export function RecapDesk(){
  const [entries,setEntries]=useState<Entry[]|null>(null),[sessions,setSessions]=useState<Entry[]>([]),[draft,setDraft]=useState<Draft|null>(null),[filter,setFilter]=useState<Kind|"alle">("alle");
  const [editorKey,setEditorKey]=useState(0),[busy,setBusy]=useState(false),[status,setStatus]=useState(""),[error,setError]=useState(""),[reload,setReload]=useState(0),[now,setNow]=useState(0);
  useEffect(()=>{let live=true;Promise.all([api<{records:Entry[]}>("/api/records?kind=chronik&view=sl"),api<{records:Entry[]}>("/api/records?kind=sitzungen&view=sl")]).then(([c,s])=>{if(!live)return;setNow(Date.now());setEntries(c.records.sort((x,y)=>(when(y)||0)-(when(x)||0)));setSessions(s.records);}).catch(e=>{if(live)setError((e as Error).message);});return()=>{live=false;};},[reload]);
  const past=sessions.filter(s=>Number.isFinite(when(s))&&when(s)<=now).sort((x,y)=>when(y)-when(x));
  function open(next:Draft){setStatus("");setEditorKey(k=>k+1);setDraft(next);}
  function edit(e:Entry){open({id:e.id,version:e.version,kind:isRecap(e)?"rueckblick":"chronik",title:e.title,sessionId:String(e.body.sessionId||""),date:String(e.body.date||"").slice(0,10),text:String(e.body.text||""),released:e.visibility==="group",base:e.body as Record<string,unknown>});}
  function close(){setDraft(null);setStatus("");}
  async function save(release:boolean){
    if(!draft)return;
    if(!draft.title.trim()){setStatus("Bitte einen Titel eingeben.");return;}
    setBusy(true);setStatus("");
    try{
      // Older Chronik entries keep their other fields (summary, source …); only kind, date and text change here.
      const body={...draft.base,type:draft.kind==="rueckblick"?"rueckblick":"ereignis",sessionId:draft.kind==="rueckblick"?(draft.sessionId||undefined):undefined,date:draft.date,text:draft.text};
      const res=await api<{id:string;version:number}>("/api/records","POST",{...(draft.id?{id:draft.id,version:draft.version}:{}),kind:"chronik",title:draft.title.trim(),visibility:release?"group":"sl",body});
      setDraft({...draft,id:res.id,version:res.version,released:release,base:body});
      setStatus(release?(draft.kind==="rueckblick"?"Freigegeben: Die Runde sieht den Rückblick auf der Zuflucht, unter „Rückblicke“ und in der Chronik.":"Freigegeben: Der Eintrag steht jetzt in der Chronik."):"Als Entwurf gespeichert. Nur du siehst ihn.");
      setReload(n=>n+1);
    }catch(e){setStatus((e as Error).message);}
    finally{setBusy(false);}
  }
  if(error)return <p role="alert" className="error-box">{error}</p>;
  if(!entries)return <p role="status">Rückblicke und Chronik werden geladen …</p>;
  const shown=entries.filter(e=>filter==="alle"||(filter==="rueckblick")===isRecap(e));
  return <div className={styles.desk}>
    <header className={styles.head}><div><h1>Rückblicke & Chronik</h1><p><strong>Rückblicke</strong> erzählen, was am Spielabend geschah: Sie stehen auf der Zuflucht, unter „Rückblicke“ und in der Chronik. <strong>Chronik-Einträge</strong> halten Ereignisse der Domäne fest und stehen nur im Zeitstrahl der Chronik.</p></div>
      {draft?<button type="button" className="button" onClick={close}>← Zurück zur Übersicht</button>:<div className={styles.newButtons}><button type="button" className="button primary" onClick={()=>open(empty("rueckblick"))}><Plus size={16}/>Neuer Rückblick</button><button type="button" className="button" onClick={()=>open(empty("chronik"))}><Plus size={16}/>Neuer Chronik-Eintrag</button></div>}</header>
    {draft?<section className={styles.editor} aria-label={kindLabel[draft.kind]+" bearbeiten"}>
        <div className={styles.kindSwitch} role="radiogroup" aria-label="Art">{(["rueckblick","chronik"] as const).map(k=><button key={k} type="button" role="radio" aria-checked={draft.kind===k} disabled={busy} onClick={()=>setDraft({...draft,kind:k})}>{kindLabel[k]}</button>)}</div>
        <label className={styles.field}><span>Titel</span><input value={draft.title} maxLength={200} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder={draft.kind==="rueckblick"?"Die Nacht am Hafen":"Der Prinz ruft zur Versammlung"}/></label>
        <div className={styles.row}>
          {draft.kind==="rueckblick"?<label className={styles.field}><span>Spielabend</span><select value={draft.sessionId} onChange={e=>{const s=past.find(x=>x.id===e.target.value);setDraft({...draft,sessionId:e.target.value,date:s?new Date(when(s)).toISOString().slice(0,10):draft.date,title:draft.title||(s?"Rückblick: "+s.title:"")});}}><option value="">Ohne Bezug</option>{past.map(s=><option key={s.id} value={s.id}>{s.title} · {new Date(when(s)).toLocaleDateString("de-DE")}</option>)}</select></label>:<p className={styles.empty}>Ein Ereignis der Domäne, unabhängig von einem Spielabend.</p>}
          <label className={styles.field}><span>Datum{draft.kind==="chronik"?" im Zeitstrahl":""}</span><input type="date" value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></label>
        </div>
        <div className={styles.split}><div><RichTextEditor key={editorKey} value={draft.text} onChange={v=>setDraft({...draft,text:v})} label={kindLabel[draft.kind]} placeholder={draft.kind==="rueckblick"?"Was ist passiert? Wer war dabei? Welche Fragen bleiben?":"Was geschah in der Domäne?"} maximumPlainLength={20000} disabled={busy}/></div><aside className={styles.preview} aria-label="So sieht es die Runde"><span>So sieht es die Runde</span>{draft.text.trim()?<RichTextView value={draft.text} readable/>:<p className={styles.empty}>Noch leer.</p>}</aside></div>
        <footer className={styles.actions}><button type="button" className="button" disabled={busy} onClick={()=>void save(false)}>{draft.released?<EyeOff size={16}/>:<Save size={16}/>}{draft.released?"Zurück auf Entwurf":"Als Entwurf speichern"}</button><button type="button" className="button primary" disabled={busy} onClick={()=>void save(true)}><Eye size={16}/>{draft.released?"Änderungen freigeben":"Für die Runde freigeben"}</button><span role="status">{status}</span></footer>
      </section>:<>
      <div className={styles.kindSwitch} role="tablist" aria-label="Filter">{(["alle","rueckblick","chronik"] as const).map(k=><button key={k} type="button" role="tab" aria-selected={filter===k} onClick={()=>setFilter(k)}>{k==="alle"?"Alle":k==="rueckblick"?"Rückblicke":"Chronik-Einträge"}</button>)}</div>
      <ul className={styles.overview} aria-label="Rückblicke und Chronik">{shown.length?shown.map(r=><li key={r.id}><button type="button" onClick={()=>edit(r)}><span className={styles.tags}><span className={styles.badge} data-kind={isRecap(r)?"rueckblick":"chronik"}>{isRecap(r)?"Rückblick":"Chronik"}</span><span className={styles.badge} data-released={r.visibility==="group"||undefined}>{r.visibility==="group"?"freigegeben":"Entwurf"}</span></span><strong>{r.title}</strong><small>{Number.isFinite(when(r))?new Date(when(r)).toLocaleDateString("de-DE",{dateStyle:"long"}):"Ohne Datum"}</small></button></li>):<li className={styles.empty}>Noch nichts geschrieben. Leg oben rechts den ersten Eintrag an.</li>}</ul>
      </>}
  </div>;
}
