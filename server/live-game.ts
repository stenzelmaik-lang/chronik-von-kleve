import type {Actor} from '@/domain/types';
import type {LegacyRecordRow} from '@/domain/legacy';
import type {LiveEvent} from '@/domain/live-game';
import {database,HttpError,canRead} from '@/server/access';
export type LiveRoom={stage?:unknown;context:'live-table';sessionId:string;open:boolean;epoch:number;elements:import('@/domain/live-table').BoardElement[];peers:Record<string,import('@/domain/live-table').TablePeer>;screen:import('@/domain/live-table').TableScreen|null;started?:boolean;startedAt?:string;runId?:string;title?:string;participants?:string[];events?:LiveEvent[]};
export async function liveMembers(a:Actor){return (await database().prepare(`SELECT m.id,m.name FROM members m LEFT JOIN campaign_memberships cm ON cm.campaign_id=? AND cm.user_id=m.id WHERE (cm.status='active' AND cm.role IN ('player','campaign_owner','campaign_gm')) OR (cm.user_id IS NULL AND m.campaign_id=? AND m.status='active') ORDER BY m.name LIMIT 100`).bind(a.campaignId,a.campaignId).all<{id:string;name:string}>()).results;}
export function roomAllowed(a:Actor,room:LiveRoom){return a.gm||!room.participants||(a.role==='player'&&room.participants.includes(a.id));}
export async function readLiveRoom(a:Actor,sessionId:string){
  const row=await database().prepare("SELECT * FROM records WHERE id=? AND campaign_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.context')='live-table'").bind(`live-table:${a.campaignId}:${sessionId}`,a.campaignId).first<LegacyRecordRow>();
  if(!row)throw new HttpError(404,'Spielabend nicht verfügbar.');
  const room=JSON.parse(row.body) as LiveRoom;
  if(!roomAllowed(a,room))throw new HttpError(404,'Spielabend nicht verfügbar.');
  return {row,room};
}
export async function liveFile(a:Actor,id:string){
  const file=await database().prepare('SELECT * FROM files WHERE id=? AND campaign_id=?').bind(id,a.campaignId).first<{id:string;name:string;mime:string;key:string;owner_id:string;visibility:string}>();
  if(!file||!canRead(a,file))throw new HttpError(404,'Medium nicht verfügbar.');
  return file;
}
