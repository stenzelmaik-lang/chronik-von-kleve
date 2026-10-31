"use client";
import {useEffect,useRef,useState} from 'react';
import {Play,Pause,SkipForward,SkipBack,Square,ListMusic,Bookmark,Trash2} from 'lucide-react';
import {youtubeVideoId,youtubeTracksMax} from '@/domain/live-stage';
import type {Snapshot} from './types';
import styles from './regie-window.module.css';

type Run=(body:Record<string,unknown>,done?:string)=>Promise<boolean>;
type Saved={id:string;label:string;links:string[]};
const savedKey=(actorId:string)=>'chroniplay:ambiente-liste:'+actorId;
function readSaved(actorId:string):Saved[]{try{const v=JSON.parse(window.localStorage.getItem(savedKey(actorId))||'[]');return Array.isArray(v)?v.filter((x):x is Saved=>typeof x?.id==='string'&&typeof x?.label==='string'&&Array.isArray(x?.links)).slice(0,40):[];}catch{return [];}}
/** One link per line; an optional title before a „|“ (e.g. „Wald | https://youtu.be/…“). */
function parseLines(text:string){return text.split('\n').map(l=>l.trim()).filter(Boolean).slice(0,youtubeTracksMax).map((line,i)=>{const [a,b]=line.includes('|')?line.split('|',2).map(x=>x.trim()):['',line];return {video:b,title:a||'Titel '+(i+1),ok:!!youtubeVideoId(b)};});}

/**
 * Ambience control in the Regie: play/pause, next/previous, choosing a track and the base volume for everyone
 * (each viewer keeps their own scaling), the scene's prepared playlist and spontaneous links or saved ambiences.
 * Commands go through the stage API; only the GM may send them.
 */
