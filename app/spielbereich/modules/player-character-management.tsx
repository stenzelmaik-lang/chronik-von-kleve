"use client";
import {useEffect,useState,type ComponentProps} from 'react';
import {ArrowLeft,Mail,RefreshCw,UserRound,Users} from 'lucide-react';
import {CharacterDetail} from './character-detail';
import {api} from './api-client';
import styles from './character-studio.module.css';

type Player={id:string;name:string;status:string;role:string;activeCharacterId:string|null;characters:{id:string;title:string;state:string;pendingRequests:number;archived:boolean;permissions:{editing:boolean;development:string}}[]};
type Players={campaign:{id:string;name:string};players:Player[]};
const states:Record<string,string>={legacy:'Bestehender Bogen',draft:'In Erschaffung',review:'Bei der SL',confirmed:'Bestätigt'};
export function PlayerCharacterManagement(props:ComponentProps<typeof CharacterDetail>){
  const [data,setData]=useState<Players|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[selected,setSelected]=useState<string|null>(null),[dossier,setDossier]=useState(false),[search,setSearch]=useState('');
  useEffect(()=>{let alive=true;api<Players>('/api/members?characters=1').then(result=>{if(alive){setData(result);setError('');}}).catch(e=>{if(alive){setData(null);setError(e.message);}});return()=>{alive=false;};},[props.a.id,props.a.campaignId,revision]);
  const player=data?.players.find(player=>player.id===selected),visible=data?.players.filter(p=>(p.name+' '+p.characters.map(c=>c.title).join(' ')).toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')))??[];
  function openCharacter(id:string){props.onActiveCharacterChange(id);setDossier(true);}
  if(dossier)return <><button className="button" onClick={()=>{setDossier(false);setRevision(n=>n+1);}}><ArrowLeft size={16}/>Zur Spielerübersicht</button><CharacterDetail {...props}/></>;
  return <section className={styles.playerManagement} aria-label="Spieler- und Charakterverwaltung"><header className={styles.progressHeader}><div><h2>Deine Spielrunde</h2><p>Spielerprofile und ihre Charaktere · {data?.campaign.name??'Kampagne wird geladen'}</p></div><button className="button" aria-label="Spielerübersicht aktualisieren" onClick={()=>setRevision(n=>n+1)}><RefreshCw size={16}/></button></header>
    <div className={styles.managementActions}><button className="button" onClick={()=>setDossier(true)}><Users size={16}/>Alle Charakterakten</button><button className="button" onClick={()=>window.dispatchEvent(new CustomEvent('chroniplay:compose-message',{detail:data?.players.filter(p=>p.status==='active'&&p.id!==props.a.id).map(p=>p.id)??[]}))}><Mail size={16}/>Nachricht an die Runde</button></div>
    {error&&<p role="alert">{error} Bitte die Übersicht erneut laden.</p>}{!data&&!error&&<p role="status">Spielerprofile werden geladen …</p>}
    <label className={styles.playerSearch}>Spieler oder Charakter suchen<input type="search" value={search} onChange={e=>setSearch(e.target.value)} aria-label="Spieler oder Charakter suchen"/></label>
    <div className={styles.playerRoster}>{visible.map(p=><button key={p.id} className={styles.playerRow} aria-pressed={selected===p.id} onClick={()=>setSelected(p.id)}><UserRound size={22}/><span><strong>{p.name}</strong><small>{p.characters.find(c=>c.id===p.activeCharacterId)?.title??'Kein aktiver Charakter gewählt'}</small></span><span>{p.characters.length} {p.characters.length===1?'Akte':'Akten'}</span></button>)}</div>
    {data&&!visible.length&&<p>Keine passenden Spielerprofile.</p>}
    {player&&<section className={styles.playerProfile} aria-label={'Spielerprofil '+player.name}><header className={styles.progressHeader}><div><h3>{player.name}</h3><p>{data?.campaign.name} · {({active:'Aktiv',pending:'Freigabe ausstehend',blocked:'Gesperrt'} as Record<string,string>)[player.status]??player.status}</p></div><button className="button" disabled={player.status!=='active'||player.id===props.a.id} onClick={()=>window.dispatchEvent(new CustomEvent('chroniplay:compose-message',{detail:player.id}))}><Mail size={16}/>Persönliche Nachricht</button></header><h4>Charaktere dieses Spielers</h4>{player.characters.length?player.characters.map(character=><article key={character.id} className={styles.playerCharacter}><div><h4>{character.title}</h4><p>{character.id===player.activeCharacterId?'Aktiver Charakter · ':''}{character.archived?'Archiviert':states[character.state]??character.state} · {character.pendingRequests} offene Anträge</p><small>Bearbeitung: {character.permissions.editing?'freigegeben':'geschützt'} · Entwicklung: {({direct:'Direktkauf',approval:'SL-Prüfung',blocked:'gesperrt'} as Record<string,string>)[character.permissions.development]}</small></div><button className="button" onClick={()=>openCharacter(character.id)}>Charakterakte öffnen</button></article>):<p>Noch kein Charakter zugeordnet. Vorhandene Konten bleiben unverändert.</p>}</section>}
  </section>;
}
