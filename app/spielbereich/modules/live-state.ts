"use client";
import {useEffect,useState} from "react";
import {api} from "./api-client";

/** Live state of the evening: a running, open table counts as live. null while unknown. */
export function useLive(){
  const [live,setLive]=useState<boolean|null>(null);
  useEffect(()=>{let on=true;const load=()=>api<{room?:{open?:boolean;started?:boolean}|null}>("/api/live-table?view=active").then(d=>{if(on)setLive(!!(d.room?.open&&d.room.started));}).catch(()=>{if(on)setLive(false);});
    load();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")load();},30000);window.addEventListener("focus",load);
    return()=>{on=false;window.clearInterval(timer);window.removeEventListener("focus",load);};},[]);
  return live;
}
