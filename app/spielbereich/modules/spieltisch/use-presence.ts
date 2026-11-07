import {useCallback,useEffect,useRef,useState} from 'react';
import {api,ApiError} from '../api-client';
/** Reuse the Whiteboard room connection; one connection per mounted stage/tab. */
export function usePresence(sessionId:string,runId:string,peerId:string){
 const connected=useRef(false),inFlight=useRef(false),active=useRef(false),pendingAway=useRef<boolean|undefined>(undefined);
 const [error,setError]=useState('');
 const pulse=useCallback(async function beat(afk?:boolean){
  if(!active.current)return;
  if(inFlight.current){if(afk!==undefined)pendingAway.current=afk;return;}
  inFlight.current=true;
  try{
   if(!connected.current){await api('/api/live-table','POST',{action:'join',sessionId,runId,peerId});connected.current=true;}
   await api('/api/live-table','POST',{action:'pulse',sessionId,runId,peerId,...(afk===undefined?{}:{afk})});
   if(active.current)setError('');
  }catch(e){connected.current=false;if(active.current)setError((e as Error).message);if(e instanceof ApiError&&[401,403,404,409].includes(e.status))connected.current=false;}
  finally{inFlight.current=false;if(active.current&&pendingAway.current!==undefined){const value=pendingAway.current;pendingAway.current=undefined;queueMicrotask(()=>void beat(value));}if(!active.current)void fetch('/api/live-table',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'leave',sessionId,runId,peerId}),keepalive:true}).catch(()=>{});}
 },[sessionId,runId,peerId]);
 useEffect(()=>{
  active.current=true;connected.current=false;queueMicrotask(()=>void pulse());
  const timer=window.setInterval(()=>void pulse(),8000),wake=()=>void pulse();
  const leave=()=>{connected.current=false;void fetch('/api/live-table',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'leave',sessionId,runId,peerId}),keepalive:true}).catch(()=>{});};
  const visible=()=>{if(document.visibilityState==='visible')wake();};
  document.addEventListener('visibilitychange',visible);window.addEventListener('focus',wake);window.addEventListener('online',wake);window.addEventListener('pageshow',wake);window.addEventListener('pagehide',leave);
  return()=>{active.current=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',wake);window.removeEventListener('online',wake);window.removeEventListener('pageshow',wake);window.removeEventListener('pagehide',leave);leave();};
 },[pulse,sessionId,runId,peerId]);
 return {setAway:pulse,error};
}
