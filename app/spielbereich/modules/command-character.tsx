"use client";
import { useEffect, useState } from 'react';
import { api } from './api-client';
import { RatingGroup, attrsGroups, CharacterListReadout, type CharacterDetailProjection } from './character';

// Read-only context: all authorization and values come from the existing projector.
export function CommandCharacter({id}:{id:string}) {
  const [result,setResult]=useState<{id:string;data?:CharacterDetailProjection;error?:string}|null>(null);
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    let active=true;
    api<CharacterDetailProjection>('/api/character-detail?id='+encodeURIComponent(id))
      .then(data=>{if(active)setResult({id,data});})
      .catch(e=>{if(active)setResult({id,error:e.message});});
    return()=>{active=false;};
  },[id,reload]);
  const current=result?.id===id?result:null;
  if(!current)return <p role="status">Charakter wird geladen …</p>;
  if(current.error)return <><p role="alert">{current.error}</p><button className="button" onClick={()=>setReload(n=>n+1)}>Erneut laden</button></>;
  const p=current.data!;
  const text=(v:unknown)=>typeof v==='string'||typeof v==='number'?String(v):'Nicht hinterlegt';
  const object=(v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,number>:{};
  const blood=object(p.sheet.blood),willpower=object(p.sheet.willpower);
  return <div>
    <p className="eyebrow">GESCHÜTZTER CHARAKTERKONTEXT · NUR LESEN</p>
    <h3>{text(p.identity.name)}</h3>
    <p>{text(p.identity.clan)} · Generation {text(p.identity.generation)}</p>
    <div className="actions"><button className="button" onClick={()=>setReload(n=>n+1)}>Werte aktualisieren</button><a className="button" href="/spielbereich?bereich=charaktere" target="_blank" rel="noopener noreferrer">Ganzen Charakterbogen öffnen ↗</a></div>
    <dl className="command-vitals">
      <div><dt>Blut</dt><dd>{text(blood.current)} / {text(blood.max)}</dd></div>
      <div><dt>Willenskraft aktuell / permanent</dt><dd>{text(willpower.temporary)} / {text(willpower.permanent)}</dd></div>
      <div><dt>Menschlichkeit / Pfad</dt><dd>{text(p.sheet.humanity)} {text(p.sheet.humanityPath)==='Nicht hinterlegt'?'':text(p.sheet.humanityPath)}</dd></div>
    </dl>
    <details><summary>Attribute und Disziplinen</summary>{attrsGroups.map(([title,names])=><RatingGroup key={title} title={title} names={names} values={object(p.sheet.attributes)} disabled/>)}
    <CharacterListReadout label="Disziplinen" value={p.sheet.disciplines}/>
    </details><p>Änderungen erfolgen weiterhin über den vorhandenen Charakterbogen. Private Spieleraufzeichnungen werden hier nicht dargestellt.</p>
  </div>;
}


