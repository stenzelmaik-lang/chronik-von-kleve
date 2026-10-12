"use client";
import { useCallback,useEffect,useRef,useState } from 'react';
import { api } from './api-client';
import type { BoardElement,TablePeer,TableScreen } from '@/domain/live-table';
export type TableResult={room:{version:number;open:boolean;epoch:number;elements:BoardElement[];peers:TablePeer[];screen:TableScreen|null}|null;signals?:{id:string;from:string;screenId:string;type:'offer'|'answer'|'candidate';payload:RTCSessionDescriptionInit|RTCIceCandidateInit}[];iceServers?:RTCIceServer[];relayConfigured?:boolean;mediaError?:string};
type Connection={pc:RTCPeerConnection;screenId:string;pending:RTCIceCandidateInit[];offered:boolean};
export function useTableScreen(sessionId:string,peerId:string|null) {
  const [local,setLocal]=useState<MediaStream|null>(null),[remote,setRemote]=useState<MediaStream|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const capture=useRef<MediaStream|null>(null),connections=useRef(new Map<string,Connection>()),seen=useRef(new Set<string>()),minimumVersion=useRef(0);
  const release=useCallback(()=>{capture.current?.getTracks().forEach(track=>{track.onended=null;track.stop();});capture.current=null;connections.current.forEach(connection=>connection.pc.close());connections.current.clear();seen.current.clear();},[]);
  useEffect(()=>{minimumVersion.current=0;queueMicrotask(()=>{setLocal(null);setRemote(null);setError('');});return release;},[sessionId,peerId,release]);
  const send=useCallback(async(target:string,screenId:string,signal:unknown)=>{await api('/api/live-table','POST',{action:'signal',sessionId,peerId,target,screenId,signal});},[sessionId,peerId]);
  const receive=useCallback(async(result:TableResult)=>{
    if(result.room&&result.room.version<minimumVersion.current)return;
    if(!peerId)return;
    const room=result.room;
    if(!room?.open||!room.peers.some(peer=>peer.id===peerId)){release();setLocal(null);setRemote(null);return;}
    const screen=room.screen;
    if(!screen){release();setLocal(null);setRemote(null);return;}
    if(result.mediaError||typeof RTCPeerConnection!=='function'){setError(result.mediaError||'Dieser Browser unterstützt keine Bildschirmverbindung. Das Whiteboard bleibt verfügbar.');release();setLocal(null);setRemote(null);return;}
    if(capture.current&&screen.peerId!==peerId){release();setLocal(null);}
    for(const [other,connection] of connections.current)if(connection.screenId!==screen.screenId||!room.peers.some(peer=>peer.id===other)){connection.pc.close();connections.current.delete(other);setRemote(null);}
    function connectionFor(other:string):Connection {
      const existing=connections.current.get(other);if(existing)return existing;
      const pc=new RTCPeerConnection({iceServers:result.iceServers||[]});
      const entry:Connection={pc,screenId:screen!.screenId,pending:[],offered:false};connections.current.set(other,entry);
      pc.onicecandidate=event=>{if(event.candidate)void send(other,entry.screenId,{type:'candidate',candidate:event.candidate.toJSON()}).catch(()=>setError('Verbindungssignal konnte nicht übertragen werden. Freigabe stoppen und erneut starten.'));};
      pc.ontrack=event=>{if(event.track.kind==='video')setRemote(event.streams[0]||new MediaStream([event.track]));};
      pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed'){setError('Bildschirmverbindung fehlgeschlagen. Relay-Konfiguration prüfen und Freigabe erneut starten.');setRemote(null);pc.close();}};
      if(screen!.peerId===peerId&&capture.current)for(const track of capture.current.getVideoTracks())pc.addTrack(track,capture.current);
      return entry;
    }
    if(screen.peerId===peerId&&capture.current){
      for(const peer of room.peers.filter(peer=>peer.id!==peerId)){
        const connection=connectionFor(peer.id);
        if(!connection.offered){connection.offered=true;try{const offer=await connection.pc.createOffer();await connection.pc.setLocalDescription(offer);await send(peer.id,screen.screenId,{type:'offer',sdp:offer.sdp});}catch{setError('Bildschirmverbindung konnte nicht angeboten werden. Freigabe bitte neu starten.');}}
      }
    }
    for(const signal of result.signals||[]){
      if(seen.current.has(signal.id)||signal.screenId!==screen.screenId)continue;
      seen.current.add(signal.id);
      try {
        const connection=connectionFor(signal.from);
        if(signal.type==='candidate'){
          if(connection.pc.remoteDescription)await connection.pc.addIceCandidate(signal.payload as RTCIceCandidateInit);else connection.pending.push(signal.payload as RTCIceCandidateInit);
        }else{
          await connection.pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
          for(const candidate of connection.pending)await connection.pc.addIceCandidate(candidate);connection.pending=[];
          if(signal.type==='offer'){const answer=await connection.pc.createAnswer();await connection.pc.setLocalDescription(answer);await send(signal.from,screen.screenId,{type:'answer',sdp:answer.sdp});}
        }
      }catch{setError('Bildschirm-Verbindungsaufbau fehlgeschlagen. Bitte stoppen und erneut verbinden.');}
    }
    if(seen.current.size>400)seen.current=new Set([...seen.current].slice(-200));
  },[peerId,release,send]);
  const stop=useCallback(async()=>{
    release();setLocal(null);setRemote(null);
    if(peerId)await api('/api/live-table','POST',{action:'stopScreen',sessionId,peerId}).catch(()=>setError('Freigabe lokal beendet. Der Serverstatus wird spätestens nach Ablauf der Verbindung aktualisiert.'));
  },[peerId,sessionId,release]);
  async function start() {
    if(busy||!peerId)return;
    setError('');setBusy(true);
    let stream:MediaStream|null=null;
    try {
      if(!navigator.mediaDevices?.getDisplayMedia)throw new Error('Dein Browser unterstützt hier keine Bildschirmfreigabe. Bitte einen unterstützten Desktop-Browser verwenden.');
      // Permission must be requested directly from this deliberate user click.
      stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:10,max:15}},audio:false});
      const screenId=crypto.randomUUID();const claimed=await api<{version:number}>('/api/live-table','POST',{action:'startScreen',sessionId,peerId,screenId});minimumVersion.current=claimed.version;
      release();capture.current=stream;setLocal(stream);
      stream.getVideoTracks().forEach(track=>{track.onended=()=>{void stop();};});
    }catch(issue){stream?.getTracks().forEach(track=>track.stop());setError((issue as Error).name==='NotAllowedError'?'Bildschirmfreigabe abgebrochen oder nicht erlaubt.':(issue as Error).message);}finally{setBusy(false);}
  }
  const disconnect=useCallback(()=>{release();setLocal(null);setRemote(null);},[release]);
  const fail=useCallback(()=>{release();setLocal(null);setRemote(null);setError('Bildschirmverbindung konnte nicht aufgebaut werden. Das Whiteboard bleibt verfügbar.');},[release]);
  return {local,remote,error,busy,start,stop,receive,disconnect,fail};
}
