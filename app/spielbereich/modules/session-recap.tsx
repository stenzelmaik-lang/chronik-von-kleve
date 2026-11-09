"use client";
import {useEffect,useState} from 'react';
import type {Entry} from '@/domain/legacy';
import {api} from './api-client';
import {RichTextView} from './rich-text';
import {requestPlayerData} from './player-data-cache';
import {richTextToPlainText} from '@/domain/location-rich-text';
import sheet from './character-sheet/character-sheet.module.css';
import styles from './session-recap.module.css';

const excerpt=(text:string)=>{const plain=richTextToPlainText(text).replace(/\s+/g,' ').trim();return plain.length>220?plain.slice(0,220).replace(/\s\S*$/,'')+' …':plain;};
const when=(e:Entry)=>Date.parse(String(e.body.date||e.body.datetime||e.body.start||e.updated_at));

/** Rückblicke: without a chosen evening the list of past evenings (newest first), with one the released summary. */
export function SessionRecap({dataScope}:{dataScope:string}){
  const [records,setRecords]=useState<Entry[]|null>(null),[recaps,setRecaps]=useState<Entry[]>([]),[error,setError]=useState(''),[now,setNow]=useState(0),[id,setId]=useState<string|null>(()=>typeof window==='undefined'?null:new URLSearchParams(window.location.search).get('session'));
  useEffect(()=>{let live=true;Promise.all([requestPlayerData(dataScope,'/api/records?kind=sitzungen',()=>api<{records:Entry[]}>('/api/records?kind=sitzungen')),api<{records:Entry[]}>('/api/records?kind=chronik').catch(()=>({records:[] as Entry[]}))]).then(([data,chronik])=>{if(live){setNow(Date.now());setRecaps(chronik.records.filter(e=>e.body?.type==='rueckblick').sort((x,y)=>when(y)-when(x)));setRecords(data.records);}}).catch(e=>{if(live)setError((e as Error).message);});return()=>{live=false;};},[dataScope]);
  useEffect(()=>{const sync=()=>setId(new URLSearchParams(window.location.search).get('session'));window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[]);
  function choose(next:string|null){const url=new URL(window.location.href);if(next)url.searchParams.set('session',next);else url.searchParams.delete('session');history.pushState(null,'',url);setId(next);}
  if(error)return <p role="alert" className="error-box">{error}</p>;
  if(!records)return <p role="status">Rückblicke werden geladen …</p>;
  const past=records.filter(e=>Number.isFinite(when(e))&&when(e)<=now).sort((x,y)=>when(y)-when(x));
  // Older evenings appear only with a summary of their own; recaps of the SL come first.
  const withSummary=past.filter(e=>typeof e.body.summary==='string'&&e.body.summary.trim());
  const recap=id?recaps.find(e=>e.id===id):undefined;
  if(recap)return <div className={styles.reader}><button type="button" className={styles.back} onClick={()=>choose(null)}>← Alle Rückblicke</button><article className={`${sheet.sheet} ${sheet.wide} ${styles.page}`}><span className={sheet.corners} aria-hidden="true"/><header className={styles.pageHead}><p>Rückblick der Spielleitung · {new Date(when(recap)).toLocaleDateString('de-DE',{dateStyle:'long'})}</p><h2>{recap.title}</h2></header><div className={styles.text}><RichTextView value={String(recap.body.text||'')} readable/></div></article></div>;
  if(id){
    const entry=past.find(e=>e.id===id);
    if(!entry)return <><p role="alert" className="error-box">Dieser vergangene Spielabend ist nicht verfügbar.</p><button type="button" className="button" onClick={()=>choose(null)}>Alle Rückblicke</button></>;
    return <div className={styles.reader}><button type="button" className={styles.back} onClick={()=>choose(null)}>← Alle Rückblicke</button><article className={`${sheet.sheet} ${sheet.wide} ${styles.page}`}><span className={sheet.corners} aria-hidden="true"/><header className={styles.pageHead}><p>Spielabend · {new Date(when(entry)).toLocaleDateString('de-DE',{dateStyle:'long'})}</p><h2>{entry.title}</h2></header><div className={styles.text}><RichTextView value={String(entry.body.summary||entry.body.text||'Noch keine Zusammenfassung freigegeben.')} readable/></div></article></div>;
  }
  if(!withSummary.length&&!recaps.length)return <p className="muted">Noch hat die Spielleitung keinen Rückblick freigegeben.</p>;
  return <>{!!recaps.length&&<ul className={styles.cards} aria-label="Rückblicke der Spielleitung">{recaps.map(e=><li key={e.id}><button type="button" onClick={()=>choose(e.id!)}><small>{new Date(when(e)).toLocaleDateString('de-DE',{dateStyle:'long'})}</small><strong>{e.title}</strong><span>{excerpt(String(e.body.text||''))}</span><em>Weiterlesen →</em></button></li>)}</ul>}{!!withSummary.length&&<ul className={styles.cards} aria-label="Vergangene Spielabende">{withSummary.map(e=><li key={e.id}><button type="button" onClick={()=>choose(e.id!)}><small>{new Date(when(e)).toLocaleDateString('de-DE',{dateStyle:'long'})}</small><strong>{e.title}</strong><span>{excerpt(String(e.body.summary||''))}</span><em>Weiterlesen →</em></button></li>)}</ul>}</>;
}
