"use client";
import { useRef, useState } from 'react';
import type { Entry } from '@/domain/legacy';
import { api } from './api-client';
export function CommandNotes({session,onRefresh,onDirty,ask}:{session?:Entry;onRefresh:()=>void;onDirty:(dirty:boolean)=>void;ask:(text:string)=>Promise<boolean>}) {
  const [draft,setDraft]=useState<string|null>(null),[original,setOriginal]=useState<string|null>(null),[saving,setSaving]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
  const base=useRef<Entry|null>(null);
  const value=draft??session?.gmBody??'',dirty=draft!==null&&draft!==(original??session?.gmBody??'');
  async function save(){
    if(!session){setError('Speichere zuerst eine Sitzung in der Szene.');return;}
    if(saving||!dirty)return;
    setSaving(true);setError('');
    const revision=base.current??session;
    try{await api('/api/records','POST',{id:revision.id,version:revision.version,kind:'sitzungen',title:revision.title,visibility:revision.visibility,body:revision.body,gmBody:value});base.current=null;setDraft(null);setOriginal(null);onDirty(false);setSaved('Private Notizen gespeichert.');onRefresh();}
    catch(e){setError((e as Error).message);}finally{setSaving(false);}
  }
  return <><p>Nur für die Spielleitung. Beim Verlassen des Feldes wird gespeichert.</p><label className="field"><span>Deine Regienotizen</span><textarea rows={9} disabled={saving} value={value} onChange={e=>{if(draft===null){base.current=session??null;setOriginal(session?.gmBody??'');}setDraft(e.target.value);onDirty(e.target.value!==((base.current??session)?.gmBody||''));setSaved('');}} onBlur={e=>{if(e.relatedTarget?.getAttribute('data-note-save')!=='true')void save();}}/></label><p role="status">{saving?'Wird gespeichert …':dirty?'Noch nicht gespeichert':saved||'Gespeicherter Stand'}</p>{error&&<><p role="alert">{error} Deine Eingabe bleibt erhalten. Andere Sitzungsänderungen werden nicht überschrieben.</p>{session&&<details open><summary>Aktuellen Sitzungsstand vergleichen</summary><p className="preserve-lines">{session.gmBody||'Keine gespeicherte Regienotiz.'}</p><button data-note-save="true" className="button" disabled={saving} onClick={async()=>{if(!await ask('Deine Notiz bewusst über den angezeigten aktuellen Sitzungsstand speichern?'))return;base.current=session;setOriginal(session.gmBody??'');await save();}}>Meine Notiz nach Vergleich speichern</button></details>}</>}<button data-note-save="true" className="button" disabled={saving||!dirty} onClick={()=>void save()}>Jetzt speichern</button></>;
}
