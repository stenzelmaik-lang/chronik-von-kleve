"use client";
import {useEffect,useState} from 'react';
import type {Entry} from '@/domain/legacy';
import type {Actor} from '@/domain/types';
import type {PlaceProjection} from '@/domain/location-types';
import type {WorldHubPlace} from './world-map-contract';
import {api} from './api-client';
import {LocationSLDossier} from './location-sl-dossier';

export function sessionPlaceId(session?:Entry){
  const secret=session?.body.slSecret;
  return secret&&typeof secret==='object'&&'activePlaceId' in secret&&typeof secret.activePlaceId==='string'?secret.activePlaceId:'';
}
export function CommandPlace({session,a,onRefresh,browseId,onBrowse,pinned=false,readOnly=false,initialPlaceId=''}:{session?:Entry;a:Actor;onRefresh:()=>void;browseId?:string;onBrowse?:(id:string)=>void;pinned?:boolean;readOnly?:boolean;initialPlaceId?:string}){
  const saved=sessionPlaceId(session);
  const [draft,setDraft]=useState<string|null>(null),[places,setPlaces]=useState<WorldHubPlace[]>([]);
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [catalogError,setCatalogError]=useState('');
  const [reload,setReload]=useState(0);
  const [result,setResult]=useState<{id:string;projection:PlaceProjection}|null>(null);
  const selected=browseId??draft??(saved||initialPlaceId);
  useEffect(()=>{let live=true;if(!a.gm)return;api<{places:WorldHubPlace[]}>('/api/locations?view=sl&target=group').then(r=>{if(live){setPlaces(r.places);setCatalogError('');}}).catch(e=>{if(live)setCatalogError(e.message);});return()=>{live=false;};},[a.id,a.campaignId,a.gm,reload]);
  useEffect(()=>{let live=true;if(!selected||!a.gm)return;api<{projection:PlaceProjection}>('/api/locations?node='+encodeURIComponent(selected)+'&view=sl&target=group').then(r=>{if(live){setResult({id:selected,projection:r.projection});setError('');}}).catch(e=>{if(live){setResult(null);setError(e.message);}});return()=>{live=false;};},[selected,a.id,a.campaignId,a.gm,reload]);
  async function save(next=selected){
    if(readOnly||!session?.id)return;
    setBusy(true);setMessage('Wird gespeichert …');setError('');
    try{
      const previous=session.body.slSecret;
      await api('/api/records','POST',{id:session.id,version:session.version,kind:'sitzungen',title:session.title,visibility:session.visibility,gmBody:session.gmBody||'',body:{...session.body,slSecret:{...(previous&&typeof previous==='object'?previous:{}),activePlaceId:next||null}}});
      setMessage('Aktiver Schauplatz mit der Sitzung gespeichert.');onRefresh();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  if(!a.gm)return null;
  return <>
    {!readOnly&&<p>Akten durchsehen verändert keine Sitzung. Den aktiven Schauplatz setzt du ausdrücklich.</p>}
    <label className="field"><span>Hauptort</span><select aria-label="Ortsakte auswählen" value={result?.id===selected?result.projection.location.id:selected} disabled={busy||pinned} onChange={e=>{const next=e.target.value;setDraft(next);onBrowse?.(next);}}><option value="">Ortsakte auswählen</option>{selected&&!places.some(p=>p.id===selected)&&result?.id!==selected&&<option value={selected}>Ausgewählter Ortseintrag</option>}{places.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
    {catalogError&&<p role="alert">Der Ortsbestand konnte nicht geladen werden: {catalogError} <button type="button" className="button" onClick={()=>setReload(value=>value+1)}>Ortsbestand erneut laden</button></p>}
    {!readOnly&&<><button className="button" disabled={busy||!session?.id||!selected||selected===saved} onClick={()=>void save(selected)}>{!selected?'Zuerst einen Ort auswählen':selected===saved?'Aktiver Sitzungsort':'Als aktiven Schauplatz setzen'}</button>
    <p role="status">{message|| (selected===saved&&saved?'Mit der Sitzung gespeicherter Schauplatz':'Nur geöffnet · noch kein Wechsel des Sitzungsortes')}</p>
    {error&&<button className="button" disabled={busy} onClick={()=>void save()}>Speichern erneut versuchen</button>}
    {!session?.id&&<p>Bitte zuerst eine Sitzung speichern.</p>}</>}
    {error&&<p role="alert">{error} <button type="button" className="button" onClick={()=>{setError('');setReload(value=>value+1);}}>Ortsinformationen erneut laden</button></p>}
    {selected&&result?.id===selected?<div>
      <LocationSLDossier key={a.campaignId+':'+result.id} projection={result.projection} initialSelectedId={selected}/>
      {!readOnly&&<a className="button" href={'/spielbereich?bereich=schauplaetze&ort='+encodeURIComponent(selected)} target="_blank" rel="noopener noreferrer">Ganzes Ortsdossier öffnen ↗</a>}
    </div>:selected?<p>Ortsinformationen werden geladen beziehungsweise sind nicht verfügbar.</p>:<p>Wähle den Ort deiner Szene.</p>}
  </>;
}
