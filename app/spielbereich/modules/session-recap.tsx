"use client";
import {useEffect,useState} from 'react';
import type {Entry} from '@/domain/legacy';
import {api} from './api-client';
import {RichTextView} from './rich-text';
import {requestPlayerData} from './player-data-cache';
export function SessionRecap({dataScope}:{dataScope:string}){
  const [entry,setEntry]=useState<Entry|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{let live=true;const id=new URLSearchParams(window.location.search).get('session');requestPlayerData(dataScope,'/api/records?kind=sitzungen',()=>api<{records:Entry[]}>('/api/records?kind=sitzungen')).then(data=>{if(!live)return;const match=data.records.find(e=>e.id===id);const date=match?Date.parse(String(match.body.date||match.body.datetime||match.body.start||match.updated_at)):NaN;if(!match||!Number.isFinite(date)||date>Date.now())throw Error('Dieser vergangene Spielabend ist nicht verfügbar.');setEntry(match);setLoading(false);}).catch(e=>{if(live){setError(e.message);setLoading(false);}});return()=>{live=false;};},[dataScope]);
  if(loading)return <p role="status">Spielabend wird geladen …</p>;
  if(error)return <p role="alert" className="error-box">{error}</p>;
  return <article className="panel"><h2>{entry!.title}</h2><p className="muted">Freigegebener Rückblick · {new Date(String(entry!.body.date||entry!.updated_at)).toLocaleDateString('de-DE',{dateStyle:'long'})}</p><RichTextView value={String(entry!.body.summary||entry!.body.text||'Noch keine Zusammenfassung freigegeben.')}/></article>;
}
