"use client";
import {api,ApiError} from '../api-client';
import type {Snapshot} from './types';

/** Release target: null is the whole round, otherwise exactly these players. */
export type Audience=string[]|null;
const tableActions=['roll','closeRoll','showMedia','mediaIndex','hideMedia','hideScene','requestCheck','rollCheck'];
const stageUrl=(sessionId:string)=>'/api/live-stage?sessionId='+encodeURIComponent(sessionId);

/**
 * The one client path into the live evening, shared by the table and the second-screen Regie.
 * It only forwards to the existing stage and table APIs; permissions and audiences stay server-owned.
 * With retry, a stage command rejected as outdated (409, so not applied) is sent once more on the fresh version:
 * two GM windows then never block each other.
 */
export async function sendStageCommand({sessionId,runId,peerId,current,recipients,body,retry=false}:{sessionId:string;runId:string;peerId:string;current:Snapshot;recipients:Audience;body:Record<string,unknown>;retry?:boolean}):Promise<Snapshot>{
 const {action,sessionId:_ignored,...extra}=body;void _ignored;
 const audience=recipients===null?{scope:'all'}:{scope:'players',playerIds:recipients};
 if(tableActions.includes(String(action)))await api('/api/live-table','POST',{...extra,action,sessionId,runId,...(action==='rollCheck'?{}:{audience})});
 else if(action==='vitals')return api<Snapshot>('/api/live-vitals','POST',{...extra,sessionId,runId});
 else if(action==='scene'){
  const s=[...current.scenes,...current.moreScenes||[]].find(s=>s.id===extra.id);if(!s)throw Error('Szene nicht verfügbar.');
  await api('/api/live-table','POST',{action:'showScene',sessionId,runId,eventId:crypto.randomUUID(),sceneId:s.id,sceneVersion:s.version,audience});
 }else if(action==='board'){
  await api('/api/live-table','POST',{action:'join',sessionId,peerId});
  const {operation,...change}=extra;await api('/api/live-table','POST',{action:operation,sessionId,peerId,...change});
 }else{
  const post=(version:number)=>api<Snapshot>('/api/live-stage','POST',{sessionId,runId,expectedVersion:version,command:{action,...extra}});
  try{return await post(current.version);}
  catch(e){if(!retry||!(e instanceof ApiError)||e.status!==409)throw e;return post((await api<Snapshot>(stageUrl(sessionId))).version);}
 }
 return api<Snapshot>(stageUrl(sessionId));
}
