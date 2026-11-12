import type {Actor} from '@/domain/types';
import type {LegacyRecordRow} from '@/domain/legacy';
import type {LiveEvent} from '@/domain/live-game';
import {database,HttpError,canRead} from '@/server/access';
export type LiveRoom={stage?:unknown;boardLocked?:boolean;away?:Record<string,boolean>;context:'live-table';sessionId:string;open:boolean;epoch:number;elements:import('@/domain/live-table').BoardElement[];peers:Record<string,import('@/domain/live-table').TablePeer>;screen:import('@/domain/live-table').TableScreen|null;started?:boolean;startedAt?:string;runId?:string;title?:string;participants?:string[];events?:LiveEvent[];checks?:import('@/domain/live-checks').ChecksSwitch;bloodRound?:{id:string;number:number};diceEpoch?:number};
export async function liveMembers(a:Actor){return (await database().prepare(`SELECT m.id,COALESCE(u.display_name,m.name) AS name,cm.role AS membershipRole,CASE WHEN p.avatar_file_id IS NOT NULL THEN 1 ELSE 0 END AS hasAvatar FROM members m LEFT JOIN auth_member_links l ON l.member_id=m.id LEFT JOIN auth_users u ON u.id=l.auth_user_id AND u.status='active' LEFT JOIN auth_profiles p ON p.user_id=u.id LEFT JOIN campaign_memberships cm ON cm.campaign_id=? AND cm.user_id=m.id WHERE (cm.status='active' AND cm.role IN ('player','campaign_owner','campaign_gm')) OR (cm.user_id IS NULL AND m.campaign_id=? AND m.status='active') ORDER BY m.name LIMIT 100`).bind(a.campaignId,a.campaignId).all<{id:string;name:string;hasAvatar:number;membershipRole:string|null}>()).results;}
/** Campaign GMs (owner or GM membership). Legacy members without a membership are treated as players. */
export const isGmMembership=(role:string|null|undefined)=>role==='campaign_owner'||role==='campaign_gm';
/** Active campaign players belong to every started evening: `participants` is only the snapshot taken at the start and must not lock out members who joined afterwards. */
export function roomAllowed(a:Actor,room:LiveRoom){return a.gm||!room.participants||(a.role==='player'&&a.status==='active');}
/** Members of the table: everyone `liveMembers` returns (active campaign membership), as soon as the evening was started with a participant list. */
export const roomCrew=<T extends {id:string}>(room:LiveRoom,members:T[]):T[]=>room.participants?members:[];
/** Shared by the legacy sheet write paths so a direct write cannot bypass tracked combat spending. */
export const activeBloodRoundSql=`SELECT 1 FROM records room
 WHERE room.campaign_id=? AND room.kind='notizen' AND json_valid(room.body)
 AND json_extract(room.body,'$.context')='live-table' AND json_extract(room.body,'$.open')=1
 AND json_extract(room.body,'$.started')=1 AND json_extract(room.body,'$.bloodRound.id') IS NOT NULL`;
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
