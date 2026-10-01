"use client";
import {useEffect,useState} from 'react';
import type {Entry} from '@/domain/legacy';
import type {Actor} from '@/domain/types';
import type {PlaceProjection} from '@/domain/location-types';
import type {WorldHubPlace} from './world-map-contract';
import {api} from './api-client';
import {RichTextView} from './rich-text';

export function sessionPlaceId(session?:Entry){
  const secret=session?.body.slSecret;
  return secret&&typeof secret==='object'&&'activePlaceId' in secret&&typeof secret.activePlaceId==='string'?secret.activePlaceId:'';
}
export function CommandPlace({session,a,onRefresh}:{session?:Entry;a:Actor;onRefresh:()=>void}){
  const saved=sessionPlaceId(session);
  const [draft,setDraft]=useState<string|null>(null),[places,setPlaces]=useState<WorldHubPlace[]>([]);
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [result,setResult]=useState<{id:string;projection:PlaceProjection}|null>(null);
  const selected=draft??saved;
  useEffect(()=>{let live=true;api<{places:WorldHubPlace[]}>('/api/locations?view=sl&target=group').then(r=>{if(live)setPlaces(r.places);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[a.id,a.campaignId]);
  useEffect(()=>{let live=true;if(!selected)return;api<{projection:PlaceProjection}>('/api/locations?place='+encodeURIComponent(selected)+'&view=sl&target=group').then(r=>{if(live){setResult({id:selected,projection:r.projection});setError('');}}).catch(e=>{if(live){setResult(null);setError(e.message);}});return()=>{live=false;};},[selected]);
  async function save(next=selected){
    if(!session?.id)return;
    setBusy(true);setMessage('Wird gespeichert …');setError('');
    try{
      const previous=session.body.slSecret;
      await api('/api/records','POST',{id:session.id,version:session.version,kind:'sitzungen',title:session.title,visibility:session.visibility,gmBody:session.gmBody||'',body:{...session.body,slSecret:{...(previous&&typeof previous==='object'?previous:{}),activePlaceId:next||null}}});
      setMessage('Aktiver Schauplatz mit der Sitzung gespeichert.');onRefresh();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <>
    <p>Ort wählen – wird automatisch mit der Sitzung gespeichert. Nur für die SL.</p>
    <label className="field"><span>Aktiver Schauplatz</span><select aria-label="Aktiver Schauplatz" value={selected} disabled={busy||!session?.id} onChange={e=>{const next=e.target.value;setDraft(next);void save(next);}}><option value="">Kein Schauplatz zugeordnet</option>{saved&&!places.some(p=>p.id===saved)&&<option value={saved}>Gespeicherter Ort derzeit nicht verfügbar</option>}{places.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
    <p role="status">{message|| (selected!==saved?'Ungespeicherte Schauplatzwahl':saved?'Gespeicherter Schauplatz':'Noch kein Schauplatz gespeichert')}</p>
    {error&&<button className="button" disabled={busy} onClick={()=>void save()}>Speichern erneut versuchen</button>}
    {!session?.id&&<p>Bitte zuerst eine Sitzung speichern.</p>}
    {error&&<p role="alert">{error}</p>}
    {selected&&result?.id===selected?<div>
      <h3>{result.projection.location.title}</h3><p>{result.projection.location.subtitle}</p>
      <RichTextView value={result.projection.location.summary}/>
      {!!result.projection.location.slNotes?.length&&<details><summary>Vertrauliche Hinweise · {result.projection.location.slNotes.length}</summary>{result.projection.location.slNotes.map(n=><div key={n.entityId}><RichTextView value={n.text}/></div>)}</details>}
      <details><summary>Bereiche und Räume · {result.projection.location.areas.length}</summary>{result.projection.location.areas.map(area=><div key={area.viewKey}><strong>{area.title}</strong><p>{area.rooms.map(r=>r.title).join(' · ')}</p></div>)}</details>
      <a className="button" href={'/spielbereich?bereich=schauplaetze&ort='+encodeURIComponent(selected)} target="_blank" rel="noopener noreferrer">Ganzes Ortsdossier öffnen ↗</a>
    </div>:selected?<p>Ortsinformationen werden geladen beziehungsweise sind nicht verfügbar.</p>:<p>Wähle den Ort deiner Szene.</p>}
  </>;
}