export function RegieAmbience({youtube,sceneTracks,sceneTitle,actorId,busy,run}:{youtube:Snapshot['youtube'];sceneTracks:{id:string;title:string;videoId:string}[];sceneTitle:string;actorId:string;busy:boolean;run:Run}){
 const [lines,setLines]=useState(''),[label,setLabel]=useState(''),[saved,setSaved]=useState<Saved[]>([]),[volume,setVolume]=useState<number|null>(null),[problem,setProblem]=useState('');
 const timer=useRef(0);
 useEffect(()=>{queueMicrotask(()=>setSaved(readSaved(actorId)));},[actorId]);
 const store=(list:Saved[])=>{setSaved(list);try{window.localStorage.setItem(savedKey(actorId),JSON.stringify(list));}catch{/* storage unavailable */}};
 const tracks=youtube?.tracks?.length?youtube.tracks:youtube?[{videoId:youtube.videoId,title:youtube.title}]:[];
 const index=youtube?.index??0,playing=youtube?.playing??true,base=volume??youtube?.volume??25;
 const control=(op:string,extra:Record<string,unknown>={},done='')=>run({action:'youtubeControl',op,...extra},done);
 function setBase(v:number){setVolume(v);window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>{void control('volume',{volume:v},'Grundpegel '+v+' % für alle.').then(()=>setVolume(null));},450);}
 function startLines(text:string,name:string){const list=parseLines(text);if(!list.length)return;if(list.some(t=>!t.ok)){setProblem('Mindestens eine Zeile ist kein gültiger YouTube-Link.');return;}setProblem('');
  void run({action:'youtubeList',tracks:list.map(t=>({video:t.video,title:t.title})),label:name.trim()||'Ambiente'},'Ambiente „'+(name.trim()||'Ambiente')+'“ startet für alle.');}
 return <div className={styles.ambienceControl}>
  <p className={styles.ambienceState} data-youtube-state="" data-playing={!!youtube&&playing}>{youtube?<>{playing?'Läuft':'Pausiert'} für alle: <b>{youtube.label||youtube.title}</b>{tracks.length>1?` · Titel ${index+1}/${tracks.length}: ${tracks[index]?.title}`:''}</>:'Keine Ambiente-Musik'}</p>
  {youtube&&<>
   <div className={styles.actions}>
    <button type="button" className={styles.primary} disabled={busy} onClick={()=>void control(playing?'pause':'play',{},playing?'Ambiente pausiert.':'Ambiente läuft.')}>{playing?<><Pause/> Pause für alle</>:<><Play/> Abspielen für alle</>}</button>
    {tracks.length>1&&<><button type="button" aria-label="Vorheriger Titel" disabled={busy} onClick={()=>void control('previous',{},'Vorheriger Titel.')}><SkipBack/></button><button type="button" aria-label="Nächster Titel" disabled={busy} onClick={()=>void control('next',{},'Nächster Titel.')}><SkipForward/></button></>}
    <button type="button" disabled={busy} onClick={()=>void run({action:'youtube',video:null},'Ambiente gestoppt.')}><Square/> Stoppen</button>
   </div>
   <label className={styles.vitalsSetting}>Grundpegel für alle: {base} % <input type="range" aria-label="Grundpegel für alle" min={0} max={100} step={5} value={base} disabled={busy} onChange={e=>setBase(Number(e.target.value))}/></label>
   {tracks.length>1&&<ol className={styles.compact} aria-label="Titel der laufenden Playlist">{tracks.map((t,i)=><li key={i+t.videoId} data-active={i===index}><span>{i+1}. {t.title}</span><button type="button" aria-label={'Titel wählen: '+t.title} disabled={busy||i===index} onClick={()=>void control('select',{index:i},'Titel „'+t.title+'“ für alle.')}><Play/></button></li>)}</ol>}
  </>}
  {!!sceneTracks.length&&<div className={styles.ambienceGroup}><h4><ListMusic size={14}/> Playlist der Szene ({sceneTracks.length})</h4>
   <p className={styles.muted}>Startet beim Szenenstart automatisch und läuft in Schleife.</p>
   <button type="button" disabled={busy} onClick={()=>void run({action:'youtubeList',tracks:sceneTracks.map(t=>({video:t.videoId,title:t.title})),label:sceneTitle},'Playlist der Szene startet.')}><Play/> Playlist der Szene starten</button></div>}
  <form className={styles.pager} onSubmit={e=>{e.preventDefault();startLines(lines,label);}}>
   <label>Spontan: YouTube-Links (einer pro Zeile, optional „Titel | Link“)<textarea aria-label="YouTube-Links" rows={3} value={lines} onChange={e=>{setLines(e.target.value);setProblem('');}} placeholder={'Wald | https://youtu.be/…\nhttps://www.youtube.com/watch?v=…'}/></label>
   <label>Name<input className={styles.search} aria-label="Name des Ambientes" maxLength={200} value={label} onChange={e=>setLabel(e.target.value)} placeholder="z. B. Bar, Wald, Stadt"/></label>
   {problem&&<p className={styles.muted} role="alert">{problem}</p>}
   <div className={styles.actions}><button type="submit" className={styles.primary} disabled={busy||!lines.trim()}><Play/> Für alle starten</button>
    <button type="button" disabled={!lines.trim()||!parseLines(lines).every(t=>t.ok)} onClick={()=>{store([...saved,{id:crypto.randomUUID(),label:label.trim()||'Ambiente',links:lines.split('\n').map(l=>l.trim()).filter(Boolean)}]);}}><Bookmark/> Merken</button></div>
  </form>
  {!!saved.length&&<div className={styles.ambienceGroup}><h4><Bookmark size={14}/> Gemerkte Ambiente-Klänge (dieser Browser)</h4>
   <ul className={styles.compact} aria-label="Gemerkte Ambiente-Klänge">{saved.map(x=><li key={x.id}><span>{x.label}<small>{x.links.length} Link{x.links.length===1?'':'s'}</small></span><button type="button" disabled={busy} onClick={()=>startLines(x.links.join('\n'),x.label)}><Play/> Starten</button><button type="button" aria-label={x.label+' entfernen'} onClick={()=>store(saved.filter(y=>y.id!==x.id))}><Trash2/></button></li>)}</ul></div>}
 </div>;
}
