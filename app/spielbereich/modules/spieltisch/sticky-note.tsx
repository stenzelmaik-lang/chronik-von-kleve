import React,{useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {GripVertical,PenLine,Trash2,Check,X,Eye,EyeOff} from 'lucide-react';
import type {NoteObject,Viewer} from './types';
import {noteColors} from '@/domain/live-stage';

const colorNames:Record<typeof noteColors[number],string>={gelb:'Gelb',rosa:'Rosa',blau:'Blau',gruen:'Grün',orange:'Orange',lila:'Lila'};
import styles from './stage.module.css';

export const noteAuthor=(name:string)=>name;
export function StickyNote({note,viewer,busy,editing,onEdit,onFinish,onAction,onStart,onMove,onEnd,onCancel,onKey}:{
  note:NoteObject;viewer:Viewer;busy:boolean;editing:boolean;onEdit:()=>void;onFinish:()=>void;
  onAction:(body:Record<string,unknown>,message?:string)=>Promise<boolean>;
  onStart:(event:ReactPointerEvent<HTMLElement>)=>void;onMove:(event:ReactPointerEvent<HTMLElement>)=>void;
  onEnd:(event:ReactPointerEvent<HTMLElement>)=>void;onCancel:()=>void;onKey:(event:React.KeyboardEvent<HTMLButtonElement>)=>void;
}){
  const owner=note.ownerId===viewer;
  const [draft,setDraft]=useState(note.content),[baseRevision,setBaseRevision]=useState(note.revision),[deleting,setDeleting]=useState(false);
  const text=useRef<HTMLTextAreaElement>(null),editTrigger=useRef<HTMLButtonElement>(null),wasEditing=useRef(false);
  useEffect(()=>{if(editing){text.current?.focus();}else if(wasEditing.current)editTrigger.current?.focus();wasEditing.current=editing;},[editing]); // Draft is not replaced by polling.
  function finish(){onFinish();}
  async function save(){if(await onAction({action:'edit',id:note.id,content:draft,expectedRevision:baseRevision},'Notizzettel gespeichert.'))finish();}
  const shared=note.visibility==='group';
  const toggleShare=()=>void onAction({action:'visibility',id:note.id,visibility:shared?'private':'group',expectedRevision:note.revision},shared?'Notizzettel wieder privat.':'Notizzettel für alle sichtbar.');
  // Saved note: only text, plus a pen and an eye at the top. Colour, delete, save live in the editing mode.
  return <article className={styles.stickyPaper} data-color={note.color??'gelb'} data-editing={editing||undefined} aria-label={'Notizzettel von '+note.ownerName}>
    <div className={styles.stickyTop}>
      {owner?<button className={styles.stickyGrip} aria-label="Notizzettel verschieben" disabled={busy||editing} onPointerDown={onStart} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onCancel} onKeyDown={onKey}><GripVertical size={14}/></button>:<small className={styles.stickyOwner}>{note.ownerName}</small>}
      {owner&&!editing&&<span className={styles.stickyTools}>
        <button ref={editTrigger} type="button" disabled={busy} onClick={()=>{setDraft(note.content);setBaseRevision(note.revision);setDeleting(false);onEdit();}} aria-label="Notizzettel bearbeiten" title="Bearbeiten"><PenLine size={15}/></button>
        <button type="button" disabled={busy} onClick={toggleShare} aria-pressed={shared} aria-label={shared?'Für alle sichtbar – wieder privat machen':'Privat – für alle sichtbar machen'} title={shared?'Für alle sichtbar':'Privat (du und SL)'}>{shared?<Eye size={15}/>:<EyeOff size={15}/>}</button>
      </span>}
      {!owner&&(shared?<Eye size={14} aria-label="Für alle sichtbar"/>:<EyeOff size={14} aria-label="Privat"/>)}
    </div>
    {editing&&owner?<>
      <label className={styles.stickyEditor}><span className={styles.sr}>Notiztext</span><textarea ref={text} disabled={busy} aria-label="Notiztext" maxLength={3000} value={draft} placeholder="Dein Gedanke …" onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();e.preventDefault();finish();}if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();void save();}}}/><small>{draft.length} / 3000</small></label>
      <footer className={styles.stickyActions}>
        <span className={styles.stickyColors} role="group" aria-label="Farbe des Zettels">{noteColors.map(c=><button key={c} type="button" className={styles.stickySwatch} data-color={c} aria-pressed={(note.color??'gelb')===c} aria-label={'Farbe '+colorNames[c]} title={colorNames[c]} disabled={busy} onClick={()=>{if((note.color??'gelb')!==c)void onAction({action:'color',id:note.id,color:c,expectedRevision:note.revision}).then(ok=>{if(ok)setBaseRevision(r=>r+1);});}}/>)}</span>
        {deleting?<><button type="button" disabled={busy} onClick={()=>void onAction({action:'remove',id:note.id,expectedRevision:note.revision},'Notizzettel gelöscht.')}><Trash2 size={15}/> Löschen</button><button type="button" disabled={busy} onClick={()=>setDeleting(false)} aria-label="Löschen abbrechen"><X size={15}/></button></>
        :<><button type="button" disabled={busy} onClick={()=>setDeleting(true)} aria-label="Notizzettel löschen" title="Löschen"><Trash2 size={15}/></button><button type="button" disabled={busy} onClick={()=>void save()}><Check size={15}/> Speichern</button><button type="button" disabled={busy} onClick={finish} aria-label="Abbrechen"><X size={15}/></button></>}
      </footer>
    </>:<div className={styles.stickyText}>{note.content||<span className={styles.stickyEmpty}>{owner?'Ein Gedanke, ein Name, eine Spur …':'Noch kein Text.'}</span>}</div>}
  </article>;
}
