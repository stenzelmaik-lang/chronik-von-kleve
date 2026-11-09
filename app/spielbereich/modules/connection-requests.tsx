"use client";
import {useEffect,useState} from "react";
import {Check,Link2,Send,Trash2,X} from "lucide-react";
import {api} from "./api-client";
import styles from "./connection-requests.module.css";

export type ConnectionRequest={id:string;targetId:string|null;targetName:string;note:string;status:string;answer:string;createdAt:string};
type Person={id:string;title:string;type:string};
const statusLabel:Record<string,string>={pending:"Bei der Spielleitung",approved:"Verbunden",rejected:"Abgelehnt"};

async function people(view:"player"|"sl"):Promise<Person[]>{
  const q=view==="sl"?"&view=sl":"";
  const [npc,chars]=await Promise.all([api<{entities:Person[]}>("/api/entities?type=NPC"+q).catch(()=>({entities:[]})),view==="sl"?api<{entities:Person[]}>("/api/entities?type=CHARACTER"+q).catch(()=>({entities:[]})):Promise.resolve({entities:[] as Person[]})]);
  return [...npc.entities,...chars.entities].sort((x,y)=>x.title.localeCompare(y.title,"de"));
}

/** Charakterprofil: the player asks the SL for a known connection (an NPC or another character). */
export function ConnectionRequestForm({characterId,version,requests,canRequest,blocked,onSaved}:{characterId:string;version:number;requests:ConnectionRequest[];canRequest:boolean;blocked?:string;onSaved:()=>void}){
  const [list,setList]=useState<Person[]>([]),[name,setName]=useState(""),[note,setNote]=useState(""),[busy,setBusy]=useState(false),[status,setStatus]=useState("");
  useEffect(()=>{if(!canRequest)return;let on=true;void people("player").then(p=>{if(on)setList(p);});return()=>{on=false;};},[canRequest]);
  async function send(){
    if(!name.trim())return;
    setBusy(true);setStatus("");
    const match=list.find(p=>p.title.toLowerCase()===name.trim().toLowerCase());
    try{await api("/api/character-companion","PATCH",{action:"connection.request",id:characterId,version,targetId:match?.id,targetName:name.trim(),note:note.trim()});setName("");setNote("");setStatus("Anfrage gesendet. Die Spielleitung entscheidet.");onSaved();}
    catch(e){setStatus((e as Error).message);}
    finally{setBusy(false);}
  }
  return <div className={styles.box}>
    {!!requests.length&&<ul className={styles.requests} aria-label="Deine Anfragen">{[...requests].reverse().map(r=><li key={r.id} data-status={r.status}><strong>{r.targetName}</strong><span>{statusLabel[r.status]||r.status}</span>{r.note&&<p>{r.note}</p>}{r.answer&&<p className={styles.answer}>SL: {r.answer}</p>}</li>)}</ul>}
    {canRequest&&<div className={styles.form}>
      <label><span>Wen kennt dein Charakter?</span><input list={"cp-people-"+characterId} value={name} maxLength={120} placeholder="Name einer Persönlichkeit oder eines Charakters" disabled={busy||!!blocked} onChange={e=>setName(e.target.value)}/><datalist id={"cp-people-"+characterId}>{list.map(p=><option key={p.id} value={p.title}/>)}</datalist></label>
      <label><span>Woher, und wie gut?</span><textarea rows={2} maxLength={600} value={note} placeholder="Zum Beispiel: alter Geschäftspartner, schuldet mir einen Gefallen" disabled={busy||!!blocked} onChange={e=>setNote(e.target.value)}/></label>
      <div className={styles.actions}><button type="button" className="button" disabled={busy||!name.trim()||!!blocked} onClick={()=>void send()}><Send size={15}/>Verbindung anfragen</button><span role="status">{blocked||status}</span></div>
    </div>}
  </div>;
}

type Detail={revision:{version:number};roleplay:{connectionRequests?:ConnectionRequest[]};companion?:{relationships:{id:string;targetId:string;name:string;visibility:string}[]}};

