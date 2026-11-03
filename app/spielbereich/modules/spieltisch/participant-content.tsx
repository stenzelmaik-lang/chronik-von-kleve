'use client';
/* eslint-disable @next/next/no-img-element -- Private existing avatar and portrait endpoints. */
import {lazy,Suspense,useCallback,useEffect,useState} from 'react';
import type {Actor} from '@/domain/types';
import type {CharacterDetailProjection} from '../character';
import {api} from '../api-client';
import {RichTextView} from '../rich-text';
import {CharacterReadOnly} from './character-readonly';
import styles from './participants.module.css';
const Inventory=lazy(()=>import('../inventory').then(m=>({default:m.InventoryPanel})));
const Messages=lazy(()=>import('../message-center').then(m=>({default:m.MessageCenter})));
type Data={member?:{id:string;name:string;avatar:string|null;presentation?:{pronouns?:string;banner?:string;introduction?:string;playStyles?:string[]}|null};own?:boolean;characters:{id:string;name:string}[];character?:{id:string;name:string;portrait:string|null;descriptions:{kind:string;content:string}[];tagline?:string;introduction?:string;gallery?:{url:string;caption?:string}[]}|null;selectedCharacter?:string|null;projection?:CharacterDetailProjection};
export type ParticipantAction='profile'|'sheet'|'inventory'|'messages';
export function ParticipantContent({a,sessionId,memberId,action}:{a:Actor;sessionId:string;memberId:string;action:ParticipantAction}){
 const [data,setData]=useState<Data|null>(null),[characterId,setCharacterId]=useState<string|null>(null),[tab,setTab]=useState<'human'|'character'>('character'),[error,setError]=useState(''),[reload,setReload]=useState(0);
 const select=useCallback((id:string|null)=>setCharacterId(id),[]);
 useEffect(()=>{
  if(action==='messages')return;let active=true;queueMicrotask(()=>{if(active){setData(null);setError('');}});
  const path='/api/live-participants?sessionId='+encodeURIComponent(sessionId)+'&memberId='+encodeURIComponent(memberId)+'&view='+action+(characterId?'&characterId='+encodeURIComponent(characterId):'');
  api<Data>(path).then(next=>{if(active)setData(next);}).catch(e=>{if(active){setData(null);setError(e.message);}});return()=>{active=false;};
 },[action,memberId,sessionId,characterId,reload]);
 if(action==='messages')return <Suspense fallback={<p role="status">Nachrichten werden geladen …</p>}><Messages a={a} embedded initialRecipient={memberId===a.id?undefined:memberId}/></Suspense>;
 if(error)return <div role="alert"><p>{error}</p><button onClick={()=>setReload(n=>n+1)}>Erneut laden</button></div>;
 if(!data)return <p role="status">Ansicht wird geladen …</p>;
 const characterSelector=(data.characters.length>1||action==='profile'&&!data.selectedCharacter&&data.characters.length>0)&&<label className={styles.characterChoice}>Charakter<select aria-label="Charakter dieses Teilnehmers" value={characterId||data.selectedCharacter||''} onChange={e=>setCharacterId(e.target.value)}>{!data.selectedCharacter&&!characterId&&<option value="">Figur auswählen</option>}{data.characters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>;
 if(action==='profile'){
  const character=data.character;
  const person=data.member;
  const profile=person?.presentation;
  return <>
   <nav className={styles.sectionTabs} aria-label="Profilbereiche">
    <button aria-pressed={tab==='character'} onClick={()=>setTab('character')}>Figur</button>
    <button aria-pressed={tab==='human'} onClick={()=>setTab('human')}>Spielerprofil</button>
   </nav>
   {tab==='character'?<>
    {characterSelector}
    {character?<section className={styles.figureCard} aria-label="Figurenvorstellung">
     <header>
      {character.portrait&&<img className={styles.figureHero} src={character.portrait} alt=""/>}
      <div><p className={styles.caption}>Figur der Chronik</p><h3>{character.name}</h3>{character.tagline&&<p>{character.tagline}</p>}</div>
     </header>
     {(character.introduction||character.descriptions.length>0)&&<div className={styles.figureText}>
      <h4>Über die Figur</h4>
      {character.introduction&&<p>{character.introduction}</p>}
      {character.descriptions.map((block,index)=><RichTextView key={index} value={block.content}/>)}
     </div>}
     {!!character.gallery?.length&&<FigureGallery key={character.id} items={character.gallery}/>}
    </section>:<p>Für diesen Teilnehmer ist noch keine Figur freigegeben.</p>}
   </>:<section className={styles.figureCard} aria-label="Spielervorstellung">
    <header data-banner={profile?.banner??'fog'}>
     {person?.avatar&&<img className={styles.playerPortrait} src={person.avatar} alt=""/>}
     <div><p className={styles.caption}>Spielerprofil</p><h3>{person?.name}</h3>{profile?.pronouns&&<small>{profile.pronouns}</small>}</div>
    </header>
    <div className={styles.figureText}>
     {profile?.introduction?<p>{profile.introduction}</p>:<p>Für diese Runde ist keine Vorstellung hinterlegt.</p>}
     {!!profile?.playStyles?.length&&<ul className={styles.playerTraits}>{profile.playStyles.map(style=><li key={style}>{style}</li>)}</ul>}
    </div>
   </section>}
  </>;
 }
 return <>
  {characterSelector}
  {action==='sheet'?(data.projection?<CharacterReadOnly projection={data.projection}/>:<p>Kein berechtigter Charakterbogen vorhanden.</p>):
   data.selectedCharacter?<Suspense fallback={<p role="status">Inventar wird geladen …</p>}>
    <Inventory embedded inspection={a.gm&&memberId!==a.id} dataScope={a.campaignId+':'+a.id+':'+a.role+':stage:'+memberId} activeCharacterId={data.selectedCharacter} onActiveCharacterChange={select}/>
   </Suspense>:<p>Kein zugängliches Inventar vorhanden.</p>}
 </>;
}

function FigureGallery({items}:{items:NonNullable<NonNullable<Data['character']>['gallery']>}){
 const [index,setIndex]=useState(0);
 const current=Math.min(index,items.length-1);
 const image=items[current];
 return <section className={styles.figureGallery} aria-label="Figurengalerie">
  <h4>Galerie</h4>
  <figure><a href={image.url} target="_blank" rel="noreferrer" aria-label="Galeriebild in voller Größe öffnen"><img src={image.url} alt={image.caption||'Galeriebild der Figur'}/></a>
   {image.caption&&<figcaption>{image.caption}</figcaption>}
  </figure>
  {items.length>1&&<nav aria-label="Galeriebilder"><button type="button" disabled={current===0} onClick={()=>setIndex(current-1)}>Zurück</button><span aria-live="polite">{current+1} / {items.length}</span><button type="button" disabled={current===items.length-1} onClick={()=>setIndex(current+1)}>Weiter</button></nav>}
 </section>;
}
