/* eslint-disable @next/next/no-img-element -- Existing protected file endpoints. */
"use client";
import {useState,type ReactNode} from 'react';
import {ArrowUp,ArrowDown,Trash2,Image as ImageIcon,Music,Film,FileText,Puzzle,MessageSquareText} from 'lucide-react';
import {emptyScenePager,scenePagerMax,type SceneElement,type ScenePager} from '@/domain/story-scene';
import type {PreparationRecipient} from '@/domain/personal-message';
import type {CommandReference} from '@/domain/command-workspace';
import {ProtectedImageGallery,type PreparationFile} from './protected-image-gallery';
import {PreparationUpload} from './preparation-upload';
const kindIcon=(kind:SceneElement['kind'])=>kind==='image'?ImageIcon:kind==='audio'?Music:kind==='video'?Film:kind==='handout'?FileText:kind==='pager'?MessageSquareText:Puzzle;
import s from './story-workspace.module.css';
import {ThumbImage} from './file-thumb';

export const materialKinds:Record<SceneElement['kind'],{label:string;hint:string;group:string}>={
  handout:{label:'Handout',hint:'Bereite einen Brief, ein Dokument oder eine Unterlage vor. Eigener Text, eine vorhandene Handoutakte und eine Datei sind unabhängig nutzbar.',group:'Zeigen und übergeben'},
  image:{label:'Bild',hint:'Wähle ein vorhandenes Bild aus der Galerie und notiere, wann du es zeigen möchtest.',group:'Zeigen und übergeben'},
  audio:{label:'Audio',hint:'Ordne eine vorhandene Tondatei zu und notiere ihren Einsatz.',group:'Zeigen und übergeben'},
  video:{label:'Video',hint:'Bereite eine vorhandene Videodatei für die Szene vor.',group:'Zeigen und übergeben'},
  clue:{label:'Hinweis',hint:'Was kann entdeckt werden? Notiere Fundort, Voraussetzung und Bedeutung. Eine bestehende Hinweisakte lässt sich verknüpfen.',group:'Entdecken und handeln'},
  object:{label:'Gegenstand',hint:'Beschreibe ein untersuchbares Objekt, seine Eigenschaften und mögliche Reaktionen.',group:'Entdecken und handeln'},
  check:{label:'Probe',hint:'Notiere Auslöser, Werte und mögliche Ergebnisse. Hier wird keine Probe automatisch ausgewertet.',group:'Entdecken und handeln'},
  puzzle:{label:'Rätsel',hint:'Bereite Aufgabe, Hinweise und Lösung als Text vor; optional mit einer vorhandenen Regel oder Unterlage.',group:'Entdecken und handeln'},
  dialogue:{label:'Dialog',hint:'Halte Gesprächseinstieg, Antworten und Bedingungen als eigenen Baustein fest.',group:'Begegnungen und Regie'},
  encounter:{label:'Begegnung',hint:'Plane eine Begegnung mit Anlass, Beteiligten und möglichem Ablauf.',group:'Begegnungen und Regie'},
  description:{label:'Beschreibung',hint:'Ein eigener Vorlese- oder Beschreibungstext für einen Moment der Szene.',group:'Begegnungen und Regie'},
  text:{label:'Text',hint:'Ein frei beschrifteter Textbaustein deiner Vorbereitung.',group:'Begegnungen und Regie'},
  'sl-note':{label:'SL-Hinweis',hint:'Eine interne Regieanweisung für einen bestimmten Moment.',group:'Begegnungen und Regie'},
  pager:{label:'Pager-Nachricht',hint:'Eine Nachricht für den ULTIO-Pager: Absender, Titel, Text, Priorität und vorgesehene Empfänger. Ausgespielt wird sie während des Spielabends aus der Regie.',group:'Zeigen und übergeben'},
  person:{label:'Personenverweis',hint:'Verknüpfe eine vorhandene NPC-Akte und ergänze ihre Aufgabe in dieser Szene.',group:'Verweise'},
  place:{label:'Unterort / Raum',hint:'Verknüpfe einen Bereich oder Raum innerhalb der Szene. Der zentrale Schauplatz bleibt der Hauptort.',group:'Verweise'},
};
const referenceTypes:Partial<Record<SceneElement['kind'],string[]>>={place:['PLACE'],person:['NPC','CHARACTER'],clue:['CLUE'],handout:['HANDOUT'],puzzle:['RULE','HANDOUT']};

