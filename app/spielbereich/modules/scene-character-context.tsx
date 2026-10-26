"use client";
import { useEffect, useState } from 'react';
import type { Entry } from '@/domain/legacy';
import type { InventoryProjection } from '@/domain/inventory';
import { api } from './api-client';
import { placementText } from './inventory/shared';

// Read-only summaries of existing projections. Opening a tool never writes values.
export function SceneCharacterContext({characterId, inventory=false}:{characterId:string;inventory?:boolean}) {
  const [result,setResult]=useState<{key:string;character:Entry|null;items:InventoryProjection|null;error:string}|null>(null);
  const [retry,setRetry]=useState(0);
  const key=(inventory?'inventory:':'character:')+characterId;
  useEffect(()=>{
    let alive=true;
    if(!characterId)return;
    const query='?characterId='+encodeURIComponent(characterId);
    const load=async()=>{
      try { const [character,items]=await Promise.all([api<{character:Entry|null}>('/api/dashboard'+query),inventory?api<InventoryProjection>('/api/inventory'+query):Promise.resolve(null)]);
        if(alive)setResult({key,character:character.character,items,error:''});
      } catch(issue){if(alive)setResult({key,character:null,items:null,error:(issue as Error).message});}
    };
    void load();return()=>{alive=false;};
  },[characterId,inventory,key,retry]);
  if(!characterId)return <p>Wähle oben deinen Charakter für diese Kurzansicht. Die Vollseiten bleiben unverändert erreichbar.</p>;
  if(result?.key!==key)return <p role="status">Kurzansicht wird geladen …</p>;
  if(result.error)return <p role="alert">{result.error} <button className="button" onClick={()=>setRetry(value=>value+1)}>Erneut laden</button></p>;
  if(!result.character)return <p>Keine zugängliche Charakterakte.</p>;
  const character=result.character;
  return <section aria-label={inventory?'Inventar-Kurzansicht':'Charakter-Kurzansicht'}><h3>{character.title}</h3><p>Nur lesen · keine Buchung oder Ressourcenänderung.</p>
    {inventory?<>{result.items?.items.filter(item=>item.lifecycleStatus==='ACTIVE').map(item=><p key={item.id}><strong>{item.name}</strong> · {item.quantity} · {placementText(item)}</p>)}{!result.items?.items.some(item=>item.lifecycleStatus==='ACTIVE')&&<p>Keine aktiven Gegenstände für diese Ansicht erfasst.</p>}<a className="button" href={'/spielbereich?bereich=inventar&character='+encodeURIComponent(characterId)}>Vollständiges Inventar</a></>:<><dl>{[['Clan','clan'],['Generation','generation'],['Menschlichkeit','humanity'],['Blut','blood'],['Willenskraft','willpower']].map(([label,field])=><div key={field}><dt>{label}</dt><dd>{character.body[field]!==undefined?String(character.body[field]):'Nicht erfasst'}</dd></div>)}</dl><a className="button" href={'/spielbereich?bereich=charaktere&character='+encodeURIComponent(characterId)}>Vollständiger Charakterbogen</a></>}
  </section>;
}
