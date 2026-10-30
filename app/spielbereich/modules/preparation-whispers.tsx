"use client";
import {useRef,useState,type ReactNode} from 'react';
import {Send,Eye,Users,Paperclip,X} from 'lucide-react';
import type {SceneDocument} from '@/domain/story-scene';
import {htmlToRichText,richTextToHtml,isRichTextWithinLimit,richTextFileIds,richTextToPlainText} from '@/domain/location-rich-text';
import {ProtectedImageGallery,type PreparationFile} from './protected-image-gallery';
import {PersonalMessageBody} from './personal-message-body';
import {api} from './api-client';
import s from './story-workspace.module.css';

export function PreparationWhispers({scene,players,files,onChange,onSave,children}:{scene:SceneDocument;players:{id:string;name:string}[];files:PreparationFile[];onChange:(patch:Partial<SceneDocument>)=>void;onSave:()=>Promise<boolean>;children:ReactNode}) {
  const [picking,setPicking]=useState(false),[search,setSearch]=useState(''),[review,setReview]=useState(''),[sent,setSent]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const [importRevision,setImportRevision]=useState(0);
  const command=useRef<{signature:string;id:string}|null>(null);
  const title=('Persönliche Botschaft · '+scene.title).slice(0,160);
  const signature=JSON.stringify({title,text:scene.visions,recipients:scene.visionRecipientIds,fileIds:scene.visionFileIds});
  const reviewing=review===signature;
  const unknown=scene.visionRecipientIds.some(id=>!players.some(player=>player.id===id));
  const ready=scene.visionRecipientIds.length>0&&!unknown&&isRichTextWithinLimit(scene.visions,10000)&&!!(richTextToPlainText(scene.visions).trim()||richTextFileIds(scene.visions).length||scene.visionFileIds.length);
  function addFile(id:string){if(!scene.visionFileIds.includes(id)){if(scene.visionFileIds.length>=20){setNotice('Höchstens 20 Dateien. Entferne zuerst eine Zuordnung.');return;}onChange({visionFileIds:[...scene.visionFileIds,id]});}}
  function material(id:string){const item=scene.elements.find(element=>element.id===id);if(!item)return;
    try{
      if(!isRichTextWithinLimit(scene.visions,10000))throw new Error('Korrigiere zuerst die ungültige Botschaft; dein Entwurf bleibt erhalten.');
      const escaped=item.title.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
      const text=htmlToRichText(richTextToHtml(scene.visions)+'<h3>'+escaped+'</h3>'+richTextToHtml(item.text));
      if(!isRichTextWithinLimit(text,10000))throw new Error('Die übernommenen Texte überschreiten 10.000 Zeichen. Kürze zuerst deine Botschaft.');
      const ids=[...new Set([...scene.visionFileIds,...(item.fileId?[item.fileId]:[])])];if(ids.length>20)throw new Error('Höchstens 20 Dateien je Botschaft.');
      onChange({visions:text,visionFileIds:ids});setImportRevision(value=>value+1);setNotice('Baustein in die Botschaft übernommen. Prüfe den Inhalt vor dem Zustellen; Originalakte und Freigaben bleiben unverändert.');
    }catch(error){setNotice((error as Error).message);}
  }
  async function send(){if(busy||!ready||!reviewing||sent===signature)return;setBusy(true);setNotice('');
    try{if(!(await onSave())){setNotice('Die Vorbereitung konnte nicht gespeichert werden. Es wurde nichts versendet.');return;}
      if(command.current?.signature!==signature)command.current={signature,id:crypto.randomUUID()};
      const result=await api<{sent:number}>('/api/messages','POST',{clientRequestId:command.current.id,title,text:scene.visions,format:'rich',fileIds:scene.visionFileIds,recipients:scene.visionRecipientIds});
      setSent(signature);setNotice(`Privat an ${result.sent} Spieler zugestellt. Im persönlichen Postfach verfügbar.`);
    }catch(error){setNotice((error as Error).message);}finally{setBusy(false);}
  }
  return <section className={s.whispers} aria-label="Persönliche Botschaft vorbereiten">
    {notice&&<p role="status">{notice}</p>}
    {reviewing?<><h3>Nur diese Botschaft wird zugestellt</h3><p><strong>{title}</strong></p><p>Empfänger: {scene.visionRecipientIds.map(id=>players.find(player=>player.id===id)?.name||'Nicht verfügbar').join(', ')}</p><PersonalMessageBody text={scene.visions} format="rich" attachments={files.filter(file=>scene.visionFileIds.includes(file.id))}/><p>Eine eigene Nachricht je gewähltem Spieler. Keine Gruppenfreigabe, keine übrigen Szeneninhalte.</p><div className={s.materialActions}><button type="button" disabled={busy} onClick={()=>setReview('')}>Botschaft weiter bearbeiten</button><button type="button" disabled={busy||!ready||sent===signature} onClick={()=>void send()}><Send size={16} aria-hidden="true"/>{busy?'Wird zugestellt …':sent===signature?'Bereits zugestellt':'Privat zustellen'}</button></div></>:<>
      <div className={s.materialActions}><button type="button" aria-expanded={picking} onClick={()=>setPicking(!picking)}><Users size={16} aria-hidden="true"/>Spieler auswählen{scene.visionRecipientIds.length?' ('+scene.visionRecipientIds.length+')':''}</button><ProtectedImageGallery label="Bild anhängen" files={files} onSelect={addFile}/></div>
      {!!scene.visionRecipientIds.length&&<p>Nur für: {scene.visionRecipientIds.map(id=>players.find(player=>player.id===id)?.name||'Nicht verfügbar').join(', ')}</p>}
      {picking&&<fieldset className={s.recipientPicker} disabled={busy}><legend>Empfänger dieser Botschaft</legend><label>Spieler suchen<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name …"/></label>{players.filter(player=>player.name.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'))).map(player=><label key={player.id}><input type="checkbox" checked={scene.visionRecipientIds.includes(player.id)} disabled={!scene.visionRecipientIds.includes(player.id)&&scene.visionRecipientIds.length>=20} onChange={e=>onChange({visionRecipientIds:e.target.checked?[...scene.visionRecipientIds,player.id]:scene.visionRecipientIds.filter(id=>id!==player.id)})}/>{player.name}</label>)}{!players.length&&<p>Keine aktiven Spieler verfügbar.</p>}{scene.visionRecipientIds.filter(id=>!players.some(player=>player.id===id)).map(id=><button type="button" key={id} onClick={()=>onChange({visionRecipientIds:scene.visionRecipientIds.filter(value=>value!==id)})}>Nicht verfügbaren Empfänger entfernen</button>)}</fieldset>}
      <details className={s.optionalSelection}><summary><Paperclip size={16} aria-hidden="true"/>Handout, Datei oder Szenenmaterial übernehmen</summary><p>Übernommen werden nur der vorbereitete Text und die zugeordnete Datei. Verknüpfte Akten und ihre SL-Geheimnisse werden nicht automatisch kopiert.</p><label>Vorhandener Szenenbaustein<select value="" onChange={e=>material(e.target.value)}><option value="">Baustein wählen …</option>{scene.elements.filter(item=>!['sl-note','place','person'].includes(item.kind)).map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>Datei anhängen<select value="" onChange={e=>{if(e.target.value)addFile(e.target.value);}}><option value="">Vorhandene Datei wählen …</option>{files.map(file=><option key={file.id} value={file.id}>{file.name}</option>)}</select></label></details>
      {!!scene.visionFileIds.length&&<ul className={s.attachmentList}>{scene.visionFileIds.map(id=><li key={id}><span>{files.find(file=>file.id===id)?.name||'Datei derzeit nicht verfügbar'}</span><button type="button" aria-label={'Anhang entfernen: '+(files.find(file=>file.id===id)?.name||id)} onClick={()=>onChange({visionFileIds:scene.visionFileIds.filter(value=>value!==id)})}><X size={16} aria-hidden="true"/></button></li>)}</ul>}
      <div key={importRevision}>{children}</div>
      <p>Speichern und Weiter halten nur die Vorbereitung fest. Zustellen erfolgt ausschließlich nach der Empfänger- und Inhaltsprüfung.</p>
      <button type="button" disabled={!ready||busy} onClick={()=>setReview(signature)}><Eye size={16} aria-hidden="true"/>Empfänger & Botschaft prüfen</button>
    </>}
  </section>;
}
