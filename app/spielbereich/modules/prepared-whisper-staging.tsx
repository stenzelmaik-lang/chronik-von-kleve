"use client";
import {useRef,useState} from 'react';
import {Play,Plus,X,Volume2} from 'lucide-react';
import type {SceneWhisper} from '@/domain/story-scene';
import {VISION_PRESETS,VISION_TEMPOS,MESSAGE_LAYOUTS,PLANNED_LAYOUTS,MAX_FRAGMENTS,MAX_FRAGMENT_CHARS,presetById,tempoById,arrivalSoundLabel,mediaSectionOf,mediaSectionLabel,type VisionPresetId,type VisionTempoId,type MessageLayoutId} from '@/domain/personal-delivery';
import type {PreparationFile} from './protected-image-gallery';
import type {LatestPatch} from './prepared-whispers';
import {PreparationUpload} from './preparation-upload';
import {DeliveryPreview} from './spieltisch/delivery-stage';
import {playArrivalSound} from './spieltisch/delivery-sounds';
import styles from './prepared-whisper-staging.module.css';

/** Step 6: how a prepared vision or message is staged. Every option is optional: title, text and a look are enough. */
export function WhisperStaging({current,files,update,onUpload}:{current:SceneWhisper;files:PreparationFile[];update:(patch:Partial<SceneWhisper>)=>void;onUpload:LatestPatch}){
 const [preview,setPreview]=useState(false),[more,setMore]=useState(!!(current.fragments?.length||current.note));
 const section=mediaSectionOf(current.kind);
 // sounds come from the entry's own gallery section; a sound linked earlier from the general gallery stays selectable
 const audio=files.filter(f=>f.mime.startsWith('audio/')&&(f.section===section||f.id===current.audioFileId));
 const fragments=current.fragments||[];
 const setFragment=(i:number,value:string)=>update({fragments:fragments.map((f,k)=>k===i?value:f)});
 const layout=current.layout||'fax';
 const soundValue=current.audioFileId?'file:'+current.audioFileId:current.sound==='none'?'none':'builtin';
 const listening=useRef<HTMLAudioElement|null>(null);
 function listen(){
  listening.current?.pause();
  if(current.audioFileId){const a=new Audio('/api/files?id='+encodeURIComponent(current.audioFileId));a.volume=.7;listening.current=a;void a.play().catch(()=>undefined);}
  else void playArrivalSound(layout==='letter'?'letter':'fax');
 }
 const ownSounds=<>{audio.map(f=><option key={f.id} value={'file:'+f.id}>{'Eigener Ton: '+f.name}</option>)}</>;
 return <section className={styles.staging} aria-label="Inszenierung">
  {current.kind==='vision'?<>
   <fieldset className={styles.presets}><legend>Visionstyp</legend>
    {VISION_PRESETS.map(p=><label key={p.id} data-preset={p.id} className={styles.preset}><input type="radio" name={'preset-'+current.id} checked={presetById(current.preset).id===p.id} onChange={()=>update({preset:p.id as VisionPresetId})}/><span className={styles.swatch} aria-hidden="true"/><span><strong>{p.label}</strong><small>{p.mood}</small></span></label>)}
   </fieldset>
   <fieldset className={styles.tempo}><legend>Tempo der Texte</legend>
    {VISION_TEMPOS.map(t=><label key={t.id}><input type="radio" name={'tempo-'+current.id} checked={tempoById(current.tempo).id===t.id} onChange={()=>update({tempo:t.id as VisionTempoId})}/><span>{t.label}</span></label>)}
    <p className={styles.hint}>Spieler können jederzeit mit „Weiter“ vorspringen, wenn sie schneller lesen.</p>
   </fieldset>
   <div className={styles.sound}>
    <label>Ton oder Musik<select value={current.audioFileId||''} onChange={e=>update({audioFileId:e.target.value||undefined})}><option value="">Kein Ton</option>{audio.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
    <PreparationUpload kind="audio" section={section} label="Eigenen Ton hochladen" onUploaded={f=>onUpload(f,()=>({audioFileId:f.id}))}/>
    <p className={styles.hint}>Töne liegen in der eigenen Galerie „{mediaSectionLabel[section]}“. Sie laufen leise im Hintergrund, solange die Vision offen ist.</p>
   </div>
  </>
  :<div className={styles.letterFields}>
   <fieldset className={styles.presets}><legend>Darstellung</legend>{MESSAGE_LAYOUTS.map(l=><label key={l.id} data-layout={l.id} className={styles.preset}><input type="radio" name={'layout-'+current.id} checked={layout===l.id} onChange={()=>update({layout:l.id as MessageLayoutId})}/><span className={styles.swatch} aria-hidden="true"/><span><strong>{l.label}</strong><small>{l.description}</small></span></label>)}<p className={styles.hint}>Geplant: {PLANNED_LAYOUTS.join(', ')}.</p></fieldset>
   <label>Absender (optional, für Spieler sichtbar)<input maxLength={120} value={current.sender||''} placeholder="z. B. Unbekannter Anrufer, Kanzlei Vogt …" onChange={e=>update({sender:e.target.value})}/></label>
   <div className={styles.sound}>
    <div className={styles.soundRow}>
     <label>Geräusch beim Eintreffen<select value={soundValue} onChange={e=>{const v=e.target.value;update(v==='none'?{sound:'none',audioFileId:undefined}:v==='builtin'?{sound:'builtin',audioFileId:undefined}:{sound:'builtin',audioFileId:v.slice(5)});}}><option value="builtin">{arrivalSoundLabel(layout)+' (eingebaut)'}</option><option value="none">Kein Geräusch</option>{ownSounds}</select></label>
     <button type="button" disabled={soundValue==='none'} onClick={listen}><Volume2 size={15}/> Anhören</button>
    </div>
    <PreparationUpload kind="audio" section={section} label="Eigenes Geräusch hochladen" onUploaded={f=>onUpload(f,()=>({sound:'builtin',audioFileId:f.id}))}/>
   </div>
  </div>}
  <button type="button" className={styles.previewButton} onClick={()=>setPreview(true)}><Play size={15}/> Vorschau abspielen</button>
  <p className={styles.hint}>Die Vorschau läuft nur bei dir. Sie stellt nichts zu und erzeugt keinen Eintrag.</p>
  <details open={more} onToggle={e=>setMore((e.target as HTMLDetailsElement).open)}><summary>Weitere Möglichkeiten</summary>
   {current.kind==='vision'&&<div className={styles.fragments}><p className={styles.hint}>Textabschnitte erscheinen nacheinander. Ohne eigene Abschnitte werden die Absätze des Textes verwendet.</p>
    {fragments.map((f,i)=><div key={i} className={styles.fragment}><label>Abschnitt {i+1}<textarea maxLength={MAX_FRAGMENT_CHARS} rows={2} value={f} onChange={e=>setFragment(i,e.target.value)}/></label><button type="button" aria-label={'Abschnitt '+(i+1)+' entfernen'} onClick={()=>update({fragments:fragments.filter((_,k)=>k!==i)})}><X size={14}/></button></div>)}
    <button type="button" disabled={fragments.length>=MAX_FRAGMENTS} onClick={()=>update({fragments:[...fragments,'']})}><Plus size={14}/> Abschnitt hinzufügen</button>
   </div>}
   <label>Interne Notiz (nur Spielleitung)<textarea maxLength={2000} rows={2} value={current.note||''} onChange={e=>update({note:e.target.value})} placeholder="Wann und warum einsetzen?"/></label>
  </details>
  {preview&&<DeliveryPreview whisper={current} onClose={()=>setPreview(false)}/>}
 </section>;
}
