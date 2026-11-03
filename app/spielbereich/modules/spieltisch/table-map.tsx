/* eslint-disable @next/next/no-img-element -- Location images use authenticated campaign asset URLs. */
"use client";

import {lazy, Suspense, useEffect, useMemo, useRef, useState, type Ref} from 'react';
import {ArrowLeft, Compass, MapPin, X} from 'lucide-react';
import type {PlaceProjection} from '@/domain/location-types';
import {api} from '../api-client';
import {RichTextView} from '../rich-text';
import {mapMarkersForPlaces, playerMapPlaces, type WorldHubPlace} from '../world-map-contract';
import styles from './stage.module.css';

const WorldMap = lazy(async () => ({default:(await import('../world-maplibre')).WorldMapLibre}));

function useLocationData<T>(query:string){
 const [data,setData]=useState<T>();
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  let current=true;
  api<T>('/api/locations?view=player&'+query).then(value=>{if(current)setData(value);}).catch(()=>{if(current)setFailed(true);});
  return()=>{current=false;};
 },[query]);
 return {data,failed};
}

export function TableMap({panelRef,gm,onClose,onSelect}:{panelRef:Ref<HTMLElement>;gm:boolean;onClose:()=>void;onSelect:(id:string)=>void}){
 const {data,failed}=useLocationData<{places:WorldHubPlace[]}>('target='+(gm?'group':'player'));
 const places=useMemo(()=>playerMapPlaces(data?.places||[]),[data]);
 const markers=useMemo(()=>mapMarkersForPlaces(places),[places]);
 const ids=useMemo(()=>markers.map(marker=>marker.id),[markers]);
 const [hovered,setHovered]=useState<string|null>(null);
 const [mapState,setMapState]=useState<'loading'|'ready'|'error'>('loading');
 const credits=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{
  if(mapState!=='ready')return;
  const timer=window.setTimeout(()=>{
   const element=credits.current;
   if(element&&!element.matches(':hover, :focus-within'))element.open=false;
  },5000);
  return()=>window.clearTimeout(timer);
 },[mapState]);
 const preview=places.find(place=>place.id===hovered);
 return <div className={styles.tableMapMount}><section ref={panelRef} className={styles.tableMap} aria-label="Weltkarte auf dem Spieltisch">
  <header><Compass size={29} aria-hidden="true"/><div><small>CHRONIK VON KLEVE · REGION I</small><h2>Kreis Kleve</h2></div><button type="button" aria-label="Weltkarte schließen" onClick={onClose}><X size={19}/></button></header>
  {failed?<p role="alert">Kartenorte konnten nicht geladen werden.</p>:!data?<p role="status">Karte wird geladen …</p>:
   <div className={styles.tableMapCanvas}>
    {mapState==='error'?<div className={styles.tableMapFallback}><p role="status">Die Grundkarte ist gerade nicht verfügbar.</p>{markers.map(marker=><button type="button" key={marker.id} onClick={()=>onSelect(marker.id)}><MapPin size={15}/> {marker.title}</button>)}</div>:
     <Suspense fallback={<p role="status">Karte wird geladen …</p>}><WorldMap compact places={markers} visibleIds={ids} selectedId="" hoveredId={hovered} onHover={setHovered} onSelect={onSelect} onFocusPlace={onSelect} onStateChange={setMapState}/></Suspense>}
    {mapState==='ready'&&<span className={styles.atlasSeal} aria-hidden="true">N<Compass size={24}/></span>}
    {preview&&mapState==='ready'&&<div className={styles.tableMapPreview}>{preview.image&&<img src={preview.image} alt=""/>}<strong>{preview.title}</strong></div>}
   </div>}
 </section>
  {mapState==='ready'&&<details ref={credits} open className={styles.tableMapCredits}>
   <summary>Kartenquellen</summary>
   <div>
   <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a>
   <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
   </div>
  </details>}
 </div>;
}

export function TablePlace({id,gm,onBack}:{id:string;gm:boolean;onBack:()=>void}){
 const {data,failed}=useLocationData<{projection:PlaceProjection}>('target='+(gm?'group':'player')+'&place='+encodeURIComponent(id));
 const place=data?.projection.location;
 return <>
  <button type="button" onClick={onBack}><ArrowLeft size={16}/> Zur Karte</button>
  {failed?<p role="alert">Der Ort konnte nicht geladen werden.</p>:!place?<p role="status">Ort wird geladen …</p>:
   <article className={styles.tablePlace}>
    <h2>{place.title}</h2>
    {place.image&&<img src={place.image} alt={place.title}/>}
     {(place.atmosphere||place.summary)&&<section>
      <h3>Dein Eindruck</h3>
      <RichTextView value={place.atmosphere||place.summary} readable flowing/>
     </section>}
     {(place.address||place.district)&&<dl>
      {place.address&&<><dt>Adresse</dt><dd>{place.address}</dd></>}
      {place.district&&<><dt>Gebiet</dt><dd>{place.district}</dd></>}
     </dl>}
   </article>}
 </>;
}
