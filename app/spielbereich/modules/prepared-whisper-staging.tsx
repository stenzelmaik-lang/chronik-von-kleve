"use client";
import {useState} from 'react';
import {Play,Plus,X} from 'lucide-react';
import type {SceneWhisper} from '@/domain/story-scene';
import {VISION_PRESETS,MESSAGE_LAYOUTS,PLANNED_LAYOUTS,MAX_FRAGMENTS,MAX_FRAGMENT_CHARS,presetById,type VisionPresetId,type MessageLayoutId} from '@/domain/personal-delivery';
import type {PreparationFile} from './protected-image-gallery';
import {DeliveryPreview} from './spieltisch/delivery-stage';
import styles from './prepared-whisper-staging.module.css';

/** Step 6: how a prepared vision or message is staged. Every option is optional: title, text and a look are enough. */
export function WhisperStaging({current,files,update}:{current:SceneWhisper;files:PreparationFile[];update:(patch:Partial<SceneWhisper>)=>void}){
 const [preview,setPreview]=useState(false),[more,setMore]=useState(!!(current.fragments?.length||current.audioFileId||current.note));
 const audio=files.filter(f=>f.mime.startsWith('audio/'));
 const fragments=current.fragments||[];
 const setFragment=(i:number,value:string)=>update({fragments:fragments.map((f,k)=>k===i?value:f)});
 return <section className={styles.staging} aria-label="Inszenierung">
  {current.kind==='vision'?<fieldset className={styles.presets}><legend>Visionstyp</legend>
   {VISION_PRESETS.map(p=><label key={p.id} data-preset={p.id} className={styles.preset}><input type="radio" name={'preset-'+current.id} checked={presetById(current.preset).id===p.id} onChange={()=>update({preset:p.id as VisionPresetId})}/><span className={styles.swatch} aria-hidden="true"/><span><strong>{p.label}</strong><small>{p.mood}</small></span></label>)}
  </fieldset>
  :<div className={styles.letterFields}>
   <fieldset className={styles.presets}><legend>Darstellung</legend>{MESSAGE_LAYOUTS.map(l=><label key={l.id} data-layout={l.id} className={styles.preset}><input type="radio" name={'layout-'+current.id} checked={(current.layout||'fax')===l.id} onChange={()=>update({layout:l.id as MessageLayoutId})}/><span className={styles.swatch} aria-hidden="true"/><span><strong>{l.label}</strong><small>{l.description}</small></span></label>)}<p className={styles.hint}>Geplant: {PLANNED_LAYOUTS.join(', ')}.</p></fieldset>
   <label>Absender (optional, für Spieler sichtbar)<input maxLength={120} value={current.sender||''} placeholder="z. B. Unbekannter Anrufer, Kanzlei Vogt …" onChange={e=>update({sender:e.target.value})}/></label>
  </div>}
  <button type="button" className={styles.previewButton} onClick={()=>setPreview(true)}><Play size={15}/> Vorschau abspielen</button>
  <p className={styles.hint}>Die Vorschau läuft nur bei dir. Sie stellt nichts zu und erzeugt keinen Eintrag.</p>
  <details open={more} onToggle={e=>setMore((e.target as HTMLDetailsElement).open)}><summary>Weitere Möglichkeiten</summary>
   {current.kind==='vision'&&<div className={styles.fragments}><p className={styles.hint}>Textabschnitte erscheinen nacheinander. Ohne eigene Abschnitte werden die Absätze des Textes verwendet.</p>
    {fragments.map((f,i)=><div key={i} className={styles.fragment}><label>Abschnitt {i+1}<textarea maxLength={MAX_FRAGMENT_CHARS} rows={2} value={f} onChange={e=>setFragment(i,e.target.value)}/></label><button type="button" aria-label={'Abschnitt '+(i+1)+' entfernen'} onClick={()=>update({fragments:fragments.filter((_,k)=>k!==i)})}><X size={14}/></button></div>)}
    <button type="button" disabled={fragments.length>=MAX_FRAGMENTS} onClick={()=>update({fragments:[...fragments,'']})}><Plus size={14}/> Abschnitt hinzufügen</button>
   </div>}
   {current.kind==='vision'&&<label>Ton oder Musik (optional)<select value={current.audioFileId||''} onChange={e=>update({audioFileId:e.target.value||undefined})}><option value="">Kein Ton</option>{audio.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>{!audio.length&&<small className={styles.hint}>Tondateien lädst du in der Galerie hoch.</small>}</label>}
   <label>Interne Notiz (nur Spielleitung)<textarea maxLength={2000} rows={2} value={current.note||''} onChange={e=>update({note:e.target.value})} placeholder="Wann und warum einsetzen?"/></label>
  </details>
  {preview&&<DeliveryPreview whisper={current} onClose={()=>setPreview(false)}/>}
 </section>;
}
