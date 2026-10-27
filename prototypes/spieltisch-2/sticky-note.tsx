import React,{useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {GripVertical,LockKeyhole,Users,PenLine,Trash2,Check,X,Eye,EyeOff} from 'lucide-react';
import type {NoteObject,Viewer} from './types';
import styles from './stage.module.css';

export const noteAuthor=(viewer:Viewer)=>viewer==='gm'?'Spielleitung':'Spieler '+viewer.toUpperCase();
export function StickyNote({note,viewer,busy,editing,onEdit,onFinish,onAction,onStart,onMove,onEnd,onCancel,onKey}:{
  note:NoteObject;viewer:Viewer;busy:boolean;editing:boolean;onEdit:()=>void;onFinish:()=>void;
  onAction:(body:Record<string,unknown>,message?:string)=>Promise<boolean>;
  onStart:(event:ReactPointerEvent<HTMLElement>)=>void;onMove:(event:ReactPointerEvent<HTMLElement>)=>void;
  onEnd:(event:ReactPointerEvent<HTMLElement>)=>void;onCancel:()=>void;onKey:(event:React.KeyboardEvent<HTMLButtonElement>)=>void;
}){
  const owner=note.ownerId===viewer;
  const [draft,setDraft]=useState(note.content),[baseRevision,setBaseRevision]=useState(note.revision),[deleting,setDeleting]=useState(false);
  const text=useRef<HTMLTextAreaElement>(null),editTrigger=useRef<HTMLButtonElement>(null),wasEditing=useRef(false);
  useEffect(()=>{if(editing){setDraft(note.content);setBaseRevision(note.revision);setDeleting(false);text.current?.focus();}else if(wasEditing.current)editTrigger.current?.focus();wasEditing.current=editing;},[editing]); // Draft is not replaced by polling.
  function finish(){onFinish();}
  async function save(){if(await onAction({action:'edit',id:note.id,content:draft,expectedRevision:baseRevision},'Notizzettel gespeichert.'))finish();}
  return <article className={styles.stickyPaper} aria-label={'Notizzettel von '+noteAuthor(note.ownerId)}>
    {owner?<button className={styles.stickyGrip} aria-label="Notizzettel verschieben" disabled={busy||editing} onPointerDown={onStart} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onCancel} onKeyDown={onKey}><GripVertical size={15}/><span>{note.visibility==='private'?<LockKeyhole size={13}/>:<Users size={13}/>} {note.visibility==='private'?'Privat · du & SL':'Gruppe'}</span><small>Du</small></button>:<div className={styles.stickyGrip}>{note.visibility==='private'?<LockKeyhole size={14}/>:<Users size={14}/>}<span>{note.visibility==='private'?'Privat · SL-Einsicht':'Gruppe'}</span><small>{noteAuthor(note.ownerId)}</small></div>}
    {editing&&owner?<><label className={styles.stickyEditor}><span className={styles.sr}>Notiztext</span><textarea ref={text} disabled={busy} aria-label="Notiztext" maxLength={3000} value={draft} placeholder="Dein Gedanke …" onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();e.preventDefault();finish();}if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();void save();}}}/><small>{draft.length} / 3000</small></label><footer className={styles.stickyActions}><button disabled={busy} onClick={()=>void save()}><Check size={15}/> Speichern</button><button disabled={busy} onClick={finish}><X size={15}/> Abbrechen</button></footer></>:<><div className={styles.stickyText}>{note.content||<span className={styles.stickyEmpty}>{owner?'Ein Gedanke, ein Name, eine Spur …':'Noch kein Text.'}</span>}</div>{owner&&(deleting?<footer className={styles.stickyActions} aria-label="Notizzettel löschen bestätigen"><span>Zettel löschen?</span><button disabled={busy} onClick={()=>void onAction({action:'remove',id:note.id,expectedRevision:note.revision},'Notizzettel gelöscht.')}><Trash2 size={15}/> Löschen</button><button disabled={busy} onClick={()=>setDeleting(false)} aria-label="Löschen abbrechen"><X size={16}/></button></footer>:<footer className={styles.stickyActions}><button ref={editTrigger} disabled={busy} onClick={onEdit} aria-label="Notizzettel bearbeiten" title="Bearbeiten"><PenLine size={16}/></button><button disabled={busy} onClick={()=>void onAction({action:'visibility',id:note.id,visibility:note.visibility==='private'?'group':'private',expectedRevision:note.revision},note.visibility==='private'?'Notizzettel ausdrücklich für die Gruppe freigegeben.':'Notizzettel wieder privat.')} aria-label={note.visibility==='private'?'Für Gruppe freigeben':'Wieder privat'}>{note.visibility==='private'?<Eye size={15}/>:<EyeOff size={15}/>} {note.visibility==='private'?'Teilen':'Privat'}</button><button disabled={busy} onClick={()=>setDeleting(true)} aria-label="Notizzettel löschen" title="Löschen"><Trash2 size={16}/></button></footer>)}</>}
  </article>;
}
