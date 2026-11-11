"use client";
import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Actor } from '@/domain/types';
import type { Entry } from '@/domain/legacy';
import { appointmentOptions, calendarDays, type AppointmentChoice } from '@/domain/appointments';
import { api } from './api-client';
import { invalidatePlayerData } from './player-data-cache';
import styles from './appointments.module.css';
type Vote = {memberId:string;name:string;choices:Record<string,AppointmentChoice>;version?:number};
type Appointment = Entry & {votes:Vote[]};
const format = (date:string) => new Date(date).toLocaleString('de-DE',{dateStyle:'medium',timeStyle:'short'});
const dayKey = (date:Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
export function AppointmentsPanel({a,dataScope,engagementAvailable}:{a:Actor;dataScope:string;engagementAvailable:boolean}) {
  const [records,setRecords] = useState<Appointment[]>([]), [loading,setLoading] = useState(true), [error,setError] = useState('');
  const [month,setMonth] = useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1,12));
  const [day,setDay] = useState(''), [creating,setCreating] = useState(false), [busy,setBusy] = useState(false);
  const [editing,setEditing] = useState<Appointment|null>(null);
  const [title,setTitle] = useState(''), [summary,setSummary] = useState(''), [visibility,setVisibility] = useState('group'), [kind,setKind] = useState('fixed');
  const [dates,setDates] = useState(['','']);
  const [drafts,setDrafts] = useState<Record<string,Record<string,AppointmentChoice>>>({});
  const [notice,setNotice] = useState('');
  const load = useCallback(async()=>{
    const result=await api<{records:Appointment[]}>('/api/appointments'); setRecords(result.records); setError(''); setLoading(false);
  },[]);
  useEffect(()=>{let alive=true;api<{records:Appointment[]}>('/api/appointments').then(result=>{if(alive){setRecords(result.records);setLoading(false);}}).catch(issue=>{if(alive){setError(issue.message);setLoading(false);}});return()=>{alive=false;};},[]);
  async function write(payload:unknown,after?:()=>void) {
    setBusy(true);setError('');setNotice('');
    let stored=false;
    try {await api('/api/appointments','POST',payload);stored=true; invalidatePlayerData(dataScope,'/api/dashboard');after?.();setNotice('Gespeichert.');await load();}
    catch(issue){setError(stored?'Gespeichert, aber die Ansicht konnte nicht aktualisiert werden. Bitte Termine aktualisieren.':(issue as Error).message);}finally{setBusy(false);}
  }
  function gameNightControl(record: Appointment) {
    if (!engagementAvailable || !a.gm || record.visibility !== 'group') return null;
    const marked = record.body.engagementGameNight === true;
    return <button className="button" disabled={busy} aria-pressed={marked} onClick={() => void write({
      action: 'engagement-game-night', id: record.id, version: record.version, marked: !marked,
    })}>Spielabend für Zeitziele</button>;
  }
  const fixed=records.filter(record=>typeof record.body.date==='string'&&Number.isFinite(Date.parse(record.body.date))).sort((a,b)=>Date.parse(a.body.date!)-Date.parse(b.body.date!));
  const visible=fixed.filter(record=>{const date=new Date(record.body.date!);return date.getMonth()===month.getMonth()&&date.getFullYear()===month.getFullYear()&&(!day||dayKey(date)===day);});
  return <div className={styles.stack}>
    <header className={styles.heading}><div><p className="eyebrow">GEMEINSAME SPIELABENDE</p><h2>Kalender & Terminabstimmung</h2><p className="muted">Alle Uhrzeiten in der Ortszeit deines Geräts. Vorschläge sind noch keine festen Termine.</p><button className="button" disabled={busy} onClick={()=>void load().catch(issue=>setError(issue.message))}>Termine aktualisieren</button></div>{a.gm&&<button className="button primary" onClick={()=>{setCreating(true);setEditing(null);setTitle('');setSummary('');setDates(['','']);setKind('fixed');setVisibility('group');}}><Plus size={18}/> Termin anlegen</button>}</header>
    {error&&<div role="alert" className="error-box"><p>{error} Deine Eingaben bleiben erhalten.</p><button className="button" disabled={busy} onClick={()=>void load().catch(issue=>setError(issue.message))}>Aktualisieren</button></div>}{notice&&<p role="status">{notice}</p>}
    {creating&&a.gm&&<form className="panel stack-form" onSubmit={event=>{event.preventDefault();const required=kind==='fixed'?dates.slice(0,1):dates;if(required.some(date=>!date||!Number.isFinite(new Date(date).getTime()))){setError('Bitte alle Vorschläge mit Datum und Uhrzeit ausfüllen.');return;}void write({action:'save',id:editing?.id,version:editing?.version,title,summary,visibility,scheduleKind:kind,date:kind==='fixed'?new Date(dates[0]).toISOString():undefined,options:kind==='poll'?dates.map((date,index)=>({id:`option-${index+1}`,date:new Date(date).toISOString()})):undefined},()=>{setCreating(false);setEditing(null);setTitle('');setSummary('');setDates(['','']);});}}>
      <h3>{editing?'Spieltermin bearbeiten':'Neuer Spieltermin'}</h3><label className="field"><span>Titel</span><input required maxLength={200} value={title} onChange={event=>setTitle(event.target.value)}/></label>
      <label className="field"><span>Terminart</span><select disabled={!!editing} value={kind} onChange={event=>setKind(event.target.value)}><option value="fixed">Fester Termin</option><option value="poll">Terminabstimmung</option></select></label>
      <label className="field"><span>Wer sieht den Termin?</span><select value={visibility} onChange={event=>setVisibility(event.target.value)}><option value="group">Spielgruppe</option><option value="sl">Nur SL</option></select></label>
      <label className="field"><span>Beschreibung</span><textarea maxLength={2000} value={summary} onChange={event=>setSummary(event.target.value)}/></label>
      {(kind==='fixed'?dates.slice(0,1):dates).map((date,index)=><label className="field" key={index}><span>{kind==='fixed'?'Datum und Uhrzeit':`Vorschlag ${index+1}`}</span><input required type="datetime-local" value={date} onChange={event=>setDates(old=>old.map((date,i)=>i===index?event.target.value:date))}/></label>)}
      {kind==='poll'&&<div className={styles.actions}><button type="button" className="button" disabled={dates.length>=20} onClick={()=>setDates(old=>[...old,''])}>Vorschlag hinzufügen</button><button type="button" className="button" disabled={dates.length<=2} onClick={()=>setDates(old=>old.slice(0,-1))}>Letzten Vorschlag entfernen</button></div>}
      <div className={styles.actions}><button className="button primary" disabled={busy}>{busy?'Speichert …':'Speichern'}</button><button className="button" type="button" disabled={busy} onClick={()=>{setCreating(false);setTitle('');setSummary('');setDates(['','']);setError('');}}>Abbrechen</button></div>
    </form>}
    <section className="panel"><header className={styles.month}><button className="button" aria-label="Vorheriger Monat" onClick={()=>{setMonth(new Date(month.getFullYear(),month.getMonth()-1,1,12));setDay('');}}><ChevronLeft size={18}/></button><h3>{month.toLocaleDateString('de-DE',{month:'long',year:'numeric'})}</h3><button className="button" aria-label="Nächster Monat" onClick={()=>{setMonth(new Date(month.getFullYear(),month.getMonth()+1,1,12));setDay('');}}><ChevronRight size={18}/></button></header>
      <div className={styles.calendar}>{['Mo','Di','Mi','Do','Fr','Sa','So'].map(name=><span key={name} className={styles.weekday}>{name}</span>)}{calendarDays(month.getFullYear(),month.getMonth()).map(date=>{const key=dayKey(date);const events=fixed.filter(record=>dayKey(new Date(record.body.date!))===key);return <button key={key} className={`${styles.day} ${date.getMonth()!==month.getMonth()?styles.outside:''}`} aria-pressed={day===key} aria-label={`${date.toLocaleDateString('de-DE')}: ${events.length} Termine`} onClick={()=>{if(date.getMonth()!==month.getMonth())setMonth(new Date(date.getFullYear(),date.getMonth(),1,12));setDay(day===key?'':key);}}><span>{date.getDate()}</span>{events.length>0&&<CalendarDays size={15}/>}</button>;})}</div>
      {day&&<button className="button" onClick={()=>setDay('')}>Alle Termine im Monat</button>}
      {loading?<p role="status">Termine werden geladen …</p>:visible.length?visible.map(record=><article className={styles.event} key={record.id}><strong>{record.title}</strong><time dateTime={record.body.date}>{format(record.body.date!)}</time>{record.body.summary&&<p>{record.body.summary}</p>}{record.visibility==='sl'&&<small>SL-intern</small>}{a.gm&&record.body.scheduleKind!=='poll'&&<button className="button" onClick={()=>{const date=new Date(record.body.date!);const local=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);setEditing(record);setCreating(true);setKind('fixed');setTitle(record.title);setSummary(String(record.body.summary||''));setVisibility(record.visibility==='sl'?'sl':'group');setDates([local,'']);}}>Termin bearbeiten</button>}{record.body.scheduleKind === 'fixed' && gameNightControl(record)}</article>):!error&&<p className="muted">Keine festen Termine für diese Auswahl.</p>}
    </section>
    {records.filter(record=>record.body.scheduleKind==='poll').map(record=>{
      let options;
      try { options=appointmentOptions(record.body.pollOptions); } catch { return <section className="panel" key={record.id}><h3>{record.title}</h3><p role="alert">Die vorhandenen Terminvorschläge sind ungültig. Der Originaleintrag bleibt erhalten.</p></section>; }
      const own=record.votes.find(vote=>vote.memberId===a.id);
      const choices=drafts[record.id!]||own?.choices||{};
      const closed=record.body.pollClosed===true;
      return <section className="panel" key={record.id}><p className="eyebrow">{closed?'ABGESCHLOSSEN':'TERMINABSTIMMUNG'}</p><h3>{record.title}</h3>{record.body.summary&&<p>{record.body.summary}</p>}{record.visibility==='sl'&&<p>SL-intern</p>}
        <div className={styles.poll}><table><caption>Verfügbarkeit der Teilnehmenden</caption><thead><tr><th scope="col">Teilnahme</th>{options.map(option=><th scope="col" key={option.id}>{format(option.date)}</th>)}</tr></thead><tbody>{record.votes.map(vote=><tr key={vote.memberId}><th scope="row">{vote.name}</th>{options.map(option=><td key={option.id}>{({yes:'Ja',maybe:'Vielleicht',no:'Nein'})[vote.choices[option.id]]||'–'}</td>)}</tr>)}<tr><th scope="row">Zusagen</th>{options.map(option=><td key={option.id}>{record.votes.filter(vote=>vote.choices[option.id]==='yes').length}</td>)}</tr></tbody></table></div>
        {!closed&&<form className="stack-form" onSubmit={event=>{event.preventDefault();void write({action:'vote',id:record.id,version:own?.version||0,choices},()=>setDrafts(old=>{const copy={...old};delete copy[record.id!];return copy;}));}}><h4>Deine Antwort</h4>{options.map(option=><label key={option.id} className="field"><span>{format(option.date)}</span><select required value={choices[option.id]||''} onChange={event=>setDrafts(old=>({...old,[record.id!]:{...choices,[option.id]:event.target.value as AppointmentChoice}}))}><option value="">Bitte wählen …</option><option value="yes">Ja</option><option value="maybe">Vielleicht</option><option value="no">Nein</option></select></label>)}<button className="button primary" disabled={busy}>Antwort speichern</button></form>}
        {a.gm&&!closed&&<div className={styles.actions}>{options.map(option=><button className="button" disabled={busy} key={option.id} onClick={()=>void write({action:'finalize',id:record.id,version:record.version,optionId:option.id})}>Festlegen: {format(option.date)}</button>)}</div>}
        {closed&&record.body.date&&<p>Festgelegt: {format(record.body.date)}</p>}
        {gameNightControl(record)}
      </section>;
    })}
    {records.filter(record=>!record.body.date&&record.body.scheduleKind!=='poll').map(record=><article className="panel" key={record.id}><h3>{record.title}</h3><p className="muted">Bestehender Termineintrag ohne Kalenderdatum.</p>{record.body.summary&&<p>{record.body.summary}</p>}</article>)}
  </div>;
}