/** Prepared pager message: sender, text, priority and recipients. Nothing is sent here; the Regie plays it live. */
export function PagerFields({pager,players,onChange}:{pager:ScenePager;players:PreparationRecipient[];onChange:(pager:ScenePager)=>void}){
  const set=(patch:Partial<ScenePager>)=>onChange({...pager,...patch});
  const unknown=pager.recipientIds.filter(id=>!players.some(player=>player.id===id));
  const toggle=(id:string)=>set({recipientIds:pager.recipientIds.includes(id)?pager.recipientIds.filter(x=>x!==id):[...pager.recipientIds,id]});
  return <div className={s.pagerFields} data-pager-fields="">
    <label>Absender (im Spiel)<input value={pager.sender} maxLength={scenePagerMax.sender} placeholder="z. B. Schäfer" onChange={e=>set({sender:e.target.value})}/></label>
    <label>Pager-Text<textarea value={pager.text} maxLength={scenePagerMax.text} rows={3} placeholder="z. B. In 10 Minuten am Südtor. Komm allein." onChange={e=>set({text:e.target.value})}/><small>{pager.text.length}/{scenePagerMax.text} Zeichen</small></label>
    <label>Priorität<select value={pager.priority} onChange={e=>set({priority:e.target.value==='hoch'?'hoch':'normal'})}><option value="normal">Normal</option><option value="hoch">Dringend (Alarmton, rote Anzeige)</option></select></label>
    <fieldset><legend>Vorgesehene Empfänger</legend>
      <label><input type="checkbox" checked={!pager.recipientIds.length} onChange={()=>set({recipientIds:[]})}/> Ganze Runde</label>
      {players.map(player=><label key={player.id}><input type="checkbox" checked={pager.recipientIds.includes(player.id)} onChange={()=>toggle(player.id)}/> {player.character?player.character.name+' · '+player.name:player.name}</label>)}
      {unknown.length>0&&<p role="note">{unknown.length===1?'Ein Empfänger ist':unknown.length+' Empfänger sind'} nicht mehr aktiv. <button type="button" onClick={()=>set({recipientIds:pager.recipientIds.filter(id=>!unknown.includes(id))})}>Entfernen</button></p>}
      <small>In der Regie lässt sich die Auswahl vor dem Ausspielen noch ändern. Es erreicht nur Spieler, die am Abend teilnehmen.</small>
    </fieldset>
  </div>;
}

/**
 * The building-block editor. With variant "blocks" (Spielmaterial 3.0) it only offers the non-material blocks –
 * clues, checks, dialogues, notes, references – because images, handouts, audio, video and pager messages are
 * prepared in the material workbench.
 */