/** Regie: the SL decides on requests, links characters directly and removes connections. */
export function ConnectionDesk({characterId}:{characterId:string}){
  const [detail,setDetail]=useState<Detail|null>(null),[list,setList]=useState<Person[]>([]),[reload,setReload]=useState(0),[busy,setBusy]=useState(false),[status,setStatus]=useState("");
  const [pick,setPick]=useState<Record<string,string>>({}),[add,setAdd]=useState({targetId:"",note:"",visibility:"group"});
  useEffect(()=>{let on=true;api<Detail>("/api/character-detail?id="+encodeURIComponent(characterId)+"&view=sl").then(d=>{if(on)setDetail(d);}).catch(e=>{if(on)setStatus((e as Error).message);});return()=>{on=false;};},[characterId,reload]);
  useEffect(()=>{let on=true;void people("sl").then(p=>{if(on)setList(p.filter(x=>x.id!==characterId));});return()=>{on=false;};},[characterId]);
  async function run(fn:()=>Promise<unknown>,done:string){setBusy(true);setStatus("");try{await fn();setStatus(done);setReload(n=>n+1);}catch(e){setStatus((e as Error).message);}finally{setBusy(false);}}
  if(!detail)return <p className={styles.hint}>{status||"Verbindungen werden geladen …"}</p>;
  const pending=(detail.roleplay.connectionRequests||[]).filter(r=>r.status==="pending"),links=detail.companion?.relationships||[];
  const decide=(r:ConnectionRequest,decision:"approved"|"rejected")=>run(()=>api("/api/character-companion","PATCH",{action:"connection.decide",id:characterId,version:detail.revision.version,requestId:r.id,decision,targetId:decision==="approved"?(pick[r.id]||r.targetId||undefined):undefined,visibility:"group"}),decision==="approved"?"Verbunden.":"Abgelehnt.");
  const options=<>{list.map(p=><option key={p.id} value={p.id}>{p.title} · {p.type==="NPC"?"NSC":"Charakter"}</option>)}</>;
  return <div className={styles.box}>
    <h4><Link2 size={14}/> Anfragen</h4>
    {pending.length?<ul className={styles.requests}>{pending.map(r=><li key={r.id} data-status="pending"><strong>{r.targetName}</strong>{r.note&&<p>{r.note}</p>}
      <div className={styles.actions}><select aria-label={"Person für "+r.targetName} value={pick[r.id]??r.targetId??""} onChange={e=>setPick(p=>({...p,[r.id]:e.target.value}))}><option value="">Person wählen …</option>{options}</select>
        <button type="button" className="button" disabled={busy||!(pick[r.id]||r.targetId)} onClick={()=>void decide(r,"approved")}><Check size={14}/>Verbinden</button><button type="button" className="button" disabled={busy} onClick={()=>void decide(r,"rejected")}><X size={14}/>Ablehnen</button></div></li>)}</ul>:<p className={styles.hint}>Keine offenen Anfragen.</p>}
    <h4><Link2 size={14}/> Bekannte Verbindungen</h4>
    {links.length?<ul className={styles.links}>{links.map(l=><li key={l.id}><span>{l.name}</span><small>{l.visibility==="group"?"für Spieler sichtbar":"nur SL"}</small><button type="button" aria-label={"Verbindung zu "+l.name+" entfernen"} disabled={busy} onClick={()=>void run(()=>api("/api/relationships","DELETE",{id:l.id}),"Verbindung entfernt.")}><Trash2 size={14}/></button></li>)}</ul>:<p className={styles.hint}>Noch keine Verbindungen.</p>}
    <div className={styles.actions}><select aria-label="Neue Verbindung mit" value={add.targetId} onChange={e=>setAdd({...add,targetId:e.target.value})}><option value="">Direkt verbinden mit …</option>{options}</select><select aria-label="Sichtbarkeit" value={add.visibility} onChange={e=>setAdd({...add,visibility:e.target.value})}><option value="group">Für Spieler sichtbar</option><option value="sl">Nur SL</option></select><input aria-label="Notiz" placeholder="Notiz (optional)" maxLength={200} value={add.note} onChange={e=>setAdd({...add,note:e.target.value})}/><button type="button" className="button" disabled={busy||!add.targetId} onClick={()=>void run(()=>api("/api/relationships","POST",{sourceId:characterId,targetId:add.targetId,type:"related_to",visibility:add.visibility,...(add.note.trim()?{note:add.note.trim()}:{})}).then(()=>setAdd({targetId:"",note:"",visibility:"group"})),"Verbunden.")}><Link2 size={14}/>Verbinden</button></div>
    {status&&<p role="status" className={styles.hint}>{status}</p>}
  </div>;
}
