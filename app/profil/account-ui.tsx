"use client";
/* eslint-disable @next/next/no-img-element -- Profile images use protected private media endpoints. */
/* eslint-disable @next/next/no-location-assign-relative-destination -- Credential and session changes discard all protected client state through full navigation. */
import { FormEvent, useEffect, useState } from "react";
import { profileBanners, profilePlayStyles } from "@/domain/account-access";
import styles from "./account.module.css";

type Mutation={ok:boolean;logout?:boolean;id?:string;token?:string};
export async function accountApi<T=Mutation>(path:string,method='GET',body?:unknown):Promise<T>{
  const r=await fetch(path,{method,cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  if(!r.headers.get('content-type')?.includes('application/json'))throw new Error('Der Kontodienst ist momentan nicht erreichbar. Bitte erneut versuchen.');
  const d=await r.json() as T&{error?:string};if(!r.ok)throw new Error(d.error??'Der Vorgang konnte nicht abgeschlossen werden.');return d;
}
type Profile={displayName:string;email:string;version:number;avatarFileId:string|null;preferences:{reducedMotion:boolean;compactView:boolean;realName?:string;introduction?:string;pronouns?:string;banner?:typeof profileBanners[number];playStyles?:Array<typeof profilePlayStyles[number]>;sharePlayerProfileCampaigns?:string[]};campaigns:{id:string;name:string;status:string}[]};
type Session={id:string;createdAt:string;expiresAt:string;lastSeenAt:string;current:boolean};
const bannerLabels:Record<typeof profileBanners[number],string>={neon:'Neon im Regen',fog:'Rheinnebel',candle:'Kerzenlicht'};
const date=(s:string)=>new Date(s).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'});
export default function AccountProfile(){
  const [profile,setProfile]=useState<Profile|null>(null),[sessions,setSessions]=useState<Session[]>([]),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState(''),[error,setError]=useState(''),[dirty,setDirty]=useState(false);
  function updatePreferences(changes:Partial<Profile['preferences']>){
    setProfile(current=>current?{...current,preferences:{...current.preferences,...changes}}:current);
    setDirty(true);
  }
  async function load(){const [p,s]=await Promise.all([accountApi<Profile>('/api/profile'),accountApi<{sessions:Session[]}>('/api/auth/sessions')]);setProfile(p);setSessions(s.sessions);setDirty(false);}
  useEffect(()=>{let active=true;void Promise.all([accountApi<Profile>('/api/profile'),accountApi<{sessions:Session[]}>('/api/auth/sessions')]).then(([p,s])=>{if(active){setProfile(p);setSessions(s.sessions);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  async function run(fn:()=>Promise<void>){setBusy(true);setError('');setFeedback('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Bitte erneut versuchen.');}finally{setBusy(false);}}
  async function save(event:FormEvent){event.preventDefault();if(!profile)return;await run(async()=>{await accountApi('/api/profile','PATCH',{version:profile.version,displayName:profile.displayName,avatarFileId:profile.avatarFileId,preferences:profile.preferences});await load();setFeedback('Dein Profil wurde dauerhaft gespeichert.');});}
  async function upload(file:File|undefined){if(!file||!profile)return;await run(async()=>{
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024)throw new Error('Bitte JPG, PNG oder WebP bis 2 MB auswählen.');
    const f=new FormData();f.set('file',file);f.set('visibility','private');const r=await fetch('/api/files',{method:'POST',body:f}),d=await r.json() as {id?:string;error?:string};if(!r.ok||!d.id)throw new Error(d.error??'Profilbild konnte nicht hochgeladen werden.');
    await accountApi('/api/profile','PATCH',{version:profile.version,displayName:profile.displayName,avatarFileId:d.id,preferences:profile.preferences});await load();setFeedback('Privates Profilbild hochgeladen und gespeichert.');
  });}
  async function revoke(action:string,id?:string){if(!window.confirm('Diese Sitzung(en) wirklich abmelden?'))return;await run(async()=>{const r=await accountApi('/api/auth/sessions','POST',{action,...(id?{id}:{})});if(r.logout)window.location.href='/anmelden';else{await load();setFeedback('Die ausgewählten Sitzungen sind abgemeldet.');}});}
  async function password(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!profile)return;const form=event.currentTarget,d=Object.fromEntries(new FormData(form));await run(async()=>{await accountApi('/api/auth/password','POST',{...d,version:profile.version});form.reset();window.location.href='/anmelden';});}
  return <main className={styles.page}><header className={styles.topbar}><a href="/spielbereich">← Zum Spieltisch</a><strong>CHRONIPLAY</strong><button disabled={busy} onClick={()=>void run(async()=>{await accountApi('/api/auth/logout','POST');window.location.href='/anmelden';})}>Abmelden</button></header>
    <div className={styles.container}><header className={styles.hero}><p>DEINE SPIELERVORSTELLUNG</p><h1>Mein Profil</h1><span>Hier ist Platz für dich und dafür, wie du am liebsten spielst.</span></header>
    {error&&<p role="alert" className={styles.error}>{error}</p>}{feedback&&<p role="status" className={styles.success}>{feedback}</p>}
    {!profile?<p>Dein Konto wird geladen…</p>:<>
    <div className={styles.grid}><section className={styles.card} aria-label="Profil bearbeiten"><div className={styles.heading}><h2>Dein Auftreten</h2><span>{dirty?'Ungespeicherte Änderungen':'Gespeicherter Stand'}</span></div>
      <form onSubmit={save}><div className={styles.identity}>{profile.avatarFileId?<img alt="Dein privates Profilbild" src={'/api/profile/avatar?v='+profile.version}/>:<span className={styles.initial}>{profile.displayName.slice(0,1)}</span>}<div><label className={styles.upload}>Profilbild auswählen<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>void upload(e.target.files?.[0])}/></label><small>JPG, PNG oder WebP · bis 2 MB · privat gespeichert</small>{profile.avatarFileId&&<button type="button" disabled={busy} onClick={()=>{setProfile({...profile,avatarFileId:null});setDirty(true);}}>Profilbild entfernen</button>}</div></div>
        <label>Nickname (Anzeigename)<input required maxLength={80} value={profile.displayName} onChange={e=>{setProfile({...profile,displayName:e.target.value});setDirty(true);}}/></label>
        <fieldset className={styles.introduction}>
          <legend>Persönliche Vorstellung</legend>
          <small>Dein Name bleibt privat. Vorstellung, Pronomen, Motiv und Spielstil kannst du für deine Runde freigeben.</small>
          <label>Name (optional)<input maxLength={100} value={profile.preferences.realName??''} onChange={e=>{setProfile({...profile,preferences:{...profile.preferences,realName:e.target.value}});setDirty(true);}}/></label>
          <label>Pronomen (optional)<input maxLength={40} value={profile.preferences.pronouns??''} onChange={e=>updatePreferences({pronouns:e.target.value})}/></label>
          <label>Profilmotiv<select value={profile.preferences.banner??'fog'} onChange={e=>{const banner=profileBanners.find(value=>value===e.target.value);if(banner)updatePreferences({banner});}}>{profileBanners.map(banner=><option key={banner} value={banner}>{bannerLabels[banner]}</option>)}</select></label>
          <label>Über mich<textarea rows={4} maxLength={600} value={profile.preferences.introduction??''} onChange={e=>{setProfile({...profile,preferences:{...profile.preferences,introduction:e.target.value}});setDirty(true);}}/></label>
          <fieldset className={styles.playStyles}><legend>So spiele ich · bis zu fünf</legend>
            {profilePlayStyles.map(style=>{
              const chosen=profile.preferences.playStyles??[];
              const checked=chosen.includes(style);
              return <label className={styles.check} key={style}><input type="checkbox" checked={checked} disabled={!checked&&chosen.length>=5} onChange={()=>updatePreferences({playStyles:checked?chosen.filter(value=>value!==style):[...chosen,style]})}/>{style}</label>;
            })}
          </fieldset>
        </fieldset>
        {!!profile.campaigns.some(c=>c.status==='active')&&<fieldset className={styles.introduction}>
          <legend>Am Spieltisch zeigen</legend>
          <small>Nur Mitglieder der ausgewählten Kampagnen sehen deine Vorstellung.</small>
          {profile.campaigns.filter(c=>c.status==='active').map(c=>{
            const shared=profile.preferences.sharePlayerProfileCampaigns??[];
            return <label className={styles.check} key={c.id}><input type="checkbox" checked={shared.includes(c.id)} onChange={e=>updatePreferences({sharePlayerProfileCampaigns:e.target.checked?[...shared,c.id]:shared.filter(id=>id!==c.id)})}/>{c.name}</label>;
          })}
        </fieldset>}
        <details className={styles.personalSettings}><summary>Konto & Anzeige</summary>
          <div>
        <label>E-Mail<input readOnly value={profile.email}/></label><small>Die bestätigte Kontoidentität wird durch Profiländerungen nicht verändert.</small>
        <label className={styles.check}><input type="checkbox" checked={profile.preferences.reducedMotion} onChange={e=>{setProfile({...profile,preferences:{...profile.preferences,reducedMotion:e.target.checked}});setDirty(true);}}/>Animationen reduzieren</label>
        <label className={styles.check}><input type="checkbox" checked={profile.preferences.compactView} onChange={e=>{setProfile({...profile,preferences:{...profile.preferences,compactView:e.target.checked}});setDirty(true);}}/>Kompakte Spieltischansicht</label>
          </div>
        </details>
        <button className={styles.primary} disabled={busy||!dirty}>{busy?'Bitte warten…':'Profil speichern'}</button>
      </form></section>
      <aside className={styles.profilePreview} aria-label="Profilvorschau">
        <article>
          <header data-banner={profile.preferences.banner??'fog'}>
            {profile.avatarFileId?<img src={'/api/profile/avatar?v='+profile.version} alt=""/>:<span className={styles.initial} aria-hidden="true">{profile.displayName.trim().slice(0,1)||'?'}</span>}
            <div><small>Spielerkarte · private Vorschau</small><h2>{profile.displayName}</h2>{profile.preferences.pronouns&&<span>{profile.preferences.pronouns}</span>}</div>
          </header>
          <div className={styles.previewBody}>
            <h3>Über mich</h3>
            <p>{profile.preferences.introduction||'Deine Vorstellung erscheint hier, sobald du etwas über dich schreibst.'}</p>
            {!!profile.preferences.playStyles?.length&&<><h3>So spiele ich</h3><ul>{profile.preferences.playStyles.map(style=><li key={style}>{style}</li>)}</ul></>}
          </div>
        </article>
      </aside></div>
      <details className={styles.card}><summary>Aktive Sitzungen ({sessions.length})</summary><div className={styles.heading}><div><h2>Deine Sitzungen</h2><small>Nur deine eigenen Sitzungen. Keine Sitzungsschlüssel werden angezeigt.</small></div><button disabled={busy||sessions.filter(s=>!s.current).length===0} onClick={()=>void revoke('revoke_others')}>Andere Geräte abmelden</button></div>{sessions.map(s=><article className={styles.row} key={s.id}><div><strong>{s.current?'Diese Sitzung':'Weitere Sitzung'}</strong><small>Zuletzt aktiv {date(s.lastSeenAt)} · läuft bis {date(s.expiresAt)}</small></div><button disabled={busy} onClick={()=>void revoke('revoke',s.id)}>Abmelden</button></article>)}</details>
      <details className={styles.card}><summary>Passwort & Kontosicherheit</summary><p>Nach einer Passwortänderung werden alle Geräte abgemeldet. Du meldest dich anschließend mit dem neuen Passwort an.</p><form className={styles.passwordForm} onSubmit={password}><label>Aktuelles Passwort<input name="currentPassword" type="password" required maxLength={200} autoComplete="current-password"/></label><label>Neues Passwort<input name="password" type="password" required minLength={12} maxLength={200} autoComplete="new-password"/></label><label>Neues Passwort wiederholen<input name="confirmation" type="password" required minLength={12} maxLength={200} autoComplete="new-password"/></label><small>12–200 Zeichen. Keine Passwörter per Chat versenden.</small><button disabled={busy}>Passwort ändern und abmelden</button></form><p>Passwort vergessen? <a href="/passwort-zuruecksetzen">Persönliche Wiederherstellung</a></p></details>
    </>}
    </div></main>;
}
