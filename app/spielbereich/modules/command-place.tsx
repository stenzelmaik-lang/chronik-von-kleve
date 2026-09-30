"use client";
import {useEffect,useState} from 'react';
import type {Entry} from '@/domain/legacy';
import type {Actor} from '@/domain/types';
import type {PlaceProjection} from '@/domain/location-types';
import type {WorldHubPlace} from './world-map-contract';
import {api} from './api-client';
import {WorldExperience} from './world-experience';

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
  async function save(){
    if(!session?.id)return;
    setBusy(true);setMessage('');
    try{
      const previous=session.body.slSecret;
      await api('/api/records','POST',{id:session.id,version:session.version,kind:'sitzungen',title:session.title,visibility:session.visibility,gmBody:session.gmBody||'',body:{...session.body,slSecret:{...(previous&&typeof previous==='object'?previous:{}),activePlaceId:selected||null}}});
      setMessage('Aktiver Schauplatz mit der Sitzung gespeichert.');onRefresh();
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <>
    <p>Der Regie-Schauplatz bleibt SL-vertraulich. Die Auswahl erteilt keine Spielerfreigabe.</p>
    <label className="field"><span>Aktiver Schauplatz</span><select aria-label="Aktiver Schauplatz" value={selected} onChange={e=>{setDraft(e.target.value);setMessage('');}}><option value="">Kein Schauplatz zugeordnet</option>{saved&&!places.some(p=>p.id===saved)&&<option value={saved}>Gespeicherter Ort derzeit nicht verfügbar</option>}{places.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
    <p role="status">{message|| (selected!==saved?'Ungespeicherte Schauplatzwahl':saved?'Gespeicherter Schauplatz':'Noch kein Schauplatz gespeichert')}</p>
    <button className="button primary" disabled={busy||!session?.id||selected===saved} onClick={()=>void save()}>Schauplatz speichern</button>
    {!session?.id&&<p>Bitte zuerst eine Sitzung speichern.</p>}
    {error&&<p role="alert">{error}</p>}
    {selected&&result?.id===selected?<WorldExperience a={a} dataScope={a.campaignId+':'+a.id+':gm'} projectionOverride={result.projection} embeddedLabel="SL-Regie · vertrauliches Ortsdossier"/>:selected?<p>Ortsdossier wird geladen beziehungsweise ist nicht verfügbar.</p>:<WorldExperience a={a} dataScope={a.campaignId+':'+a.id+':gm'}/>}
  </>;
}