export function PreparationMaterials({elements,onChange,references,files,editor,onUploaded,players=[],variant='all'}:{elements:SceneElement[];onChange:(elements:SceneElement[])=>void;references:CommandReference[];files:PreparationFile[];editor:(value:string,onChange:(value:string)=>void,label:string,key:string)=>ReactNode;onUploaded?:(file:PreparationFile)=>void;players?:PreparationRecipient[];variant?:'all'|'blocks'}) {
  const [active,setActive]=useState(''),[adding,setAdding]=useState(false);
  const blocks=variant==='blocks';
  const groups=[...new Set(Object.values(materialKinds).map(kind=>kind.group))].filter(group=>!blocks||group!=='Zeigen und übergeben');
  const update=(id:string,patch:Partial<SceneElement>)=>onChange(elements.map(element=>element.id===id?{...element,...patch}:element));
  function add(kind:SceneElement['kind']){const id=crypto.randomUUID();onChange([...elements,{id,kind,title:materialKinds[kind].label,text:'',referenceId:'',fileId:'',...(kind==='pager'?{pager:emptyScenePager()}:{})}]);setActive(id);setAdding(false);}
  function move(index:number,direction:number){const next=[...elements];[next[index],next[index+direction]]=[next[index+direction],next[index]];onChange(next);}
  function list(){return <ol className={s.materialList}>{elements.map((element,index)=>{const info=materialKinds[element.kind];const allowed=referenceTypes[element.kind];const file=files.find(file=>file.id===element.fileId);return <li key={element.id}>
      <div className={s.materialHead}>{file?.mime.startsWith('image/')?<ThumbImage className={s.materialThumb} id={file.id}/>:(()=>{const KindIcon=kindIcon(element.kind);return <span className={s.materialThumb} aria-hidden="true"><KindIcon size={20}/></span>;})()}<button type="button" aria-expanded={active===element.id} onClick={()=>setActive(active===element.id?'':element.id)}>{index+1}. {element.title||info.label}<small>{info.label}{file?' · '+file.name:['image','audio','video'].includes(element.kind)?' · noch keine Datei':''}{element.kind==='pager'?(element.pager?.text.trim()?' · '+(element.pager.recipientIds.length?element.pager.recipientIds.length+' Empfänger':'ganze Runde'):' · noch kein Text'):''} · vorbereitet, nicht veröffentlicht</small></button><div><button type="button" aria-label={element.title+' nach oben'} disabled={index===0} onClick={()=>move(index,-1)}><ArrowUp size={16}/></button><button type="button" aria-label={element.title+' nach unten'} disabled={index===elements.length-1} onClick={()=>move(index,1)}><ArrowDown size={16}/></button><button type="button" aria-label={'Baustein entfernen: '+element.title} onClick={()=>onChange(elements.filter(item=>item.id!==element.id))}><Trash2 size={16}/></button></div></div>
      {active===element.id&&<div className={s.materialBody}><p>{info.hint}</p><label>{element.kind==='pager'?'Titel / Betreff':'Bausteintitel'}<input value={element.title} maxLength={element.kind==='pager'?scenePagerMax.title:200} onChange={e=>update(element.id,{title:e.target.value})}/></label>
        {element.kind==='pager'&&<PagerFields pager={element.pager||emptyScenePager()} players={players} onChange={pager=>update(element.id,{pager})}/>}
        {allowed&&<label>Vorhandene Akte (optional)<select value={element.referenceId} onChange={e=>update(element.id,{referenceId:e.target.value})}><option value="">Ohne bestehende Akte vorbereiten</option>{element.referenceId&&!references.some(ref=>ref.id===element.referenceId)&&<option value={element.referenceId} disabled>Bestehende Verknüpfung derzeit nicht verfügbar</option>}{references.filter(ref=>allowed.includes(ref.type)).map(ref=><option key={ref.id} value={ref.id}>{ref.title}</option>)}</select></label>}
        {element.kind==='image'?<ProtectedImageGallery label="Bildgalerie" files={files} selected={element.fileId} onSelect={fileId=>update(element.id,{fileId})}/>:['audio','video','handout'].includes(element.kind)&&<label>{element.kind==='handout'?'Unterlage / Datei (optional)':'Vorhandene '+info.label+'datei'}<select value={element.fileId} onChange={e=>update(element.id,{fileId:e.target.value})}><option value="">Keine Datei zugeordnet</option>{element.fileId&&!file&&<option value={element.fileId} disabled>Bestehende Datei derzeit nicht verfügbar</option>}{files.filter(file=>element.kind==='handout'||file.mime.startsWith(element.kind+'/')).map(file=><option key={file.id} value={file.id}>{file.name}</option>)}</select></label>}
        {onUploaded&&['image','audio','video','handout'].includes(element.kind)&&<PreparationUpload kind={element.kind as 'image'|'audio'|'video'|'handout'} label={'Neue '+info.label+'datei hochladen'} onUploaded={uploaded=>{onUploaded(uploaded);update(element.id,{fileId:uploaded.id,title:element.title===info.label?uploaded.name.replace(/\.[^.]+$/,''):element.title});}}/>}
        {file?.mime.startsWith('image/')&&<img className={s.materialPreview} src={'/api/files?id='+encodeURIComponent(file.id)} alt={'Zugeordnetes Bild: '+file.name}/>}
        {file?.mime.startsWith('audio/')&&<audio className={s.materialPreview} controls preload="none" src={'/api/files?id='+encodeURIComponent(file.id)} aria-label={'Hörprobe: '+file.name}/>}
        {file?.mime.startsWith('video/')&&<video className={s.materialPreview} controls preload="none" playsInline src={'/api/files?id='+encodeURIComponent(file.id)} aria-label={'Videovorschau: '+file.name}/>}
        {element.fileId&&<button type="button" onClick={()=>update(element.id,{fileId:''})}>Dateizuordnung entfernen</button>}
        {editor(element.text,text=>update(element.id,{text}),element.kind==='pager'?'Einsatz – wann ausspielen? (nur SL)':info.label+' – Inhalt',element.id)}
      </div>}
    </li>;})}</ol>;}
  if(blocks)return <section className={s.materials} aria-label="Weitere Szenenbausteine">
    <header><h3>Weitere Szenenbausteine</h3><p>Hinweise, Proben, Rätsel, Dialoge, Notizen und Verweise. Bilder, Handouts, Ton, Video und Pager bereitest du oben als Spielmaterial vor.</p></header>
    <div className={s.materialActions}><button type="button" disabled={elements.length>=100} aria-expanded={adding} onClick={()=>setAdding(!adding)}>Baustein hinzufügen</button></div>
    {adding&&<div className={s.materialCatalog}>{groups.map(group=><section key={group}><h4>{group}</h4><ul>{(Object.entries(materialKinds) as [SceneElement['kind'],typeof materialKinds[SceneElement['kind']]][]).filter(([,item])=>item.group===group).map(([kind,item])=><li key={kind}><button type="button" onClick={()=>add(kind)}><strong>{item.label}</strong><span>{item.hint}</span></button></li>)}</ul></section>)}</div>}
    {list()}
  </section>;
  return <section className={s.materials} aria-label="Szenenbausteine">
    <header><h3>Szenenbausteine</h3><p>Baue die konkreten Momente dieser Szene: Was finden die Spieler? Was zeigst oder übergibst du? Jeder Baustein hat einen eigenen Titel, Inhalt und bei Bedarf eine bestehende Akte oder Datei. Die Reihenfolge ist deine Regiehilfe.</p><p>Alles bleibt Vorbereitung für die SL. Hier wird nichts abgespielt, an Spieler gesendet oder freigegeben.</p></header>
    <div className={s.materialActions}><button type="button" disabled={elements.length>=100} onClick={()=>add('image')}><ImageIcon size={16} aria-hidden="true"/> Foto / Polaroid</button><button type="button" disabled={elements.length>=100} onClick={()=>add('handout')}><FileText size={16} aria-hidden="true"/> Handout vorbereiten</button><button type="button" disabled={elements.length>=100} onClick={()=>add('audio')}><Music size={16} aria-hidden="true"/> Audio</button><button type="button" disabled={elements.length>=100} onClick={()=>add('video')}><Film size={16} aria-hidden="true"/> Video</button><button type="button" disabled={elements.length>=100} onClick={()=>add('pager')}><MessageSquareText size={16} aria-hidden="true"/> Pager-Nachricht</button><button type="button" disabled={elements.length>=100} aria-expanded={adding} onClick={()=>setAdding(!adding)}>Anderes Spielmaterial hinzufügen</button><small>{elements.length}/100 Bausteine</small></div>
    {adding&&<div className={s.materialCatalog}>{groups.map(group=><section key={group}><h4>{group}</h4><ul>{(Object.entries(materialKinds) as [SceneElement['kind'],typeof materialKinds[SceneElement['kind']]][]).filter(([,item])=>item.group===group).map(([kind,item])=><li key={kind}><button type="button" onClick={()=>add(kind)}><strong>{item.label}</strong><span>{item.hint}</span></button></li>)}</ul></section>)}</div>}
    {!elements.length&&<p>Noch kein Spielmaterial. Beginne zum Beispiel mit einem Brief als Handout oder einem Hinweis zum Untersuchen.</p>}
    {list()}
  </section>;
}
