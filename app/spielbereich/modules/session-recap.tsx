"use client";
import {useEffect,useState} from 'react';
import type {Entry} from '@/domain/legacy';
import {api} from './api-client';
import {RichTextView} from './rich-text';
import {requestPlayerData} from './player-data-cache';

const when=(e:Entry)=>Date.parse(String(e.body.date||e.body.datetime||e.body.start||e.updated_at));

/** Rückblicke: without a chosen evening the list of past evenings (newest first), with one the released summary. */
export function SessionRecap({dataScope}:{dataScope:string}){
  const [records,setRecords]=useState<Entry[]|null>(null),[error,setError]=useState(''),[now,setNow]=useState(0),[id,setId]=useState<string|null>(()=>typeof window==='undefined'?null:new URLSearchParams(window.location.search).get('session'));
  useEffect(()=>{let live=true;requestPlayerData(dataScope,'/api/records?kind=sitzungen',()=>api<{records:Entry[]}>('/api/records?kind=sitzungen')).then(data=>{if(live){setNow(Date.now());setRecords(data.records);}}).catch(e=>{if(live)setError((e as Error).message);});return()=>{live=false;};},[dataScope]);
  useEffect(()=>{const sync=()=>setId(new URLSearchParams(window.location.search).get('session'));window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[]);
  function choose(next:string|null){const url=new URL(window.location.href);if(next)url.searchParams.set('session',next);else url.searchParams.delete('session');history.pushState(null,'',url);setId(next);}
  if(error)return <p role="alert" className="error-box">{error}</p>;
  if(!records)return <p role="status">Rückblicke werden geladen …</p>;
  const past=records.filter(e=>Number.isFinite(when(e))&&when(e)<=now).sort((x,y)=>when(y)-when(x));
  if(id){
    const entry=past.find(e=>e.id===id);
    if(!entry)return <><p role="alert" className="error-box">Dieser vergangene Spielabend ist nicht verfügbar.</p><button type="button" className="button" onClick={()=>choose(null)}>Alle Rückblicke</button></>;
    return <article className="panel"><button type="button" className="button" onClick={()=>choose(null)}>Alle Rückblicke</button><h2>{entry.title}</h2><p className="muted">Freigegebener Rückblick · {new Date(when(entry)).toLocaleDateString('de-DE',{dateStyle:'long'})}</p><RichTextView value={String(entry.body.summary||entry.body.text||'Noch keine Zusammenfassung freigegeben.')}/></article>;
  }
  if(!past.length)return <p className="muted">Noch gibt es keinen vergangenen Spielabend.</p>;
  return <ul className="panel" style={{listStyle:'none',display:'grid',gap:8}} aria-label="Vergangene Spielabende">{past.map(e=><li key={e.id}><button type="button" className="button" onClick={()=>choose(e.id!)}>{e.title} · {new Date(when(e)).toLocaleDateString('de-DE',{dateStyle:'long'})}{e.body.summary?'':' · noch ohne Rückblick'}</button></li>)}</ul>;
}
