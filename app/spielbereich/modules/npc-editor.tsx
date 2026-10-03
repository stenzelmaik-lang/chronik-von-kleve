"use client";
import {useEffect,useRef,useState} from 'react';
import type {Entity,Relationship} from '@/domain/types';
import type {ContentBlock} from '@/domain/content-blocks';
import {npcSaveSchema,npcProfilePatch,type NPCSave} from '@/domain/npc-authoring';
import {api} from './api-client';
import {entityTypeNames,relationNames} from './npc-dossier-data';
import styles from './npc-editor.module.css';

type DraftResponse={entity:Entity;revision:string;blocks:ContentBlock[];relationships:Relationship[]};
type Block=NPCSave['blocks'][number]&{key:string};
const canonNames:Record<string,string>={draft:'Entwurf',open:'Offen',confirmed:'Bestätigt',replaced:'Ersetzt'};
export function NPCEditor({id,onCancel,onSaved,onBusy}:{id?:string;onCancel:()=>void;onSaved:(id:string,title:string)=>void;onBusy:(busy:boolean)=>void}){
  const [loaded,setLoaded]=useState(!id),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
  const [draft,setDraft]=useState<NPCSave>({title:'',canonStatus:'draft',playState:'unplayed',defaultVisibility:'sl_secret',profile:{alias:'',summary:'',image:''},blocks:[],retainedRelationships:[],addedRelationships:[]});
  const [blocks,setBlocks]=useState<Block[]>([]),[relations,setRelations]=useState<Relationship[]>([]),[entities,setEntities]=useState<Entity[]>([]);
  const [target,setTarget]=useState(''),[relationType,setRelationType]=useState<NPCSave['addedRelationships'][number]['type']>('related_to'),[relationVisibility,setRelationVisibility]=useState<'sl'|'group'>('sl');
  const [removed,setRemoved]=useState<string[]>([]);
  const formRef=useRef<HTMLFormElement>(null);
  const originalProfile=useRef<NPCSave['profile']>({});
  useEffect(()=>{
    let alive=true;
    Promise.all([id?api<DraftResponse>('/api/entities/npc?id='+encodeURIComponent(id)):Promise.resolve(null),api<{entities:Entity[]}>('/api/entities')]).then(([data,list])=>{
      if(!alive)return;
      setEntities(list.entities.filter(e=>e.id!==id));
      if(data){
        const e=data.entity,profile:NPCSave['profile']={};
        for(const key of ['alias','summary','image'] as const)if(e.content[key]===undefined||typeof e.content[key]==='string')profile[key]=typeof e.content[key]==='string'?e.content[key] as string:'';
        originalProfile.current=profile;
        setDraft({id:e.id,revision:data.revision,title:e.title,canonStatus:e.canonStatus,playState:e.playState??null,defaultVisibility:e.defaultVisibility??null,profile,blocks:[],retainedRelationships:data.relationships.map(r=>r.id),addedRelationships:[]});
        setBlocks(data.blocks.map(b=>({id:b.id,key:b.id,kind:b.kind,content:b.content,visibility:b.visibility,position:b.position})));
        setRelations(data.relationships);
      }
      setError('');setLoaded(true);
    }).catch(e=>{if(alive){setLoaded(false);setError(e.message);}});
    return()=>{alive=false;};
  },[id,retry]);
  useEffect(()=>{if(loaded)formRef.current?.querySelector<HTMLInputElement>('#npc-title')?.focus({preventScroll:true});},[loaded]);
  function blockChange(key:string,patch:Partial<Block>){setBlocks(rows=>rows.map(b=>b.key===key?{...b,...patch}:b));}
  function move(index:number,delta:number){setBlocks(rows=>{const result=[...rows];[result[index],result[index+delta]]=[result[index+delta],result[index]];return result;});}
  async function save(event:React.FormEvent){
    event.preventDefault();
    const payload={...draft,profile:id?npcProfilePatch(draft.profile,originalProfile.current):draft.profile,blocks:blocks.map((b,position)=>({id:b.id,kind:b.kind,content:b.content,visibility:b.visibility,position})),retainedRelationships:relations.filter(r=>!removed.includes(r.id)).map(r=>r.id)};
    const parsed=npcSaveSchema.safeParse(payload);
    if(!parsed.success){setError(parsed.error.issues.map(i=>i.message).join(' '));return;}
    setBusy(true);onBusy(true);setError('');
    try{const saved=await api<{id:string;title:string}>('/api/entities/npc','POST',parsed.data);onSaved(saved.id,saved.title);}catch(e){setError(e instanceof Error?e.message:'Speichern fehlgeschlagen. Der Entwurf bleibt erhalten.');}finally{setBusy(false);onBusy(false);}
  }
  if(!loaded)return <section className={styles.editor}>{error?<><p role="alert">{error}</p><button className="button" onClick={()=>setRetry(n=>n+1)}>Erneut laden</button></>:<p role="status">Bearbeitungsstand wird geladen …</p>}<button className="button" onClick={onCancel}>Abbrechen</button></section>;
  const titleFor=(other:string)=>entities.find(e=>e.id===other)?.title??other;
  return <form ref={formRef} className={styles.editor} onSubmit={save}>
    <h1>{id?'NPC bearbeiten':'NPC anlegen'}</h1><p>Erst „Speichern“ übernimmt alle Änderungen. Neue NPCs und Inhaltsblöcke sind zunächst SL-intern.</p>
    {error&&<p role="alert" className="error-box">{error}</p>}
    <fieldset disabled={busy}><legend>Kernmetadaten</legend><div className={styles.fields}>
      <label htmlFor="npc-title">Name / Titel<input id="npc-title" required maxLength={200} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
      {'alias' in draft.profile&&<label htmlFor="npc-alias">Alias (optional)<input id="npc-alias" maxLength={200} value={draft.profile.alias} onChange={e=>setDraft({...draft,profile:{...draft.profile,alias:e.target.value}})}/></label>}
      <label htmlFor="npc-status">Status<select id="npc-status" value={draft.canonStatus} onChange={e=>setDraft({...draft,canonStatus:e.target.value as NPCSave['canonStatus']})}>{!canonNames[draft.canonStatus]&&<option value={draft.canonStatus}>{draft.canonStatus} (bestehender Legacy-Wert)</option>}{Object.entries(canonNames).map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>
      <label htmlFor="npc-play">Spielstatus<select id="npc-play" value={draft.playState??''} onChange={e=>setDraft({...draft,playState:(e.target.value||null) as NPCSave['playState']})}><option value="">Nicht festgelegt</option><option value="unplayed">Ungespielt</option><option value="played">Gespielt</option><option value="historical">Historisch</option></select></label>
      <label htmlFor="npc-visibility">NPC-Sichtbarkeit<select id="npc-visibility" value={draft.defaultVisibility??''} onChange={e=>setDraft({...draft,defaultVisibility:(e.target.value||null) as NPCSave['defaultVisibility']})}>{id&&<option value="">Bestehende Legacy-Freigabe beibehalten</option>}<option value="sl_secret">SL-INTERN · sl_secret</option><option value="player_visible">Spieler sichtbar · player_visible</option></select></label>
      {'image' in draft.profile&&<label htmlFor="npc-image">Bildreferenz (optional)<input id="npc-image" maxLength={500} placeholder="/api/files?id=… oder /images/…" value={draft.profile.image} onChange={e=>setDraft({...draft,profile:{...draft.profile,image:e.target.value}})}/><small>Vorhandenes Bild verwenden; kein neuer Upload.</small></label>}
    </div>{'summary' in draft.profile&&<label htmlFor="npc-summary">Kurzprofil (optional)<textarea id="npc-summary" rows={3} maxLength={2000} value={draft.profile.summary} onChange={e=>setDraft({...draft,profile:{...draft.profile,summary:e.target.value}})}/></label>}</fieldset>
    <fieldset disabled={busy}><legend>Content-Blöcke</legend><p>Die Sichtbarkeit eines Blocks gilt zusätzlich zur Freigabe des NPCs. Bestehender Entity-Text bleibt unverändert.</p>
      {blocks.map((b,index)=><section className={`${styles.block} ${b.visibility==='sl_secret'?styles.secret:''}`} key={b.key} aria-label={`Inhaltsblock ${index+1}`}><h2>Block {index+1} · {b.visibility==='sl_secret'?'SL-INTERN':'Spieler sichtbar'}</h2><div className={styles.fields}>
        <label htmlFor={'kind-'+b.key}>Art<input id={'kind-'+b.key} required maxLength={100} value={b.kind} onChange={e=>blockChange(b.key,{kind:e.target.value})}/></label>
        <label htmlFor={'visibility-'+b.key}>Block-Sichtbarkeit<select id={'visibility-'+b.key} value={b.visibility} onChange={e=>blockChange(b.key,{visibility:e.target.value as Block['visibility']})}><option value="sl_secret">SL-INTERN · sl_secret</option><option value="player_visible">Spieler sichtbar · player_visible</option></select></label>
      </div><label htmlFor={'content-'+b.key}>Inhalt<textarea id={'content-'+b.key} rows={5} maxLength={90000} value={b.content} onChange={e=>blockChange(b.key,{content:e.target.value})}/></label><div className={styles.actions}><button type="button" className="button" disabled={index===0} onClick={()=>move(index,-1)} aria-label={`Block ${index+1} nach oben`}>↑ Nach oben</button><button type="button" className="button" disabled={index===blocks.length-1} onClick={()=>move(index,1)} aria-label={`Block ${index+1} nach unten`}>↓ Nach unten</button><button type="button" className="button" onClick={()=>setBlocks(rows=>rows.filter(row=>row.key!==b.key))} aria-label={`Block ${index+1} entfernen`}>Entfernen</button></div></section>)}
      <button type="button" className="button" disabled={blocks.length>=100} onClick={()=>setBlocks(rows=>[...rows,{key:crypto.randomUUID(),kind:'bio',content:'',visibility:'sl_secret',position:rows.length}])}>Content-Block hinzufügen</button>
    </fieldset>
    <fieldset disabled={busy}><legend>Beziehungen</legend><ul className={styles.relations}>{relations.filter(r=>!removed.includes(r.id)).map(r=><li key={r.id}><span>{titleFor(r.sourceId===id?r.targetId:r.sourceId)} · {relationNames[r.type]??r.type} · {r.visibility==='group'?'Spieler sichtbar':r.visibility==='private'?'Privat (bestehend)':'SL-INTERN'}{r.targetId===id?' · eingehend':''}</span><button type="button" className="button" aria-label={`Beziehung zu ${titleFor(r.sourceId===id?r.targetId:r.sourceId)} entfernen`} onClick={()=>setRemoved(rows=>[...rows,r.id])}>Entfernen</button></li>)}{draft.addedRelationships.map((r,index)=><li key={index}><span>{titleFor(r.targetId)} · {relationNames[r.type]} · {r.visibility==='group'?'Spieler sichtbar':'SL-INTERN'} · neu</span><button type="button" className="button" aria-label={`Neue Beziehung zu ${titleFor(r.targetId)} entfernen`} onClick={()=>setDraft({...draft,addedRelationships:draft.addedRelationships.filter((_,i)=>i!==index)})}>Entfernen</button></li>)}</ul>
      <div className={styles.fields}><label htmlFor="npc-target">Verknüpftes Originalobjekt<select id="npc-target" value={target} onChange={e=>setTarget(e.target.value)}><option value="">Objekt auswählen …</option>{entities.map(e=><option key={e.id} value={e.id}>{e.title} · {entityTypeNames[e.type]??e.type}</option>)}</select></label><label htmlFor="npc-relation-type">Relationsart<select id="npc-relation-type" value={relationType} onChange={e=>setRelationType(e.target.value as typeof relationType)}>{Object.entries(relationNames).map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label><label htmlFor="npc-relation-visibility">Beziehungssichtbarkeit<select id="npc-relation-visibility" value={relationVisibility} onChange={e=>setRelationVisibility(e.target.value as typeof relationVisibility)}><option value="sl">SL-INTERN</option><option value="group">Spieler sichtbar (beide Objekte müssen freigegeben sein)</option></select></label></div>
      <button type="button" className="button" disabled={!target||draft.addedRelationships.length>=100} onClick={()=>{setDraft({...draft,addedRelationships:[...draft.addedRelationships,{targetId:target,type:relationType,visibility:relationVisibility}]});setTarget('');}}>Beziehung hinzufügen</button>
    </fieldset><div className={styles.actions}><button type="submit" className="button" disabled={busy}>{busy?'Wird gespeichert …':'Speichern'}</button><button type="button" className="button" disabled={busy} onClick={onCancel}>Abbrechen</button></div><p role="status">{busy?'Alle Änderungen werden gemeinsam gespeichert.':'Ungespeicherter Entwurf – noch keine Daten geändert.'}</p>
  </form>;
}
