"use client";

import {useState} from 'react';
import type {PlaceProjection} from '@/domain/location-types';
import {api} from './api-client';

type Entry={id:string;title:string;parentId:string|null;level:string;lifecycle:string;visibility?:string};
type Release=NonNullable<PlaceProjection['location']['slGroupReleases']>[number];

export function LocationTreeRelease({placeId,nodes,disabled,onPublished}:{
 placeId:string;nodes:Entry[];disabled:boolean;onPublished:()=>Promise<void>;
}){
 const [plan,setPlan]=useState<Release[]|null>(null),[selected,setSelected]=useState<string[]>([]);
 const [knowledge,setKnowledge]=useState<'rumored'|'known'|'visited'|'investigated'>('known');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const items=nodes.filter(node=>['location','area','room'].includes(node.level)&&node.lifecycle==='active'&&node.visibility!=='gm');
 const available=(id:string)=>plan?.find(row=>row.entityId===id&&!row.secret&&row.approvedRevisionId);
 async function prepare(){
  setBusy(true);setError('');setMessage('');setPlan(null);setSelected([]);
  try{
   const {projection}=await api<{projection:PlaceProjection}>('/api/locations?view=sl&target=group&place='+encodeURIComponent(placeId));
   setPlan(projection.location.slGroupReleases??[]);
   setSelected([placeId]);
  }catch(e){setError(e instanceof Error?e.message:'Die Freigabeliste konnte nicht geladen werden.');}
  finally{setBusy(false);}
 }
 async function publish(){
  const entries=selected.flatMap(id=>{
   const row=available(id);
   return row?.approvedRevisionId?[{entityId:id,revisionId:row.approvedRevisionId,expectedReleaseVersion:row.version}]:[];
  });
  if(entries.length!==selected.length||!entries.length||!window.confirm('Die '+entries.length+' ausgewählten Einträge gemeinsam für die Runde freigeben?'))return;
  setBusy(true);setError('');
  try{
   await api('/api/cms/releases','POST',{action:'publish-tree',placeId,entries,discoveryState:knowledge});
   setPlan(null);setSelected([]);setMessage('Freigabe gespeichert. '+entries.length+' Einträge wurden gemeinsam veröffentlicht.');
   await onPublished();
  }catch(e){setError(e instanceof Error?e.message:'Die Ortsfreigabe ist fehlgeschlagen.');}
  finally{setBusy(false);}
 }
 return <section aria-label="Gemeinsame Ortsfreigabe">
  <h3>Ort mit Bereichen und Räumen freigeben</h3>
  <p>Wähle die genehmigten Fassungen aus. Geheime Einträge und Hinweise bleiben getrennt.</p>
  <button className="button" type="button" disabled={disabled||busy} onClick={()=>void prepare()}>Freigabeliste laden</button>
  {plan&&<fieldset disabled={disabled||busy}>
   <legend>Einträge für die Runde</legend>
   {items.map(node=>{
    const row=available(node.id),parentSelected=!node.parentId||selected.includes(node.parentId);
    return <label key={node.id} className="field">
     <span><input type="checkbox" checked={!!row&&selected.includes(node.id)} disabled={!row||!parentSelected||node.id===placeId}
      onChange={event=>setSelected(current=>event.target.checked?[...current,node.id]:current.filter(id=>id!==node.id&&items.find(item=>item.id===id)?.parentId!==node.id))}/>
      {' '}{node.title}{row?'':' · keine genehmigte Gruppenfassung'}</span>
    </label>;
   })}
   <label className="field"><span>Wissensstand für die Runde</span><select value={knowledge} onChange={event=>setKnowledge(event.target.value as typeof knowledge)}>
    <option value="rumored">Gerücht</option><option value="known">Bekannt</option><option value="visited">Besucht</option><option value="investigated">Untersucht</option>
   </select></label>
   <button className="button primary" type="button" disabled={!available(placeId)||selected.length>40} onClick={()=>void publish()}>Auswahl gemeinsam freigeben</button>
  </fieldset>}
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
