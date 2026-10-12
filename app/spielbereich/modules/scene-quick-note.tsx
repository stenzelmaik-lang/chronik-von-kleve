"use client";
import { useEffect, useState } from 'react';
import type { Actor } from '@/domain/types';
import { api } from './api-client';
import { invalidatePlayerData, readPlayerData, storePlayerData } from './player-data-cache';

export function SceneQuickNote({a,onSaved,embedded=false}:{a:Actor;onSaved:()=>void;embedded?:boolean}) {
  const scope=`${a.campaignId}:${a.id}:${a.gm?'gm':'player'}:player`, draftKey='/ui/private-scene-note-draft';
  const draft=readPlayerData<{title:string;text:string}>(scope,draftKey)?.value;
  const [title,setTitle]=useState(draft?.title||''),[text,setText]=useState(draft?.text||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
  useEffect(()=>{storePlayerData(scope,draftKey,{title,text});},[scope,title,text]);
  useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(title||text)event.preventDefault();};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[title,text]);
  async function save(event:React.FormEvent) {
    event.preventDefault(); if(busy||!title.trim()||!text.trim())return;
    setBusy(true);setError('');
    try { await api('/api/records','POST',{kind:'notizen',title:title.trim(),visibility:'private',body:{text}});
      for(const surface of ['player','sl']) { const scope=`${a.campaignId}:${a.id}:${a.gm?'gm':'player'}:${surface}`;invalidatePlayerData(scope,'/api/dashboard');invalidatePlayerData(scope,'/api/records?kind=notizen'); }
      setTitle('');setText('');setSaved('Private Notiz gespeichert.');onSaved();
    } catch(issue) {setError((issue as Error).message);} finally {setBusy(false);}
  }
  const form = <form onSubmit={event=>void save(event)}><p>Persönlich für {a.name}. Keine Gruppenfreigabe; die Szene bleibt unverändert.</p><label className="field"><span>Titel der privaten Notiz</span><input value={title} maxLength={200} required disabled={busy} onChange={event=>{setTitle(event.target.value);setSaved('');}}/></label><label className="field"><span>Deine private Notiz</span><textarea rows={4} maxLength={90000} value={text} required disabled={busy} onChange={event=>{setText(event.target.value);setSaved('');}}/></label><button className="button" disabled={busy||!title.trim()||!text.trim()}>{busy?'Speichert …':'Privat speichern'}</button><button type="button" className="button" disabled={busy} onClick={()=>{setTitle('');setText('');setError('');setSaved('Entwurf verworfen.');}}>Entwurf verwerfen</button>{error&&<p role="alert">{error} Deine Eingabe bleibt erhalten.</p>}{saved&&<p role="status">{saved}</p>}</form>;
  return embedded ? form : <details><summary>Private Schnellnotiz · {a.name}</summary>{form}</details>;
}
