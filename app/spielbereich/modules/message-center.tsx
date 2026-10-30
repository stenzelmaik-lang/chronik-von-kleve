"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mail, Send, Feather, ArrowLeft, CheckCheck, Inbox as InboxIcon, Archive, ArchiveRestore, Trash2, RotateCcw, Reply, Forward, Paperclip, NotebookPen, MailOpen, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Actor } from "@/domain/types";
import { mailQuote, mailSubject, type MailAction, type MailBox, type MailFolder } from "@/domain/personal-message";
import { richTextToPlainText } from "@/domain/location-rich-text";
import { api } from "./api-client";
import {PersonalMessageBody,type PersonalMessageAttachment} from "./personal-message-body";
import styles from "./message-center.module.css";
type Message = {format?:"rich";attachments?:PersonalMessageAttachment[]; id:string;box:MailBox;folder:MailFolder;title:string;text?:string;snippet?:string;attachmentCount?:number;senderName:string;senderId?:string;recipientId:string;recipients?:{id:string;name:string}[];readAt:string|null;createdAt:string };
type Inbox = { messages:Message[];unread:number;next:string|null };
type Draft = { recipients:string[];title:string;text:string;files:PersonalMessageAttachment[];replyToId?:string;forwardOfId?:string };
const empty:Inbox={messages:[],unread:0,next:null};
const blankDraft=(recipients:string[]=[]):Draft=>({recipients,title:"",text:"",files:[]});
const folderNames:Record<MailFolder,string>={inbox:"Posteingang",sent:"Gesendet",archive:"Archiv",trash:"Papierkorb"};
const folderIcons={inbox:InboxIcon,sent:Send,archive:Archive,trash:Trash2};
const key=(m:Pick<Message,"box"|"id">)=>m.box+":"+m.id;
const UPLOAD_TYPES="image/*,application/pdf,audio/*,video/mp4,video/webm";

