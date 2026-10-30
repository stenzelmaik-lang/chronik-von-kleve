/* eslint-disable @next/next/no-img-element -- Existing protected file endpoints. */
"use client";
import {useState,type ReactNode} from 'react';
import {ArrowUp,ArrowDown,Trash2} from 'lucide-react';
import type {SceneElement} from '@/domain/story-scene';
import type {CommandReference} from '@/domain/command-workspace';
import {ProtectedImageGallery,type PreparationFile} from './protected-image-gallery';
import s from './story-workspace.module.css';

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
  person:{label:'Personenverweis',hint:'Verknüpfe eine vorhandene NPC-Akte und ergänze ihre Aufgabe in dieser Szene.',group:'Verweise'},
  place:{label:'Unterort / Raum',hint:'Verknüpfe einen Bereich oder Raum innerhalb der Szene. Der zentrale Schauplatz bleibt der Hauptort.',group:'Verweise'},
};
const referenceTypes:Partial<Record<SceneElement['kind'],string[]>>={place:['PLACE'],person:['NPC','CHARACTER'],clue:['CLUE'],handout:['HANDOUT'],puzzle:['RULE','HANDOUT']};

export function PreparationMaterials({elements,onChange,references,files,editor}:{elements:SceneElement[];onChange:(elements:SceneElement[])=>void;references:CommandReference[];files:PreparationFile[];editor:(value:string,onChange:(value:string)=>void,label:string,key:string)=>ReactNode}) {
  const [active,setActive]=useState(''),[adding,setAdding]=useState(false);
  const groups=[...new Set(Object.values(materialKinds).map(kind=>kind.group))];
  const update=(id:string,patch:Partial<SceneElement>)=>onChange(elements.map(element=>element.id===id?{...element,...patch}:element));
  function add(kind:SceneElement['kind']){const id=crypto.randomUUID();onChange([...elements,{id,kind,title:materialKinds[kind].label,text:'',referenceId:'',fileId:''}]);setActive(id);setAdding(false);}
  function move(index:number,direction:number){const next=[...elements];[next[index],next[index+direction]]=[next[index+direction],next[index]];onChange(next);}
  return <section className={s.materials} aria-label="Spielmaterial vorbereiten">
    <header><h3>Spielmaterial vorbereiten</h3><p>Baue die konkreten Momente dieser Szene: Was finden die Spieler? Was zeigst oder übergibst du? Jeder Baustein hat einen eigenen Titel, Inhalt und bei Bedarf eine bestehende Akte oder Datei. Die Reihenfolge ist deine Regiehilfe.</p><p>Alles bleibt Vorbereitung für die SL. Hier wird nichts abgespielt, an Spieler gesendet oder freigegeben.</p></header>
    <div className={s.materialActions}><button type="button" disabled={elements.length>=100} onClick={()=>add('handout')}>Handout vorbereiten</button><button type="button" disabled={elements.length>=100} aria-expanded={adding} onClick={()=>setAdding(!adding)}>Anderes Spielmaterial hinzufügen</button><small>{elements.length}/100 Bausteine</small></div>
    {adding&&<div className={s.materialCatalog}>{groups.map(group=><section key={group}><h4>{group}</h4><ul>{(Object.entries(materialKinds) as [SceneElement['kind'],typeof materialKinds[SceneElement['kind']]][]).filter(([,item])=>item.group===group).map(([kind,item])=><li key={kind}><button type="button" onClick={()=>add(kind)}><strong>{item.label}</strong><span>{item.hint}</span></button></li>)}</ul></section>)}</div>}
    {!elements.length&&<p>Noch kein Spielmaterial. Beginne zum Beispiel mit einem Brief als Handout oder einem Hinweis zum Untersuchen.</p>}
    <ol className={s.materialList}>{elements.map((element,index)=>{const info=materialKinds[element.kind];const allowed=referenceTypes[element.kind];const file=files.find(file=>file.id===element.fileId);return <li key={element.id}>
      <div className={s.materialHead}><button type="button" aria-expanded={active===element.id} onClick={()=>setActive(active===element.id?'':element.id)}>{index+1}. {element.title||info.label}<small>{info.label}{file?' · '+file.name:''}</small></button><div><button type="button" aria-label={element.title+' nach oben'} disabled={index===0} onClick={()=>move(index,-1)}><ArrowUp size={16}/></button><button type="button" aria-label={element.title+' nach unten'} disabled={index===elements.length-1} onClick={()=>move(index,1)}><ArrowDown size={16}/></button><button type="button" aria-label={'Baustein entfernen: '+element.title} onClick={()=>onChange(elements.filter(item=>item.id!==element.id))}><Trash2 size={16}/></button></div></div>
      {active===element.id&&<div className={s.materialBody}><p>{info.hint}</p><label>Bausteintitel<input value={element.title} maxLength={200} onChange={e=>update(element.id,{title:e.target.value})}/></label>
        {allowed&&<label>Vorhandene Akte (optional)<select value={element.referenceId} onChange={e=>update(element.id,{referenceId:e.target.value})}><option value="">Ohne bestehende Akte vorbereiten</option>{element.referenceId&&!references.some(ref=>ref.id===element.referenceId)&&<option value={element.referenceId} disabled>Bestehende Verknüpfung derzeit nicht verfügbar</option>}{references.filter(ref=>allowed.includes(ref.type)).map(ref=><option key={ref.id} value={ref.id}>{ref.title}</option>)}</select></label>}
        {element.kind==='image'?<ProtectedImageGallery label="Bildgalerie" files={files} selected={element.fileId} onSelect={fileId=>update(element.id,{fileId})}/>:['audio','video','handout'].includes(element.kind)&&<label>{element.kind==='handout'?'Unterlage / Datei (optional)':'Vorhandene '+info.label+'datei'}<select value={element.fileId} onChange={e=>update(element.id,{fileId:e.target.value})}><option value="">Keine Datei zugeordnet</option>{element.fileId&&!file&&<option value={element.fileId} disabled>Bestehende Datei derzeit nicht verfügbar</option>}{files.filter(file=>element.kind==='handout'||file.mime.startsWith(element.kind+'/')).map(file=><option key={file.id} value={file.id}>{file.name}</option>)}</select></label>}
        {file?.mime.startsWith('image/')&&<img className={s.materialPreview} src={'/api/files?id='+encodeURIComponent(file.id)} alt={'Zugeordnetes Bild: '+file.name}/>}
        {element.fileId&&<button type="button" onClick={()=>update(element.id,{fileId:''})}>Dateizuordnung entfernen</button>}
        {editor(element.text,text=>update(element.id,{text}),info.label+' – Inhalt',element.id)}
      </div>}
    </li>;})}</ol>
  </section>;
}
