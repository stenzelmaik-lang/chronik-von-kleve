"use client";
import { useEffect, useState } from 'react';
import { api } from './api-client';
import { RatingGroup, attrsGroups, CharacterListReadout, type CharacterDetailProjection } from './character';
import { CharacterProgression } from './character-progression';

// Read-only context: all authorization and values come from the existing projector.
export function CommandCharacter({id,version,onChanged,onDirty}:{id:string;version?:number;onChanged?:()=>void;onDirty?:(dirty:boolean)=>void}) {
  const [result,setResult]=useState<{id:string;data?:CharacterDetailProjection;error?:string}|null>(null);
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    let active=true;
    api<CharacterDetailProjection>('/api/character-detail?id='+encodeURIComponent(id)+'&view=sl')
      .then(data=>{if(active)setResult({id,data});})
      .catch(e=>{if(active)setResult({id,error:e.message});});
    return()=>{active=false;};
  },[id,reload,version]);
  const current=result?.id===id?result:null;
  if(!current)return <p role="status">Charakter wird geladen …</p>;
  if(current.error)return <><p role="alert">{current.error}</p><button className="button" onClick={()=>setReload(n=>n+1)}>Erneut laden</button></>;
  const p=current.data!;
  const text=(v:unknown)=>typeof v==='string'||typeof v==='number'?String(v):'Nicht hinterlegt';
  const object=(v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,number>:{};
  const blood=object(p.sheet.blood),willpower=object(p.sheet.willpower);
  return <div>
    <p className="eyebrow">SL-INSPEKTION · KEIN SPIELERWECHSEL</p>
    <h3>{text(p.identity.name)}</h3>
    <p>{text(p.identity.clan)} · Generation {text(p.identity.generation)}</p>
    <div className="actions"><button className="button" onClick={()=>setReload(n=>n+1)}>Werte aktualisieren</button><a className="button" href={"/sl/command-center?bereich=charaktere&character="+encodeURIComponent(id)} target="_blank" rel="noopener noreferrer">Ganzen Charakterbogen öffnen ↗</a></div>
    <p>Inventar-Inspektion wird als eigenes SL-Werkzeug angebunden; kein Wechsel in einen fremden Spielerbereich.</p>
    <dl className="command-vitals">
      <div><dt>Blut</dt><dd>{text(blood.current)} / {text(blood.max)}</dd></div>
      <div><dt>Willenskraft aktuell / permanent</dt><dd>{text(willpower.temporary)} / {text(willpower.permanent)}</dd></div>
      <div><dt>Menschlichkeit / Pfad</dt><dd>{text(p.sheet.humanity)} {text(p.sheet.humanityPath)==='Nicht hinterlegt'?'':text(p.sheet.humanityPath)}</dd></div>
      <div><dt>Gesundheit</dt><dd>{text(p.sheet.health&&typeof p.sheet.health==='object'&&'current' in p.sheet.health?p.sheet.health.current:'Gesund')}</dd></div>
      <div><dt>XP verfügbar</dt><dd>{text(p.progression.freeXp)}</dd></div>
    </dl>
    <details><summary>Attribute und Disziplinen</summary>{attrsGroups.map(([title,names])=><RatingGroup key={title} title={title} names={names} values={object(p.sheet.attributes)} disabled/>)}
    <CharacterListReadout label="Disziplinen" value={p.sheet.disciplines}/>
    </details><CharacterProgression key={id} id={id} revision={p.revision.version} manage onDirty={onDirty} onChanged={()=>{setReload(n=>n+1);onChanged?.();}}/>
  </div>;
}