export function MessageCenter({ a,embedded=false,initialRecipient,showTrigger=true }: { a:Actor;embedded?:boolean;initialRecipient?:string;showTrigger?:boolean }) {
  const canSend=a.status==='active'&&['player','campaign_gm','campaign_owner'].includes(a.role);
  const folders:MailFolder[]=canSend?["inbox","sent","archive","trash"]:["inbox","archive","trash"];
  const [open,setOpen]=useState(embedded),[view,setView]=useState<MailFolder|"compose">(embedded&&initialRecipient&&canSend?"compose":"inbox");
  const [lists,setLists]=useState<Record<MailFolder,Inbox>>({inbox:empty,sent:empty,archive:empty,trash:empty}),[selected,setSelected]=useState<Message|null>(null);
  const [checked,setChecked]=useState<string[]>([]),[search,setSearch]=useState(""),[confirmRemove,setConfirmRemove]=useState(false);
  const [recipients,setRecipients]=useState<{id:string;name:string}[]>([]),[draft,setDraft]=useState<Draft>(blankDraft(initialRecipient?[initialRecipient]:[])),[myFiles,setMyFiles]=useState<PersonalMessageAttachment[]>([]);
  const [error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(false);
  const requestId=useRef<string|null>(null),opened=useRef(embedded);
  const [refreshTick,setRefreshTick]=useState(0);
  const folder:MailFolder=view==="compose"?"inbox":view,current=lists[folder];
  const edit=(patch:Partial<Draft>)=>{setDraft(d=>({...d,...patch}));requestId.current=null;};

  const applyFolder=useCallback((target:MailFolder,data:Inbox)=>{
    setLists(all=>{
      const old=all[target];
      // Keep pages loaded via "Ältere laden"; the fresh first page wins for everything it covers.
      const oldest=data.messages.at(-1)?.createdAt,tail=data.next&&oldest?old.messages.filter(m=>m.createdAt<oldest&&!data.messages.some(n=>key(n)===key(m))):[];
      return {...all,inbox:{...all.inbox,unread:data.unread},[target]:{...data,messages:[...data.messages,...tail],next:tail.length?old.next:data.next}};
    });
  },[]);
  const loadFolder=useCallback(async(target:MailFolder)=>applyFolder(target,await api<Inbox>("/api/messages?folder="+target)),[applyFolder]);
  useEffect(()=>{
    let live=true,running=false;
    const load=async()=>{if(running)return;running=true;try{await loadFolder("inbox");}catch(e){if(live){setError((e as Error).message);setLists({inbox:empty,sent:empty,archive:empty,trash:empty});setSelected(null);}}finally{running=false;}};
    void load();const timer=embedded?null:window.setInterval(()=>{if(document.visibilityState==="visible")void load();},2500);window.addEventListener("focus",load);
    const compose=(event:Event)=>{if(!canSend)return;const recipient=(event as CustomEvent<string|string[]>).detail;setDraft(blankDraft(Array.isArray(recipient)?recipient:recipient?[recipient]:[]));requestId.current=null;setSelected(null);setView("compose");setOpen(true);opened.current=true;};
    window.addEventListener("chroniplay:compose-message",compose);
    const showInbox=()=>{if(embedded)return;setSelected(null);setView('inbox');setOpen(true);opened.current=true;void load();};
    window.addEventListener('chroniplay:open-inbox',showInbox);
    return()=>{live=false;if(timer!==null)window.clearInterval(timer);window.removeEventListener("focus",load);window.removeEventListener("chroniplay:compose-message",compose);window.removeEventListener('chroniplay:open-inbox',showInbox);};
  },[a.id,a.campaignId,canSend,embedded,refreshTick,loadFolder]);
  useEffect(()=>{
    if(!open)return;let live=true;
    if(canSend)api<{recipients:{id:string;name:string}[]}>("/api/messages?recipients=1").then(data=>{if(live)setRecipients(data.recipients);}).catch(e=>{if(live){setRecipients([]);setError(e.message);}});
    if(view!=="compose"&&view!=="inbox")api<Inbox>("/api/messages?folder="+view).then(data=>{if(live)applyFolder(view,data);}).catch(e=>{if(live)setError(e.message);});
    if(view==="compose")api<{files:(PersonalMessageAttachment&{owner_id:string})[]}>("/api/files").then(data=>{if(live)setMyFiles(data.files.filter(f=>f.owner_id===a.id).slice(0,100));}).catch(()=>{if(live)setMyFiles([]);});
    return()=>{live=false;};
  },[open,view,canSend,applyFolder,a.id]);

  function switchTo(next:MailFolder|"compose"){setView(next);setSelected(null);setChecked([]);setConfirmRemove(false);setError("");setNotice("");}
  async function read(message:Message){setBusy(true);setError("");setConfirmRemove(false);try{const data=await api<Inbox>("/api/messages?id="+encodeURIComponent(message.id)+(message.box==="out"?"&sent=1":""));setSelected(data.messages[0]);if(message.box==="in"&&!message.readAt){await api("/api/messages","PATCH",{action:"read",box:"in",ids:[message.id]});const now=new Date().toISOString();setLists(all=>({...all,inbox:{...all.inbox,unread:Math.max(0,all.inbox.unread-1)},[folder]:{...all[folder],messages:all[folder].messages.map(m=>key(m)===key(message)?{...m,readAt:now}:m)}}));}}catch(e){setSelected(null);setError((e as Error).message);}finally{setBusy(false);}}
  const done:Partial<Record<MailAction,string>>={archive:"archiviert",unarchive:"in den Posteingang zurückgelegt",trash:"in den Papierkorb gelegt",restore:"wiederhergestellt",remove:"aus deinem Postfach entfernt",read:"als gelesen markiert",unread:"als ungelesen markiert"};
  async function act(action:MailAction,items:Message[]){
    if(!items.length||busy)return;setBusy(true);setError("");setNotice("");
    try{
      for(const box of ["in","out"] as MailBox[]){const ids=items.filter(m=>m.box===box).map(m=>m.id);if(ids.length)await api("/api/messages","PATCH",{action,box,ids});}
      const keys=items.map(key),moves=action!=="read"&&action!=="unread",now=new Date().toISOString();
      setLists(all=>({...all,[folder]:{...all[folder],messages:moves?all[folder].messages.filter(m=>!keys.includes(key(m))):all[folder].messages.map(m=>keys.includes(key(m))?{...m,readAt:action==="read"?m.readAt||now:null}:m)}}));
      if(moves||action==="unread")setSelected(s=>s&&keys.includes(key(s))?null:s);
      setChecked([]);setConfirmRemove(false);
      setNotice(`${items.length===1?"Brief":items.length+" Briefe"} ${done[action]}.${action==="remove"?" Andere Beteiligte behalten ihre Kopie.":""}`);
      await loadFolder("inbox");
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function keep(message:Message){setBusy(true);setError("");setNotice("");try{const r=await api<{noteId:string;existing:boolean}>("/api/messages","PATCH",{action:"to-notes",box:message.box,id:message.id});setNotice(r.existing?"Dieser Brief liegt bereits in „Meine Notizen“.":"Brief in „Meine Notizen“ übernommen. Dort kannst du ihn ergänzen und bearbeiten.");}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  function reply(message:Message){if(!message.senderId)return;setDraft({recipients:[message.senderId],title:mailSubject(message.title,"reply"),text:mailQuote(plainText(message),message,"reply"),files:[],replyToId:message.id});requestId.current=null;switchTo("compose");}
  function forward(message:Message){
    const files=(message.attachments||[]).filter(f=>f.forwardable),held=(message.attachments||[]).length-files.length;
    setDraft({recipients:[],title:mailSubject(message.title,"forward"),text:mailQuote(plainText(message),message,"forward"),files:files.map(({id,name,mime})=>({id,name,mime})),forwardOfId:message.id});requestId.current=null;switchTo("compose");
    if(held)setNotice(`${held} ${held===1?"Anhang bleibt":"Anhänge bleiben"} beim ursprünglichen Brief: Unterlagen der Spielleitung werden nicht weitergegeben.`);
  }
  async function upload(list:FileList|null){
    if(!list?.length)return;setUploading(true);setError("");
    try{for(const file of Array.from(list).slice(0,20-draft.files.length)){if(file.size>10*1024*1024)throw new Error(`${file.name}: Bitte maximal 10 MB je Datei.`);const form=new FormData();form.set("file",file);form.set("visibility","private");const r=await api<{id:string}>("/api/files","POST",form);setDraft(d=>({...d,files:[...d.files,{id:r.id,name:file.name,mime:file.type}]}));requestId.current=null;}}
    catch(e){setError((e as Error).message);}finally{setUploading(false);}
  }
  async function send(){if(busy)return;setBusy(true);setError("");setNotice("");requestId.current ||= crypto.randomUUID();try{const result=await api<{sent:number}>("/api/messages","POST",{clientRequestId:requestId.current,recipients:draft.recipients,title:draft.title,text:draft.text,...(draft.files.length?{fileIds:draft.files.map(f=>f.id)}:{}),...(draft.replyToId?{replyToId:draft.replyToId}:{}),...(draft.forwardOfId?{forwardOfId:draft.forwardOfId}:{})});setNotice(`Nachricht an ${result.sent} ${result.sent===1?"Person":"Personen"} dauerhaft zugestellt.`);setDraft(blankDraft());requestId.current=null;setView("sent");setSelected(null);void loadFolder("sent");}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function more(){if(!current.next)return;setBusy(true);try{const next=await api<Inbox>("/api/messages?folder="+folder+"&before="+encodeURIComponent(current.next));setLists(all=>({...all,[folder]:{...next,messages:[...all[folder].messages,...next.messages.filter(m=>!all[folder].messages.some(n=>key(n)===key(m)))]}}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}

  const needle=search.trim().toLowerCase();
  const messages=current.messages.filter(m=>!needle||[m.title,m.senderName,m.snippet,...(m.recipients||[]).map(r=>r.name)].some(v=>v?.toLowerCase().includes(needle)));
  const picked=messages.filter(m=>checked.includes(key(m)));
  const party=(m:Message)=>m.box==="out"?"An: "+((m.recipients||[]).map(r=>r.name).join(", ")||recipients.find(r=>r.id===m.recipientId)?.name||"Empfänger"):m.senderName;
  const bulk=(items:Message[])=>folder==="trash"?<><button onClick={()=>void act("restore",items)} disabled={busy}><RotateCcw size={15}/>Wiederherstellen</button></>:<>
    {folder==="archive"?<button onClick={()=>void act("unarchive",items)} disabled={busy}><ArchiveRestore size={15}/>Zurücklegen</button>:<button onClick={()=>void act("archive",items)} disabled={busy}><Archive size={15}/>Archivieren</button>}
    <button onClick={()=>void act("trash",items)} disabled={busy}><Trash2 size={15}/>Löschen</button>
    {items.some(m=>m.box==="in")&&<><button onClick={()=>void act("read",items.filter(m=>m.box==="in"))} disabled={busy}><MailOpen size={15}/>Gelesen</button><button onClick={()=>void act("unread",items.filter(m=>m.box==="in"))} disabled={busy}><Mail size={15}/>Ungelesen</button></>}</>;

  const reader=selected&&<article className={styles.letter} aria-label={"Brief: "+selected.title}>
    <button className={styles.back} onClick={()=>{setSelected(null);setConfirmRemove(false);}}><ArrowLeft size={15}/>Zurück zu {folderNames[folder]}</button>
    <div className={styles.actions} role="toolbar" aria-label="Brief bearbeiten">
      {selected.folder==="trash"?<><button onClick={()=>void act("restore",[selected])} disabled={busy}><RotateCcw size={15}/>Wiederherstellen</button><button className={styles.danger} onClick={()=>setConfirmRemove(true)} disabled={busy}><X size={15}/>Aus meinem Postfach entfernen</button></>:<>
        {canSend&&selected.box==="in"&&selected.senderId&&<button onClick={()=>reply(selected)}><Reply size={15}/>Antworten</button>}
        {canSend&&<button onClick={()=>forward(selected)}><Forward size={15}/>Weiterleiten</button>}
        {selected.folder==="archive"?<button onClick={()=>void act("unarchive",[selected])} disabled={busy}><ArchiveRestore size={15}/>Zurücklegen</button>:<button onClick={()=>void act("archive",[selected])} disabled={busy}><Archive size={15}/>Archivieren</button>}
        <button onClick={()=>void act("trash",[selected])} disabled={busy}><Trash2 size={15}/>Löschen</button>
        {selected.box==="in"&&<button onClick={()=>void act("unread",[selected])} disabled={busy}><Mail size={15}/>Als ungelesen</button>}</>}
      <button onClick={()=>void keep(selected)} disabled={busy}><NotebookPen size={15}/>In meine Notizen</button>
    </div>
    {confirmRemove&&<div className={styles.confirm} role="alertdialog" aria-label="Entfernen bestätigen"><p>Diesen Brief aus deinem Postfach entfernen? Er verschwindet nur bei dir. Andere Beteiligte behalten ihre Kopie, und eine Übernahme in „Meine Notizen“ bleibt erhalten.</p><div><button className={styles.danger} onClick={()=>void act("remove",[selected])} disabled={busy}>Endgültig aus meinem Postfach entfernen</button><button onClick={()=>setConfirmRemove(false)}>Abbrechen</button></div></div>}
    <p className="eyebrow">{selected.box==="out"?"Von dir · "+party(selected):selected.senderName} · {new Date(selected.createdAt).toLocaleString("de-DE")}</p><h3>{selected.title}</h3>
    {!!selected.attachments?.length&&<p className={styles.meta}><Paperclip size={14}/>{selected.attachments.length} {selected.attachments.length===1?"Anhang":"Anhänge"}</p>}
    <div className={styles.body}><PersonalMessageBody text={selected.text||""} format={selected.format} attachments={selected.attachments}/></div>
    <p className={styles.seal}><CheckCheck size={16}/>Persönlich zugestellt · Nur berechtigte Empfänger</p></article>;

  const list=<div className={styles.list}>
    <div className={styles.listTools}>
      <label className={styles.search}><Search size={15}/><input aria-label="Briefe durchsuchen" placeholder={`${folderNames[folder]} durchsuchen …`} value={search} onChange={e=>setSearch(e.target.value)}/></label>
      {!!messages.length&&<label className={styles.selectAll}><input type="checkbox" aria-label="Alle sichtbaren Briefe auswählen" checked={picked.length===messages.length} onChange={e=>setChecked(e.target.checked?messages.map(key):[])}/>Alle</label>}
    </div>
    {!!picked.length&&<div className={styles.actions} role="toolbar" aria-label="Ausgewählte Briefe"><span>{picked.length} ausgewählt</span>{bulk(picked)}</div>}
    {messages.length?messages.map(m=><div className={`${styles.row} ${selected&&key(selected)===key(m)?styles.active:""}`} key={key(m)}>
      <input type="checkbox" aria-label={"Auswählen: "+m.title} checked={checked.includes(key(m))} onChange={e=>setChecked(old=>e.target.checked?[...old,key(m)]:old.filter(k=>k!==key(m)))}/>
      <button disabled={busy} onClick={()=>void read(m)}><span className={!m.readAt&&m.box==="in"?styles.unread:styles.readDot} aria-label={!m.readAt&&m.box==="in"?"ungelesen":undefined}/><div><strong>{m.title}</strong><small>{party(m)}{(folder==="archive"||folder==="trash")&&m.box==="out"?" · gesendet":""}</small>{m.snippet&&<span className={styles.snippet}>{m.snippet}</span>}</div><span className={styles.rowMeta}><time>{new Date(m.createdAt).toLocaleDateString("de-DE")}</time>{!!m.attachmentCount&&<Paperclip size={14} aria-label={m.attachmentCount+" Anhänge"}/>}</span></button>
    </div>):<div className={styles.empty}><Mail size={35}/><h3>{needle?"Keine passenden Briefe":folder==="trash"?"Papierkorb ist leer":folder==="archive"?"Noch nichts archiviert":"Noch keine Briefe"}</h3><p>{needle?"Versuche einen anderen Suchbegriff.":folder==="sent"?"Verfasse eine persönliche Nachricht für deine Spielgruppe.":folder==="archive"?"Archivierte Briefe bleiben hier griffbereit und lassen sich jederzeit zurücklegen.":folder==="trash"?"Gelöschte Briefe landen zuerst hier und lassen sich wiederherstellen.":"Neue Nachrichten erscheinen hier und am Briefsymbol automatisch."}</p></div>}
    {current.next&&<button className="button" disabled={busy} onClick={()=>void more()}>Ältere Briefe laden</button>}
  </div>;

  const compose=<div className={styles.compose}>
    {(draft.replyToId||draft.forwardOfId)&&<p className={styles.meta}>{draft.replyToId?<><Reply size={14}/>Antwort auf einen Brief</>:<><Forward size={14}/>Weiterleitung</>}<button onClick={()=>{setDraft(blankDraft());requestId.current=null;}}>Verwerfen</button></p>}
    <fieldset><legend>Empfänger in dieser Kampagne</legend><div className={styles.recipients}>{recipients.map(r=><label key={r.id}><input type="checkbox" checked={draft.recipients.includes(r.id)} onChange={e=>edit({recipients:e.target.checked?[...draft.recipients,r.id]:draft.recipients.filter(id=>id!==r.id)})}/>{r.name}</label>)}</div>{!recipients.length&&<p>Keine aktiven Empfänger verfügbar.</p>}</fieldset>
    <label>Betreff<input aria-label="Nachrichtentitel" maxLength={160} value={draft.title} onChange={e=>edit({title:e.target.value})}/></label>
    <label>Deine persönliche Nachricht<textarea aria-label="Nachrichtentext" rows={9} maxLength={20000} value={draft.text} onChange={e=>edit({text:e.target.value})}/></label>
    <fieldset className={styles.attach}><legend>Anhänge · Bilder, PDF, Audio oder Video bis 10 MB</legend>
      {!!draft.files.length&&<ul className={styles.chips}>{draft.files.map(f=><li key={f.id}><Paperclip size={13}/><span>{f.name}</span><button aria-label={"Anhang entfernen: "+f.name} onClick={()=>edit({files:draft.files.filter(x=>x.id!==f.id)})}><X size={13}/></button></li>)}</ul>}
      <div className={styles.attachTools}>
        <label className="button"><Paperclip size={15}/>{uploading?"Wird hochgeladen …":"Datei anhängen"}<input className={styles.fileInput} type="file" multiple accept={UPLOAD_TYPES} aria-label="Datei anhängen" disabled={uploading||draft.files.length>=20} onChange={e=>{void upload(e.target.files);e.target.value="";}}/></label>
        {!!myFiles.length&&<select aria-label="Aus meinen Dateien anhängen" value="" onChange={e=>{const f=myFiles.find(x=>x.id===e.target.value);if(f&&!draft.files.some(x=>x.id===f.id))edit({files:[...draft.files,{id:f.id,name:f.name,mime:f.mime}]});}}><option value="">Aus meinen Dateien …</option>{myFiles.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>}
      </div>
    </fieldset>
    <footer><small>{draft.recipients.length} ausgewählte Empfänger · {draft.files.length} Anhänge · Keine Gruppenfreigabe</small><button className="button primary" disabled={busy||uploading||!draft.recipients.length||!draft.title.trim()||(!draft.text.trim()&&!draft.files.length)} onClick={()=>void send()}><Send size={16}/>{busy?"Wird zugestellt …":"Privat senden"}</button></footer>
  </div>;

  const content=<>
{embedded?<header className={styles.embeddedHeader}><h3>Briefe aus der Nacht</h3><p>Deine persönlichen Nachrichten. Fremde Gespräche bleiben privat.</p><button className="button" onClick={()=>setRefreshTick(n=>n+1)}>Nachrichten aktualisieren</button></header>:(<DialogHeader><DialogTitle className={styles.title}><Feather size={25}/>Briefe aus der Nacht</DialogTitle><DialogDescription>Persönliche Nachrichten. Archivieren und Löschen wirken nur in deinem eigenen Postfach.</DialogDescription></DialogHeader>)}
    <div className={styles.frame}><div className={styles.mail}>
      <nav className={styles.tabs} aria-label="Nachrichtenordner">
        {canSend&&<button className={styles.composeButton} aria-pressed={view==="compose"} onClick={()=>switchTo("compose")}><Feather size={15}/>Verfassen</button>}
        {folders.map(f=>{const Icon=folderIcons[f];return <button key={f} aria-pressed={view===f} onClick={()=>switchTo(f)}><Icon size={15}/>{folderNames[f]}{f==="inbox"&&lists.inbox.unread>0&&<b>{lists.inbox.unread}</b>}</button>;})}
      </nav>
      <div className={styles.pane}>
        {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.notice}>{notice}</p>}
        {view==="compose"&&canSend?compose:<div className={`${styles.split} ${selected?styles.reading:""}`}>{list}<div className={styles.reader}>{reader||<div className={styles.placeholder}><MailOpen size={30}/><p>Wähle links einen Brief aus.</p></div>}</div></div>}
      </div>
    </div></div>
  </>;
  return embedded?<section className={styles.embedded}>{content}</section>:<>{showTrigger&&<button className={styles.trigger} aria-label={lists.inbox.unread?`Nachrichten öffnen · ${lists.inbox.unread} ungelesen`:"Nachrichten öffnen"} title="Persönliche Nachrichten" onClick={()=>{setOpen(true);opened.current=true;setSelected(null);}}><Mail size={18}/><span>Nachrichten</span>{lists.inbox.unread>0&&<b aria-live="polite">{lists.inbox.unread}</b>}</button>}<Dialog open={open} onOpenChange={value=>{setOpen(value);opened.current=value;}}><DialogContent className={`!max-w-6xl ${styles.dialog}`}>{content}</DialogContent></Dialog></>;
}
function plainText(m:Message){return m.format==="rich"?richTextToPlainText(m.text||""):m.text||"";}
