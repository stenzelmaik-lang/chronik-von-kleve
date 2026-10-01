"use client";
import { useState } from 'react';
import type { Entry } from '@/domain/legacy';
import { api } from './api-client';
export function CommandNotes({session,onRefresh,onDirty}:{session?:Entry;onRefresh:()=>void;onDirty:(dirty:boolean)=>void}) {
  const [draft,setDraft]=useState<string|null>(null),[saving,setSaving]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
  const value=draft??session?.gmBody??'',dirty=draft!==null&&draft!==(session?.gmBody||'');
  async function save(){
    if(!session){setError('Speichere zuerst eine Sitzung in der Szene.');return;}
    if(saving||!dirty)return;
    setSaving(true);setError('');
    try{await api('/api/records','POST',{id:session.id,version:session.version,kind:'sitzungen',title:session.title,visibility:session.visibility,body:session.body,gmBody:value});setDraft(null);onDirty(false);setSaved('Private Notizen gespeichert.');onRefresh();}
    catch(e){setError((e as Error).message);}finally{setSaving(false);}
  }
  return <><p>Nur für die Spielleitung. Beim Verlassen des Feldes wird gespeichert.</p><label className="field"><span>Deine Regienotizen</span><textarea rows={9} disabled={saving} value={value} onChange={e=>{setDraft(e.target.value);onDirty(e.target.value!==(session?.gmBody||''));setSaved('');}} onBlur={e=>{if(e.relatedTarget?.getAttribute('data-note-save')!=='true')void save();}}/></label><p role="status">{saving?'Wird gespeichert …':dirty?'Noch nicht gespeichert':saved||'Gespeicherter Stand'}</p>{error&&<p role="alert">{error} Deine Eingabe bleibt erhalten. Aktualisiere den Sitzungsstand vor einem erneuten Versuch.</p>}<button data-note-save="true" className="button" disabled={saving||!dirty} onClick={()=>void save()}>Jetzt speichern</button></>;
}
