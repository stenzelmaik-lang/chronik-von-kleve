"use client";
import {useEffect,useState} from 'react';
import {calendarDays} from '@/domain/appointments';
import styles from './dashboard.module.css';
export function DashboardCalendar({entries,onOpen}:{entries:{id?:string;title:string;date:string}[];onOpen:()=>void}){
  const [now,setNow]=useState<Date|null>(null);
  useEffect(()=>{let live=true;queueMicrotask(()=>{if(live)setNow(new Date());});const timer=window.setInterval(()=>setNow(new Date()),1000);return()=>{live=false;window.clearInterval(timer);};},[]);
  if(!now)return <p role="status">Kalender wird geladen …</p>;
  const today=(date:Date)=>date.toDateString()===now.toDateString();
  return <div className={styles.miniCalendar}><div className={styles.calendarHeading}><strong>{now.toLocaleDateString('de-DE',{month:'long',year:'numeric'})}</strong><time aria-label="Aktuelle Uhrzeit" dateTime={now.toISOString()}>{now.toLocaleTimeString('de-DE',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'})}</time></div><div className={styles.calendarGrid} aria-label="Aktueller Monat">{['Mo','Di','Mi','Do','Fr','Sa','So'].map(day=><span className={styles.weekday} key={day}>{day}</span>)}{calendarDays(now.getFullYear(),now.getMonth()).map(date=>{const events=entries.filter(e=>new Date(e.date).toDateString()===date.toDateString());return <button type="button" key={date.toISOString()} aria-current={today(date)?'date':undefined} data-outside={date.getMonth()!==now.getMonth()} data-event={events.length>0} aria-label={`${date.toLocaleDateString('de-DE')}${today(date)?' · Heute':''}${events.length?' · '+events.map(e=>e.title).join(', '):''}`} title={events.map(e=>e.title).join(', ')||undefined} onClick={onOpen}>{date.getDate()}{events.length>0&&<span aria-hidden="true"/>}</button>;})}</div></div>;
}
