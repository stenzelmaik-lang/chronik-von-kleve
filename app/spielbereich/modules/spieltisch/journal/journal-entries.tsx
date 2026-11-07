'use client';
import type {CharacterCompanionNote,CharacterUnboundNote} from '../../character';
import {RichTextEditor,RichTextView,type EditorTools} from '../../rich-text';
import {formatPlayDate,draftDirty,draftProblem,plainText,type JournalDraft,type JournalKind} from '@/domain/journal';
import {JournalIcon,WaxSeal,type JournalIconName} from './journal-controls';
import styles from './journal.module.css';

export type SaveState={kind:'idle'}|{kind:'saving'}|{kind:'saved';at:string}|{kind:'error';message:string;conflict?:boolean};
const labels:Record<JournalKind,{list:string;intro:string;empty:string;new:string;editor:string;placeholder:string}>={
 note:{list:'Meine Notizen',intro:'Kurze Mitschriften, Namen und Beobachtungen. Nur du liest sie.',empty:'Noch keine Notizen zu dieser Figur.',new:'Neue Notiz',editor:'Notiz',placeholder:'Namen, Beobachtungen, offene Fragen …'},
 chronicle:{list:'Chronik',intro:'Deine datierte Folge der Ereignisse: Begegnungen, Entdeckungen, Entscheidungen. Nur du liest sie.',empty:'Noch keine Chronikeinträge zu dieser Figur.',new:'Neuer Chronikeintrag',editor:'Chronikeintrag',placeholder:'Was ist geschehen? Wen hast du getroffen?'},
};
const excerpt=(value:string)=>{const t=plainText(value).replace(/\s+/g,' ').trim();return t.length>110?t.slice(0,110)+'…':t;};
const time=(iso:string)=>{try{return new Date(iso).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'});}catch{return iso;}};

/** The slim quill strip: five ink marks, the active ones underlined in gold. */
function QuillBar({command,preserveSelection,formats,label}:EditorTools){
 const tool=(icon:JournalIconName,name:string,active:boolean,run:()=>void)=><button type="button" className={styles.quillTool} aria-label={name} title={name} aria-pressed={active} onMouseDown={e=>preserveSelection(e)} onClick={run}><JournalIcon name={icon} size={17}/></button>;
 return <div className={styles.quillBar} role="toolbar" aria-label={label+' formatieren'}>
  {tool('heading','Zwischenüberschrift',formats.heading,()=>command('formatBlock',formats.heading?'<p>':'<h3>'))}
  <i aria-hidden/>
  {tool('bold','Fett',formats.bold,()=>command('bold'))}
  {tool('italic','Kursiv',formats.italic,()=>command('italic'))}
  {tool('underline','Unterstrichen',formats.underline,()=>command('underline'))}
  <i aria-hidden/>
  {tool('list','Aufzählung',formats.list,()=>command('insertUnorderedList'))}
 </div>;
}

/** Left page: the list of entries of one kind; the open draft is marked. */
export function EntryList({kind,entries,unbound,selectedId,draft,disabled,onSelect,onNew,onOtherKind}:{kind:JournalKind;entries:CharacterCompanionNote[];unbound?:CharacterUnboundNote[];selectedId:string;draft:JournalDraft|undefined;disabled:boolean;onSelect:(note:CharacterCompanionNote)=>void;onNew:()=>void;onOtherKind:()=>void}){
 const l=labels[kind];
 return <div className={styles.entries}>
  <nav className={styles.subNav} aria-label="Chronikregister">
   <button type="button" aria-current={kind==='note'?'page':undefined} onClick={kind==='note'?undefined:onOtherKind}>Meine Notizen</button>
   <span aria-hidden>◆</span>
   <button type="button" aria-current={kind==='chronicle'?'page':undefined} onClick={kind==='chronicle'?undefined:onOtherKind}>Chronik</button>
  </nav>
  <h2 className={styles.pageTitle}>{l.list}</h2>
  <p className={styles.intro}>{l.intro}</p>
  <button type="button" className={styles.inkAction} disabled={disabled} onClick={onNew}><JournalIcon name="quill" size={18}/><span>{l.new}</span></button>
  {draft&&!draft.noteId&&draftDirty(draft)&&<p className={styles.draftMark}>Ungespeicherter neuer Eintrag{draft.title?': '+draft.title:''}</p>}
  {entries.length?<ol className={styles.entryList}>{entries.map(n=><li key={n.id}><button type="button" aria-current={selectedId===n.id||undefined} onClick={()=>onSelect(n)}>
   {kind==='chronicle'&&<time>{formatPlayDate(n.playDate)}</time>}
   <strong>{n.title&&n.title!=='Charakternotiz'?n.title:'Ohne Überschrift'}{draft?.noteId===n.id&&draftDirty(draft)?<em> · Entwurf offen</em>:null}</strong>
   <span>{excerpt(n.text)}</span>
  </button></li>)}</ol>:<p className={styles.empty}>{l.empty}</p>}
  {kind==='note'&&!!unbound?.length&&<details className={styles.unbound}><summary>Notizen ohne Figur ({unbound.length})</summary><p className={styles.hint}>Ältere eigene Notizen ohne Figurenbindung. Hier nur zum Nachlesen; sie bleiben, wo sie angelegt wurden.</p>{unbound.map(n=><article key={n.id}><h4>{n.title||'Notiz'}</h4><RichTextView value={n.text}/><small>Geändert {time(n.updatedAt)}</small></article>)}</details>}
 </div>;
}

/** Right page: the editor. The draft carries its own character; saving never uses the currently active one. */
export function EntryEditor({kind,draft,activeCharacterId,state,busy,onChange,onSave,onDiscard,onSaveAsNew,onReloadSaved}:{kind:JournalKind;draft:JournalDraft|undefined;activeCharacterId:string|null;state:SaveState;busy:boolean;onChange:(d:JournalDraft)=>void;onSave:()=>void;onDiscard:()=>void;onSaveAsNew:()=>void;onReloadSaved:()=>void}){
 const l=labels[kind];
 if(!draft)return <div className={styles.entries}><p className={styles.folio}>{l.editor}</p><p className={styles.emptyEditor}><JournalIcon name="quill" size={28}/><span>Wähle links einen Eintrag oder beginne einen neuen.</span></p></div>;
 const dirty=draftDirty(draft),problem=draftProblem(draft),foreign=!!activeCharacterId&&draft.characterId!==activeCharacterId;
 const id='journal-'+kind;
 const sealState=state.kind==='saving'?'saving':state.kind==='error'?'error':dirty?'dirty':state.kind==='saved'?'saved':'idle';
 const status=state.kind==='saving'?'Wird gesiegelt …':state.kind==='error'?'Nicht gespeichert':dirty?'Ungespeichert':state.kind==='saved'?'Gespeichert '+time(state.at):draft.noteId?'Gespeichert':'Noch leer';
 return <form className={styles.editor} onSubmit={e=>{e.preventDefault();if(!problem)onSave();}}>
  <div className={styles.editorBar}>
   <div><p className={styles.folio}>{draft.noteId?l.editor:l.new}</p><span className={styles.saveState} role="status" data-state={sealState}>{status}</span></div>
   <WaxSeal label="Speichern" state={sealState} disabled={busy||!dirty||!!problem} title={problem||(dirty?'Eintrag speichern':'Nichts zu speichern')}/>
  </div>
  {foreign&&<p className={styles.warning} role="note">Dieser Entwurf gehört zu <b>{draft.characterName||'deiner vorherigen Figur'}</b>. Speichern legt ihn dort ab, nicht bei der jetzt aktiven Figur.</p>}
  {state.kind==='error'&&<div className={styles.error} role="alert"><p>{state.message} Dein Entwurf bleibt erhalten.</p>{state.conflict&&<div><button type="button" className={styles.inkButton} disabled={busy} onClick={onSaveAsNew}>Als neuen Eintrag speichern</button><button type="button" className={styles.inkButton} disabled={busy} onClick={onReloadSaved}>Gespeicherte Fassung laden</button></div>}</div>}
  <label className={styles.line}><span>Überschrift</span><input id={id+'-title'} maxLength={120} value={draft.title} placeholder={kind==='chronicle'?'z. B. Begegnung im Hafen':'z. B. Namen aus der Bar'} onChange={e=>onChange({...draft,title:e.target.value})}/></label>
  {kind==='chronicle'&&<label className={styles.line}><span>Spieldatum</span><input id={id+'-date'} type="date" required value={draft.playDate} onChange={e=>onChange({...draft,playDate:e.target.value})}/><small>Datum in der Geschichte, unabhängig vom Speicherzeitpunkt.</small></label>}
  <div className={styles.text}><RichTextEditor key={draft.characterId+':'+(draft.noteId||'new')} label={l.editor+' – Text'} value={draft.text} onChange={text=>onChange({...draft,text})} maximumPlainLength={20000} placeholder={l.placeholder} compactTools proseClassName={styles.prose} disabled={busy} toolbar={QuillBar} quietFooter/></div>
  <div className={styles.editorFoot}>
   {problem&&dirty&&<small>{problem}</small>}
   <button type="button" className={styles.inkButton} data-quiet disabled={busy} onClick={onDiscard}>{dirty?'Entwurf verwerfen':'Schließen'}</button>
  </div>
 </form>;
}
