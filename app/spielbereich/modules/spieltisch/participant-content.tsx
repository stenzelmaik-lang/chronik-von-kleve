'use client';
/* eslint-disable @next/next/no-img-element -- Private existing avatar and portrait endpoints. */
import {lazy,Suspense,useCallback,useEffect,useState} from 'react';
import type {Actor} from '@/domain/types';
import type {CharacterDetailProjection} from '../character';
import type {SharedProfile} from '@/domain/character-profile';
import {api} from '../api-client';
import {RichTextView} from '../rich-text';
import {CharacterReadOnly} from './character-readonly';
import styles from './participants.module.css';
const Inventory=lazy(()=>import('../inventory').then(m=>({default:m.InventoryPanel})));
const Messages=lazy(()=>import('../message-center').then(m=>({default:m.MessageCenter})));
const Notebook=lazy(()=>import('../notebook/notebook').then(m=>({default:m.Notebook})));
type Data={member?:{id:string;name:string;avatar:string|null;presentation?:{pronouns?:string;banner?:string;introduction?:string;playStyles?:string[]}|null};own?:boolean;characters:{id:string;name:string}[];character?:{id:string;name:string;portrait:string|null;profile?:SharedProfile;descriptions:{kind:string;content:string}[];tagline?:string;introduction?:string;gallery?:{url:string;caption?:string}[]}|null;selectedCharacter?:string|null;projection?:CharacterDetailProjection};
export type ParticipantAction='profile'|'gallery'|'sheet'|'inventory'|'messages'|'notebook';
export function ParticipantContent({a,sessionId,memberId,action}:{a:Actor;sessionId:string;memberId:string;action:ParticipantAction}){
 const [data,setData]=useState<Data|null>(null),[characterId,setCharacterId]=useState<string|null>(null),[tab,setTab]=useState<'human'|'character'>('character'),[error,setError]=useState(''),[reload,setReload]=useState(0);
 const select=useCallback((id:string|null)=>setCharacterId(id),[]);
 useEffect(()=>{
  if(action==='messages'||action==='notebook')return;let active=true;queueMicrotask(()=>{if(active){setData(null);setError('');}});
  const path='/api/live-participants?sessionId='+encodeURIComponent(sessionId)+'&memberId='+encodeURIComponent(memberId)+'&view='+(action==='gallery'?'profile':action)+(characterId?'&characterId='+encodeURIComponent(characterId):'');
  api<Data>(path).then(next=>{if(active)setData(next);}).catch(e=>{if(active){setData(null);setError(e.message);}});return()=>{active=false;};
 },[action,memberId,sessionId,characterId,reload]);
 if(action==='notebook')return <Suspense fallback={<p role="status">Notizbuch wird geladen …</p>}><Notebook a={a} layout="narrow" memberId={memberId}/></Suspense>;
 if(action==='messages')return <Suspense fallback={<p role="status">Nachrichten werden geladen …</p>}><Messages a={a} embedded initialRecipient={memberId===a.id?undefined:memberId}/></Suspense>;
 if(error)return <div role="alert"><p>{error}</p><button onClick={()=>setReload(n=>n+1)}>Erneut laden</button></div>;
 if(!data)return <p role="status">Ansicht wird geladen …</p>;
 if(action==='gallery'){
  // The character gallery at the table: portrait first, then every image the owner shared with the group.
  const character=data.character;
  const items=character?[...(character.portrait?[{url:character.portrait,caption:'Porträt'}]:[]),...(character.gallery??[])]:[];
  return <>{items.length?<FigureGallery key={character!.id} items={items} title={'Galerie · '+character!.name}/>:<p>Für diese Figur sind noch keine Bilder für die Gruppe freigegeben. Bilder gibst du im Charakterprofil unter „Porträt & Referenzen“ frei.</p>}</>;
 }
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
     {character.profile?.description&&<div className={styles.figureText}><h4>Beschreibung</h4><dl className={styles.profileFacts}>{character.profile.description.map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></div>}
     {character.profile?.appearance&&<div className={styles.figureText}>{!character.profile.description&&<h4>Beschreibung</h4>}<p className={styles.preserve}>{character.profile.appearance}</p></div>}
     {character.profile?.story&&<div className={styles.figureText}><h4>Hintergrundgeschichte</h4><RichTextView value={character.profile.story}/></div>}
     {character.profile?.drive&&<div className={styles.figureText}><h4>So spiele ich ihn</h4><RichTextView value={character.profile.drive}/></div>}
     {character.profile?.allies&&<div className={styles.figureText}><h4>Verbündete & Kontakte</h4><p className={styles.preserve}>{character.profile.allies}</p></div>}
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
  
  {action==='sheet'?(data.projection?<CharacterReadOnly projection={data.projection}/>:<p>Kein berechtigter Charakterbogen vorhanden.</p>):
   data.selectedCharacter?<Suspense fallback={<p role="status">Inventar wird geladen …</p>}>
    <Inventory embedded inspection={a.gm&&memberId!==a.id} dataScope={a.campaignId+':'+a.id+':'+a.role+':stage:'+memberId} activeCharacterId={data.selectedCharacter} onActiveCharacterChange={select}/>
   </Suspense>:<p>Kein zugängliches Inventar vorhanden.</p>}
 </>;
}

function FigureGallery({items,title='Galerie'}:{items:{url:string;caption?:string}[];title?:string}){
 const [index,setIndex]=useState(0);
 const current=Math.min(index,items.length-1);
 const image=items[current];
 return <section className={styles.figureGallery} aria-label="Figurengalerie">
  <h4>{title}</h4>
  <figure><a href={image.url} target="_blank" rel="noreferrer" aria-label="Galeriebild in voller Größe öffnen"><img src={image.url} alt={image.caption||'Galeriebild der Figur'}/></a>
   {image.caption&&<figcaption>{image.caption}</figcaption>}
  </figure>
  {items.length>1&&<nav aria-label="Galeriebilder"><button type="button" disabled={current===0} onClick={()=>setIndex(current-1)}>Zurück</button><span aria-live="polite">{current+1} / {items.length}</span><button type="button" disabled={current===items.length-1} onClick={()=>setIndex(current+1)}>Weiter</button></nav>}
  {items.length>1&&<div className={styles.galleryThumbs} role="group" aria-label="Bild wählen">{items.map((item,i)=><button type="button" key={item.url} aria-pressed={i===current} aria-label={'Bild '+(i+1)+(item.caption?': '+item.caption:'')} onClick={()=>setIndex(i)}><img src={item.url} alt=""/></button>)}</div>}
 </section>;
}
