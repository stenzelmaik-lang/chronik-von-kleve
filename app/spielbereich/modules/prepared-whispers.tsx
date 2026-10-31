/* eslint-disable @next/next/no-img-element -- Authenticated SL previews use protected original images. */
"use client";
import {useState} from 'react';
import {CloudFog,Mail,Trash2,ArrowUp,ArrowDown,Eye,X} from 'lucide-react';
import type {SceneDocument,SceneWhisper} from '@/domain/story-scene';
import type {PreparationRecipient} from '@/domain/personal-message';
import {RichTextEditor,RichTextView} from './rich-text';
import {ProtectedImageGallery,type PreparationFile} from './protected-image-gallery';
import styles from './prepared-whispers.module.css';

export function PreparedWhispers({scene,players,files,onChange}:{scene:SceneDocument;players:PreparationRecipient[];files:PreparationFile[];onChange:(patch:Partial<SceneDocument>)=>void}){
 const [selected,setSelected]=useState(scene.whispers?.[0]?.id||''),[preview,setPreview]=useState(false),[removing,setRemoving]=useState('');
 const items=scene.whispers||[],current=items.find(w=>w.id===selected);
 function update(patch:Partial<SceneWhisper>){if(current)onChange({whispers:items.map(w=>w.id===current.id?{...w,...patch}:w)});setPreview(false);}
 function add(kind:SceneWhisper['kind']){const id=crypto.randomUUID();onChange({whispers:[...items,{id,kind,title:kind==='vision'?'Neue Vision':'Neue persönliche Botschaft',text:'',recipientIds:[],fileIds:[]}]});setSelected(id);setPreview(false);}
 function move(id:string,step:number){const next=[...items],index=next.findIndex(w=>w.id===id),target=index+step;if(target<0||target>=next.length)return;[next[index],next[target]]=[next[target],next[index]];onChange({whispers:next});}
 const label=(id:string)=>{const p=players.find(p=>p.id===id);return p?p.character?p.character.name+' · '+p.name:p.name:'Empfänger nicht verfügbar';};
 return <section className={styles.preparation} aria-label="Visionen und persönliche Botschaften vorbereiten">
  <p>Plane beliebig mehrere Inhalte je Spieler. Jeder Eintrag hat eigene Empfänger. Ausgespielt wird später bewusst über die Regie.</p>
  <div className={styles.actions}><button type="button" disabled={items.length>=100} onClick={()=>add('vision')}><CloudFog size={18}/> Vision vorbereiten</button><button type="button" disabled={items.length>=100} onClick={()=>add('letter')}><Mail size={18}/> Botschaft vorbereiten</button></div>
  {!items.length?<p className={styles.empty}>Noch nichts vorbereitet. Beginne mit einer Vision oder einem Brief.</p>:<ol className={styles.list} aria-label="Vorbereitete persönliche Inhalte">{items.map((w,i)=><li key={w.id}>
   <button type="button" className={styles.select} aria-pressed={selected===w.id} onClick={()=>{setSelected(w.id);setPreview(false);}}>{w.kind==='vision'?<CloudFog size={20}/>:<Mail size={20}/>}<span><strong>{w.title}</strong><small>{w.recipientIds.length?w.recipientIds.map(label).join(', '):'Noch keine Empfänger'}</small></span></button>
   <button type="button" disabled={i===0} aria-label={w.title+' nach oben'} onClick={()=>move(w.id,-1)}><ArrowUp size={15}/></button><button type="button" disabled={i===items.length-1} aria-label={w.title+' nach unten'} onClick={()=>move(w.id,1)}><ArrowDown size={15}/></button>
  </li>)}</ol>}
  {current&&<div className={styles.editor} key={current.id}>
   <header><h3>{current.kind==='vision'?'Vision':'Persönliche Botschaft'}</h3><button type="button" aria-label="Eintrag löschen" onClick={()=>setRemoving(current.id)}><Trash2 size={17}/></button></header>
   {removing===current.id&&<div className={styles.confirm} role="group" aria-label="Eintrag löschen bestätigen"><span>Diesen vorbereiteten Eintrag löschen?</span><button type="button" onClick={()=>{onChange({whispers:items.filter(w=>w.id!==current.id)});setSelected(items.find(w=>w.id!==current.id)?.id||'');setRemoving('');}}>Eintrag löschen</button><button type="button" onClick={()=>setRemoving('')}>Behalten</button></div>}
   <label>Titel<input maxLength={160} value={current.title} onChange={e=>update({title:e.target.value})}/></label>
   <fieldset className={styles.recipients}><legend>Nur für diese Spieler</legend>{players.map(p=><label key={p.id}><input type="checkbox" disabled={current.recipientIds.length>=20&&!current.recipientIds.includes(p.id)} checked={current.recipientIds.includes(p.id)} onChange={()=>update({recipientIds:current.recipientIds.includes(p.id)?current.recipientIds.filter(id=>id!==p.id):[...current.recipientIds,p.id]})}/><span><strong>{p.character?.name||p.name}</strong>{p.character&&<small>{p.name}</small>}</span></label>)}{!players.length&&<p>Keine aktiven Spieler verfügbar.</p>}{current.recipientIds.filter(id=>!players.some(p=>p.id===id)).map(id=><button type="button" key={id} onClick={()=>update({recipientIds:current.recipientIds.filter(v=>v!==id)})}>Nicht verfügbaren Empfänger entfernen</button>)}</fieldset>
   <p className={styles.hint}>{current.kind==='vision'?'Erscheint nur bei diesen Empfängern als Nebelvision.':'Landet nur bei diesen Empfängern als Brief auf dem Tisch. Geöffnet wird er per Klick.'}</p>
   <RichTextEditor value={current.text} onChange={text=>update({text})} label={current.kind==='vision'?'Text der Vision':'Text des Briefs'} maximumPlainLength={10000} placeholder="Was soll dieser Spieler erfahren?" files={files.filter(f=>f.mime.startsWith('image/'))} compactTools preparationTools/>
   <div className={styles.actions}><ProtectedImageGallery label="Bild hinzufügen" files={files.filter(f=>f.mime.startsWith('image/'))} onSelect={id=>{if(!current.fileIds.includes(id)&&current.fileIds.length<20)update({fileIds:[...current.fileIds,id]});}}/><button type="button" aria-expanded={preview} onClick={()=>setPreview(!preview)}><Eye size={16}/> Inhalt ansehen</button></div>
   {!!current.fileIds.length&&<ul className={styles.attachments}>{current.fileIds.map(id=><li key={id}><span>{files.find(f=>f.id===id)?.name||'Bild nicht verfügbar'}</span><button type="button" aria-label={'Bild entfernen: '+id} onClick={()=>update({fileIds:current.fileIds.filter(v=>v!==id)})}><X size={15}/></button></li>)}</ul>}
   {preview&&<article className={styles.preview}><h3>{current.title}</h3><p>Empfänger: {current.recipientIds.length?current.recipientIds.map(label).join(', '):'Noch niemand'}</p><RichTextView value={current.text} readable flowing/>{current.fileIds.map(id=><PreviewImage key={id} id={id}/>)}</article>}
  </div>}
  {!!items.length&&<p className={styles.hint}>Speichern und Weiter sichern alle Einträge. Dadurch wird noch nichts zugestellt.</p>}
 </section>;
}
// This is an authenticated SL preview; originals never use a public image proxy.
function PreviewImage({id}:{id:string}){return <img src={'/api/files?id='+encodeURIComponent(id)} alt="Vorbereitetes Bild" loading="lazy"/>;}
