"use client";
/* eslint-disable @next/next/no-img-element -- Media URLs are authorized by the existing location projection. */

import {useState} from 'react';
import {locationPublicKey} from '@/domain/location-public-key';
import type {DiscoveryState,PlaceProjection} from '@/domain/location-types';
import {api,ApiError} from './api-client';
import {LocationMediaGallery} from './location-media-gallery';
import {RichTextView} from './rich-text';
import styles from './world-experience.module.css';

type Payload={projection:PlaceProjection};

function entryAt(projection:PlaceProjection|null,entityId:string){
 const location=projection?.location;
 if(!location)return null;
 if(entityId===location.id)return {title:location.title,image:location.image,texts:[location.summary,location.atmosphere],media:location.media};
 const key=locationPublicKey(entityId);
 const area=location.areas.find(area=>area.viewKey===key);
 if(area&&!area.redacted)return {title:area.title,image:area.image,texts:[area.playerHint],media:area.media};
 const room=location.areas.flatMap(area=>area.rooms).find(room=>room.viewKey===key);
 if(room)return {title:room.title,image:undefined,texts:[room.short],media:room.media};
 const note=location.knownInformation.find(item=>item.id===key);
 return note?{title:note.title,image:undefined,texts:[note.text],media:note.media}:null;
}

export function LocationReleasePreview({placeId,entityId,approvedRevisionId,canPublish,discovery,busy,onPublish}:{
 placeId:string;entityId:string;approvedRevisionId:string|null;canPublish:boolean;discovery:DiscoveryState;
 busy:boolean;onPublish:(revisionId:string)=>Promise<void>;
}){
 const [comparison,setComparison]=useState<{current:PlaceProjection|null;next:PlaceProjection|null;revisionId:string|null}|null>(null);
 const [loading,setLoading]=useState(false),[error,setError]=useState('');
 async function compare(){
  setLoading(true);setError('');setComparison(null);
  try{
   const current=api<Payload>('/api/locations?view=player&target=group&place='+encodeURIComponent(placeId)).catch(error=>{
    if(error instanceof ApiError&&error.status===404)return null;
    throw error;
   });
   const candidate=canPublish&&approvedRevisionId?api<Payload>('/api/cms/preview','POST',{revisionId:approvedRevisionId,discoveryState:discovery==='hidden'?'known':discovery}).catch(error=>{
    if(error instanceof ApiError&&error.status===404)return null;
    throw error;
   }):Promise.resolve(null);
   const [now,next]=await Promise.all([current,candidate]);
   setComparison({current:now?.projection??null,next:next?.projection??null,revisionId:canPublish?approvedRevisionId:null});
  }catch(error){setError(error instanceof Error?error.message:'Die Vorschau konnte nicht geladen werden.');}
  finally{setLoading(false);}
 }
 const now=comparison&&entryAt(comparison.current,entityId),next=comparison&&entryAt(comparison.next,entityId);
 return <div className={styles.releasePreview}>
  <button type="button" className={styles.secondaryButton} disabled={busy||loading} onClick={()=>void compare()}>{loading?'Spielerstand lädt …':'Freigabe für diesen Eintrag prüfen'}</button>
  {!approvedRevisionId&&<p>Ein neuer Stand muss in der Ortsredaktion gespeichert und genehmigt sein, bevor du ihn hier freischaltest.</p>}
  {error&&<p role="alert">{error}</p>}
  {comparison&&<div className={styles.releaseComparison}>
   <PreviewCard heading="Das sieht die Runde jetzt" entry={now}/>
   {canPublish&&<PreviewCard heading="Nach Freigabe dieses Eintrags" entry={next}/>}
   {canPublish&&!next&&<p>Der Eintrag ist in der Vorschau noch verborgen. Prüfe zuerst die übergeordneten Freigaben oder den Wissensstand.</p>}
   {next&&comparison.revisionId===approvedRevisionId&&approvedRevisionId&&<button type="button" className={styles.primaryAction} disabled={busy} onClick={()=>void onPublish(approvedRevisionId)}>Diesen Eintrag für die Runde freischalten</button>}
  </div>}
 </div>;
}

function PreviewCard({heading,entry}:{heading:string;entry:ReturnType<typeof entryAt>}){
 return <article><h4>{heading}</h4>{entry?<>
  <h5>{entry.title}</h5>
  {entry.image&&<img src={entry.image} alt=""/>}
  {entry.texts.map((text,index)=>text?<RichTextView key={index} value={text} readable flowing/>:null)}
  <LocationMediaGallery media={entry.media?.filter(item=>!item.hero)}/>
 </>:<p>Dieser Eintrag ist für die Runde nicht sichtbar.</p>}</article>;
}
