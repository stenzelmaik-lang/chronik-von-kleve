"use client";
import {useEffect,useRef,useState,type ComponentProps} from 'react';
import {ArrowLeft,Mail,RefreshCw,Settings2,UserRound,Users,BookOpen} from 'lucide-react';
import {CharacterDetail} from './character-detail';
import {api} from './api-client';
import styles from './character-studio.module.css';

type PlayerCharacter={id:string;title:string;state:string;pendingRequests:number;archived:boolean;clan:string;xpAvailable:number|null;catchUpReady:boolean;permissions:{editing:boolean;development:string}};
type Player={id:string;name:string;status:string;role:string;activeCharacterId:string|null;characters:PlayerCharacter[]};
type Players={campaign:{id:string;name:string};players:Player[]};
const states:Record<string,string>={legacy:'Noch nicht übernommen',draft:'In Erschaffung',review:'Wartet auf Prüfung',confirmed:'Im Spiel'};
const developmentLabels:Record<string,string>={direct:'XP direkt',approval:'XP per Antrag',blocked:'Entwicklung gesperrt'};
const statusLabels:Record<string,string>={active:'Aktiv',pending:'Freigabe ausstehend',blocked:'Gesperrt'};
/** Needs attention: a submitted sheet, a finished catch-up or open requests. */
const attention=(c:PlayerCharacter)=>!c.archived&&(c.state==='review'||c.catchUpReady||c.pendingRequests>0);

