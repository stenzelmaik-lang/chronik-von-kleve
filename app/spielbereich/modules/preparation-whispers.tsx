/* eslint-disable @next/next/no-img-element -- Existing protected character portraits. */
"use client";
import {PreparedWhispers} from './prepared-whispers';
import {useRef,useState,type ReactNode} from 'react';
import {Send,Eye,Users,Paperclip,X,UserRound,Check} from 'lucide-react';
import {PreparationPanel} from './preparation-panel';
import panel from './preparation-panel.module.css';
import type {PreparationRecipient} from '@/domain/personal-message';
import type {SceneDocument} from '@/domain/story-scene';
import {htmlToRichText,richTextToHtml,isRichTextWithinLimit,richTextFileIds,richTextToPlainText} from '@/domain/location-rich-text';
import {ProtectedImageGallery,type PreparationFile} from './protected-image-gallery';
import {PersonalMessageBody} from './personal-message-body';
import {api} from './api-client';
import s from './story-workspace.module.css';

function LegacyPreparationWhispers({scene,players,files,onChange,onSave,children}:{scene:SceneDocument;players:PreparationRecipient[];files:PreparationFile[];onChange:(patch:Partial<SceneDocument>)=>void;onSave:()=>Promise<boolean>;children:ReactNode}) {
  const [picking,setPicking]=useState(false),[search,setSearch]=useState(''),[review,setReview]=useState(''),[sent,setSent]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const [importRevision,setImportRevision]=useState(0);
  const command=useRef<{signature:string;id:string}|null>(null);
  const title=('Persönliche Botschaft · '+scene.title).slice(0,160);
  const signature=JSON.stringify({title,text:scene.visions,recipients:scene.visionRecipientIds,fileIds:scene.visionFileIds});
  const reviewing=review===signature;
  const recipientLabel=(id:string)=>{const player=players.find(player=>player.id===id);return player?player.character?player.character.name+' · '+player.name:player.name:'Nicht verfügbar';};
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
    {reviewing?<><h3>Nur diese Botschaft wird zugestellt</h3><p><strong>{title}</strong></p><p>Empfänger: {scene.visionRecipientIds.map(recipientLabel).join(', ')}</p><PersonalMessageBody text={scene.visions} format="rich" attachments={files.filter(file=>scene.visionFileIds.includes(file.id))}/><p>Eine eigene Nachricht je gewähltem Spieler. Keine Gruppenfreigabe, keine übrigen Szeneninhalte.</p><div className={s.materialActions}><button type="button" disabled={busy} onClick={()=>setReview('')}>Botschaft weiter bearbeiten</button><button type="button" disabled={busy||!ready||sent===signature} onClick={()=>void send()}><Send size={16} aria-hidden="true"/>{busy?'Wird zugestellt …':sent===signature?'Bereits zugestellt':'Privat zustellen'}</button></div></>:<>
      <div className={s.materialActions}><PreparationPanel label="Spieler auswählen" icon={<Users size={17} aria-hidden="true"/>} open={picking} onOpenChange={setPicking} wide>
        <label>Spieler oder Charakter suchen<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name der Figur oder Person …"/></label>
        <p>Die Figur entspricht der gespeicherten aktiven Charakterauswahl. Zugestellt wird ins persönliche Spielerpostfach.</p>
        <ul className={panel.choices}>{players.filter(player=>(player.name+' '+(player.character?.name||'')).toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'))).map(player=><li key={player.id}><button type="button" aria-label={recipientLabel(player.id)} aria-pressed={scene.visionRecipientIds.includes(player.id)} disabled={!scene.visionRecipientIds.includes(player.id)&&scene.visionRecipientIds.length>=20} onClick={()=>onChange({visionRecipientIds:scene.visionRecipientIds.includes(player.id)?scene.visionRecipientIds.filter(id=>id!==player.id):[...scene.visionRecipientIds,player.id]})}>{player.character?.portrait?<img loading="lazy" src={player.character.portrait} alt=""/>:<UserRound size={28} aria-hidden="true"/>}<span><strong>{player.character?.name||player.name}</strong><small>{player.character?player.name:'Kein aktiver Charakter gewählt'}</small></span>{scene.visionRecipientIds.includes(player.id)&&<Check size={18} aria-hidden="true"/>}</button></li>)}</ul>
        {!players.length&&<p>Keine aktiven Spieler verfügbar.</p>}
        {scene.visionRecipientIds.filter(id=>!players.some(player=>player.id===id)).map(id=><button type="button" key={id} onClick={()=>onChange({visionRecipientIds:scene.visionRecipientIds.filter(value=>value!==id)})}>Nicht verfügbaren Empfänger entfernen</button>)}
        <div className={panel.actions}><button type="button" onClick={()=>setPicking(false)}>Auswahl übernehmen</button></div>
      </PreparationPanel><ProtectedImageGallery label="Bild anhängen" files={files} onSelect={addFile}/></div>
      {!!scene.visionRecipientIds.length&&<p>Nur für: {scene.visionRecipientIds.map(recipientLabel).join(', ')}</p>}
      <details className={s.optionalSelection}><summary><Paperclip size={16} aria-hidden="true"/>Handout, Datei oder Szenenmaterial übernehmen</summary><p>Übernommen werden nur der vorbereitete Text und die zugeordnete Datei. Verknüpfte Akten und ihre SL-Geheimnisse werden nicht automatisch kopiert.</p><label>Vorhandener Szenenbaustein<select value="" onChange={e=>material(e.target.value)}><option value="">Baustein wählen …</option>{scene.elements.filter(item=>!['sl-note','place','person','pager'].includes(item.kind)).map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>Datei anhängen<select value="" onChange={e=>{if(e.target.value)addFile(e.target.value);}}><option value="">Vorhandene Datei wählen …</option>{files.map(file=><option key={file.id} value={file.id}>{file.name}</option>)}</select></label></details>
      {!!scene.visionFileIds.length&&<ul className={s.attachmentList}>{scene.visionFileIds.map(id=><li key={id}><span>{files.find(file=>file.id===id)?.name||'Datei derzeit nicht verfügbar'}</span><button type="button" aria-label={'Anhang entfernen: '+(files.find(file=>file.id===id)?.name||id)} onClick={()=>onChange({visionFileIds:scene.visionFileIds.filter(value=>value!==id)})}><X size={16} aria-hidden="true"/></button></li>)}</ul>}
      <div key={importRevision}>{children}</div>
      <p>Speichern und Weiter halten nur die Vorbereitung fest. Zustellen erfolgt ausschließlich nach der Empfänger- und Inhaltsprüfung.</p>
      <button type="button" disabled={!ready||busy} onClick={()=>setReview(signature)}><Eye size={16} aria-hidden="true"/>Empfänger & Botschaft prüfen</button>
    </>}
  </section>;
}

export function PreparationWhispers(p:Parameters<typeof LegacyPreparationWhispers>[0]){return <><PreparedWhispers scene={p.scene} players={p.players} files={p.files} onChange={p.onChange}/>{(p.scene.visions||p.scene.visionFileIds.length||p.scene.visionRecipientIds.length)?<details><summary>Bisherige gemeinsame Vorbereitung</summary><LegacyPreparationWhispers {...p}/></details>:null}</>;}
