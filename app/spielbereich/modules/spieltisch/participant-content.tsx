'use client';
/* eslint-disable @next/next/no-img-element -- Private existing avatar and portrait endpoints. */
import {lazy,Suspense,useCallback,useEffect,useState} from 'react';
import type {Actor} from '@/domain/types';
import type {InventoryItem} from '@/domain/inventory';
import type {CharacterDetailProjection} from '../character';
import {api} from '../api-client';
import {RichTextView} from '../rich-text';
import {ItemTile} from '../inventory/item-tile';
import {CharacterReadOnly} from './character-readonly';
import styles from './participants.module.css';
const Inventory=lazy(()=>import('../inventory').then(m=>({default:m.InventoryPanel})));
const Messages=lazy(()=>import('../message-center').then(m=>({default:m.MessageCenter})));
type Data={member?:{id:string;name:string;avatar:string|null};own?:boolean;characters:{id:string;name:string}[];character?:{id:string;name:string;portrait:string|null;descriptions:{kind:string;content:string}[]}|null;selectedCharacter?:string|null;projection?:CharacterDetailProjection;publicOnly?:boolean;items?:InventoryItem[]};
export type ParticipantAction='profile'|'sheet'|'inventory'|'messages';
export function ParticipantContent({a,sessionId,memberId,action}:{a:Actor;sessionId:string;memberId:string;action:ParticipantAction}){
 const [data,setData]=useState<Data|null>(null),[characterId,setCharacterId]=useState<string|null>(null),[tab,setTab]=useState<'human'|'character'>('human'),[error,setError]=useState(''),[reload,setReload]=useState(0),[selectedItem,setSelectedItem]=useState('');
 const select=useCallback((id:string|null)=>setCharacterId(id),[]);
 useEffect(()=>{
  if(action==='messages')return;let active=true;queueMicrotask(()=>{if(active){setData(null);setError('');}});
  const path='/api/live-participants?sessionId='+encodeURIComponent(sessionId)+'&memberId='+encodeURIComponent(memberId)+'&view='+action+(characterId?'&characterId='+encodeURIComponent(characterId):'');
  api<Data>(path).then(next=>{if(active)setData(next);}).catch(e=>{if(active){setData(null);setError(e.message);}});return()=>{active=false;};
 },[action,memberId,sessionId,characterId,reload]);
 if(action==='messages')return <Suspense fallback={<p role="status">Nachrichten werden geladen …</p>}><Messages a={a} embedded initialRecipient={memberId===a.id?undefined:memberId}/></Suspense>;
 if(error)return <div role="alert"><p>{error}</p><button onClick={()=>setReload(n=>n+1)}>Erneut laden</button></div>;
 if(!data)return <p role="status">Ansicht wird geladen …</p>;
 const characterSelector=data.characters.length>1&&<label className={styles.characterChoice}>Charakter<select aria-label="Charakter dieses Teilnehmers" value={characterId||data.characters[0]?.id||''} onChange={e=>setCharacterId(e.target.value)}>{data.characters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>;
 return <>{action==='profile'?<><nav className={styles.sectionTabs} aria-label="Profilbereiche"><button aria-pressed={tab==='human'} onClick={()=>setTab('human')}>Spielerprofil</button><button aria-pressed={tab==='character'} onClick={()=>setTab('character')}>Öffentliche Figur</button></nav>{tab==='human'?<section className={styles.identity}><div className={styles.profileAvatar}>{data.member?.avatar?<img src={data.member.avatar} alt={'Spieleravatar von '+data.member.name}/>:<span>{data.member?.name.slice(0,1)}</span>}</div><p className={styles.caption}>SPIELERPROFIL</p><h3>{data.member?.name}</h3><p>{data.own?'Dein ChroniPlay-Spielerprofil.':'Mitglied deiner berechtigten Spielrunde.'}</p><small>Das Spieleravatar gehört zum Konto, nicht zur gespielten Figur. Kontoeinstellungen bleiben in der bestehenden Profilverwaltung.</small></section>:<>{characterSelector}{data.character?<section className={styles.identity}><p className={styles.caption}>ÖFFENTLICHE CHARAKTERDARSTELLUNG</p><h3>{data.character.name}</h3>{data.character.portrait&&<img className={styles.characterPortrait} src={data.character.portrait} alt={data.character.name}/>}<div className={styles.publicDescription}>{data.character.descriptions.length?data.character.descriptions.map((b,i)=><RichTextView key={i} value={b.content}/>):<p>Keine ausdrücklich freigegebene Beschreibung vorhanden.</p>}</div></section>:<p>Für diesen Teilnehmer ist noch keine öffentliche Figur freigegeben.</p>}</>}</>:<>{characterSelector}{action==='sheet'?(data.projection?<CharacterReadOnly projection={data.projection}/>:<p>Kein berechtigter Charakterbogen vorhanden.</p>):data.selectedCharacter?(data.publicOnly?<section><p className={styles.caption}>AUSSCHLIESSLICH FREIGEGEBENE GEGENSTÄNDE · NUR LESEN</p>{data.items?.length?<div className={styles.publicItems}>{data.items.map(i=><div key={i.id}><ItemTile item={i} warning={false} selected={selectedItem===i.id} onSelect={()=>setSelectedItem(selectedItem===i.id?'':i.id)}/>{selectedItem===i.id&&<div className={styles.itemDetails}><RichTextView value={i.description}/><p>{i.quantity} × · {i.status}</p></div>}</div>)}</div>:<p>Keine Gegenstände für die Gruppe freigegeben.</p>}</section>:<Suspense fallback={<p role="status">Inventar wird geladen …</p>}><Inventory embedded inspection={a.gm&&memberId!==a.id} dataScope={a.campaignId+':'+a.id+':'+a.role+':stage:'+memberId} activeCharacterId={data.selectedCharacter} onActiveCharacterChange={select}/></Suspense>):<p>Kein zugängliches Inventar vorhanden.</p>}</>}</>;
}