export function PlayerCharacterManagement(props:ComponentProps<typeof CharacterDetail>){
  const [data,setData]=useState<Players|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[selected,setSelected]=useState<string|null>(null),[dossier,setDossier]=useState<null|'sheet'|'management'>(null),[search,setSearch]=useState('');
  useEffect(()=>{let alive=true;api<Players>('/api/members?characters=1').then(result=>{if(alive){setData(result);setError('');}}).catch(e=>{if(alive){setData(null);setError(e.message);}});return()=>{alive=false;};},[props.a.id,props.a.campaignId,revision]);
  const profile=useRef<HTMLElement>(null);
  // On narrow screens the profile sits below the list; bring it into view instead of leaving the user guessing.
  function choose(id:string){setSelected(id);if(window.matchMedia('(max-width: 860px)').matches)requestAnimationFrame(()=>profile.current?.scrollIntoView({behavior:'smooth',block:'start'}));}
  const players=(data?.players??[]).filter(p=>p.role!=='campaign_gm'||p.characters.length>0);
  const visible=players.filter(p=>(p.name+' '+p.characters.map(c=>c.title).join(' ')).toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')));
  const player=players.find(p=>p.id===selected)??(visible.length===1?visible[0]:null);
  function openCharacter(id:string,view:'sheet'|'management'){props.onActiveCharacterChange(id);setDossier(view);}
  if(dossier)return <div className={styles.dossierFrame}><nav className={styles.breadcrumb} aria-label="Pfad"><button className="button" onClick={()=>{setDossier(null);setRevision(n=>n+1);}}><ArrowLeft size={16}/>Spielrunde</button>{player&&<span>{player.name}</span>}</nav><CharacterDetail key={dossier} {...props} initialView={dossier}/></div>;
  return <section className={styles.playerManagement} aria-label="Spieler- und Charakterverwaltung">
    <header className={styles.progressHeader}><div><h2>Deine Spielrunde</h2><p>Spielerprofile und ihre Charakterakten · {data?.campaign.name??'Kampagne wird geladen'}</p></div><div className={styles.headerActions}><button className="button" onClick={()=>setDossier('sheet')}><Users size={16}/>Alle Akten</button><button className="button" onClick={()=>window.dispatchEvent(new CustomEvent('chroniplay:compose-message',{detail:data?.players.filter(p=>p.status==='active'&&p.id!==props.a.id).map(p=>p.id)??[]}))}><Mail size={16}/>Nachricht an die Runde</button><button className="button" aria-label="Spielerübersicht aktualisieren" onClick={()=>setRevision(n=>n+1)}><RefreshCw size={16}/></button></div></header>
    {error&&<p role="alert">{error} Bitte die Übersicht erneut laden.</p>}{!data&&!error&&<p role="status">Spielerprofile werden geladen …</p>}
    <div className={styles.rosterLayout}>
      <aside className={styles.rosterColumn} aria-label="Spieler">
        <label className={styles.playerSearch}><span>Suchen</span><input type="search" value={search} placeholder="Spieler oder Charakter" onChange={e=>setSearch(e.target.value)} aria-label="Spieler oder Charakter suchen"/></label>
        <div className={styles.playerRoster}>{visible.map(p=>{const flagged=p.characters.filter(attention).length;return <button key={p.id} className={styles.playerRow} aria-pressed={player?.id===p.id} onClick={()=>choose(p.id)}><UserRound size={20}/><span><strong>{p.name}</strong><small>{p.characters.find(c=>c.id===p.activeCharacterId)?.title??(p.characters.filter(c=>!c.archived).map(c=>c.title).join(', ')||'Noch kein Charakter')}</small></span>{flagged>0?<b className={styles.flag} title="Wartet auf die SL">{flagged}</b>:<em>{p.characters.length}</em>}</button>;})}
        {data&&!visible.length&&<p>Keine passenden Spielerprofile.</p>}</div>
      </aside>
      <section ref={profile} className={styles.profilePanel} aria-live="polite">
        {!player?<div className={styles.profileEmpty}><UserRound size={28}/><p>Wähle links einen Spieler, um Profil, Charaktere und Freigaben zu sehen.</p></div>:<>
        <header className={styles.profileHead}><div><h3>{player.name}</h3><p>{data?.campaign.name} · {statusLabels[player.status]??player.status}{player.role==='campaign_gm'?' · Spielleitung':''}</p></div><button className="button" disabled={player.status!=='active'||player.id===props.a.id} onClick={()=>window.dispatchEvent(new CustomEvent('chroniplay:compose-message',{detail:player.id}))}><Mail size={16}/>Persönliche Nachricht</button></header>
        <h4 className={styles.profileSub}>Charakterakten</h4>
        {player.characters.length?<div className={styles.characterCards}>{player.characters.map(character=><article key={character.id} className={styles.playerCharacter} data-archived={character.archived||undefined}>
          <header><div><h4>{character.title}</h4><p>{character.clan||'Clan nicht angegeben'}{character.id===player.activeCharacterId?' · aktiver Charakter':''}</p></div><span className={styles.stateChip} data-state={character.archived?'archived':character.state}>{character.archived?'Archiviert':states[character.state]??character.state}</span></header>
          <dl><div><dt>XP verfügbar</dt><dd>{character.xpAvailable??'–'}</dd></div><div><dt>Bearbeitung</dt><dd>{character.permissions.editing?'Spieler darf nachtragen':'Geschützt'}</dd></div><div><dt>Entwicklung</dt><dd>{developmentLabels[character.permissions.development]??character.permissions.development}</dd></div></dl>
          {attention(character)&&<p className={styles.attention}>{character.state==='review'?'Bogen wartet auf deine Prüfung.':character.catchUpReady?'Spieler meldet: Nachtrag abgeschlossen.':''}{character.pendingRequests>0?` ${character.pendingRequests} offene ${character.pendingRequests===1?'Anfrage':'Anfragen'}.`:''}</p>}
          <footer><button className="button" onClick={()=>openCharacter(character.id,'sheet')}><BookOpen size={15}/>Bogen ansehen</button><button className="button primary" onClick={()=>openCharacter(character.id,'management')}><Settings2 size={15}/>Verwalten</button></footer>
        </article>)}</div>:<p>Noch kein Charakter zugeordnet.</p>}
        </>}
      </section>
    </div>
  </section>;
}
