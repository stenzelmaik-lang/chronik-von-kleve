import {env} from 'cloudflare:workers';
import {database,HttpError,canRead,type Actor} from './access';
import {stageRoom} from './live-stage';
import {liveMembers} from './live-game';
import {characterDetailProjection} from './character-projection';
import {characterRecord,itemRows,parseItem} from './inventory';
import {publicCharacterCard} from '@/domain/live-participants';
import type {LegacyRecordRow} from '@/domain/legacy';

export async function participantContext(a:Actor,sessionId:string,memberId:string){
 const {room}=await stageRoom(a,sessionId);
 const member=(await liveMembers(a)).find(m=>m.id===memberId&&room.participants?.includes(m.id));
 if(!member)throw new HttpError(404,'Teilnehmer ist nicht in dieser Spielrunde.');
 return member;
}
export async function participantIdentity(a:Actor,memberId:string){
 const row=await database().prepare("SELECT COALESCE(u.display_name,m.name) AS name,p.avatar_file_id AS avatar FROM members m LEFT JOIN auth_member_links l ON l.member_id=m.id LEFT JOIN auth_users u ON u.id=l.auth_user_id AND u.status='active' LEFT JOIN auth_profiles p ON p.user_id=u.id WHERE m.id=?").bind(memberId).first<{name:string;avatar:string|null}>();
 return {name:row?.name||'',hasAvatar:!!row?.avatar};
}
export async function participantCharacters(a:Actor,memberId:string){
 const rows=await database().prepare("SELECT r.*,e.default_visibility AS entity_visibility FROM records r JOIN entities e ON e.id=r.id AND e.campaign_id=r.campaign_id WHERE r.campaign_id=? AND r.owner_id=? AND r.kind='charaktere' AND e.canon_status<>'GM_SECRET' AND (?=1 OR (r.visibility='group' AND COALESCE(e.default_visibility,'')<>'sl_secret' AND COALESCE(json_extract(r.body,'$.discovered'),1)<>0 AND COALESCE(json_extract(r.body,'$.content_unlocked'),1)<>0)) ORDER BY r.created_at,r.id").bind(a.campaignId,memberId,a.id===memberId||a.gm?1:0).all<LegacyRecordRow & {entity_visibility:string|null}>();
 return rows.results.filter(r=>{const b=JSON.parse(r.body);return b.archived!==true&&b.recoveryOnly!==true&&b.lifecycleStatus!=='ARCHIVED'&&(a.id===memberId||a.gm||r.visibility==='group');});
}
async function portrait(a:Actor,row:LegacyRecordRow){
 const image=JSON.parse(row.body).image;
 if(typeof image!=='string')return null;
 if(/^\/images\/[a-zA-Z0-9_.-]+$/.test(image))return image;
 const match=/^\/api\/files\?id=([a-zA-Z0-9_-]+)$/.exec(image);
 if(!match)return null;
 const f=await database().prepare('SELECT owner_id,visibility,mime FROM files WHERE id=? AND campaign_id=?').bind(match[1],a.campaignId).first<{owner_id:string;visibility:string;mime:string}>();
 return f&&canRead(a,f)&&f.mime.startsWith('image/')?image:null;
}
export async function participantView(a:Actor,sessionId:string,memberId:string,view:string,characterId?:string){
 await participantContext(a,sessionId,memberId);
 if(view==='sheet'&&a.id!==memberId&&!a.gm)throw new HttpError(403,'Der vollständige fremde Charakterbogen bleibt geschützt.');
 const rows=await participantCharacters(a,memberId),row=characterId?rows.find(r=>r.id===characterId):rows[0];
 if(characterId&&!row)throw new HttpError(404,'Charakter gehört nicht zu diesem Teilnehmer oder ist nicht freigegeben.');
 const characters=rows.map(r=>({id:r.id,name:r.title}));
 if(view==='profile'){
  const identity=await participantIdentity(a,memberId);
  const blocks=row?(await database().prepare("SELECT kind,content,visibility FROM entity_content_blocks WHERE entity_id=? AND campaign_id=? AND visibility='player_visible' AND kind IN ('summary','description','appearance','biography') ORDER BY position,id").bind(row.id,a.campaignId).all<{kind:string;content:string;visibility:string}>()).results:[];
  const body=row?JSON.parse(row.body):{};
  const released=row&&row.entity_visibility!=='sl_secret'&&body.discovered!==false&&body.content_unlocked!==false?publicCharacterCard(row,blocks):null;
  const character=released&&row?{...released,portrait:await portrait(a,row)}:null;
  return {member:{id:memberId,name:identity.name,avatar:identity.hasAvatar?'/api/live-participants?view=avatar&sessionId='+encodeURIComponent(sessionId)+'&memberId='+encodeURIComponent(memberId):null},own:a.id===memberId,characters,character};
 }
 if(view==='sheet'){
  if(!row)return {characters,selectedCharacter:null,projection:null};
  const projection=characterDetailProjection(a,row,JSON.parse(row.body));
  if(!projection)throw new HttpError(404,'Charakterbogen nicht verfügbar.');
  return {characters,selectedCharacter:row.id,projection:{...projection,identity:{...projection.identity,portraitRef:await portrait(a,row)},permissions:{canEdit:false,canChangeRuntimeValues:false,canArchive:false}}};
 }
 if(view==='inventory'){
  if(!row)return {characters,selectedCharacter:null,publicOnly:true,items:[]};
  if(a.id===memberId||a.gm){await characterRecord(database(),a,row.id);return {characters,selectedCharacter:row.id,publicOnly:false};}
  const items=(await itemRows(database(),a,row.id)).filter(r=>r.visibility==='group').map(parseItem).filter(i=>!!i&&i.lifecycleStatus==='ACTIVE').map(i=>({...i!,canEdit:false}));
  return {characters,selectedCharacter:row.id,publicOnly:true,items};
 }
 throw new HttpError(400,'Unbekannte Teilnehmeransicht.');
}
export async function participantAvatar(a:Actor,sessionId:string,memberId:string){
 await participantContext(a,sessionId,memberId);
 const f=await database().prepare("SELECT f.key,f.mime FROM auth_member_links l JOIN auth_users u ON u.id=l.auth_user_id AND u.status='active' JOIN auth_profiles p ON p.user_id=l.auth_user_id JOIN files f ON f.id=p.avatar_file_id WHERE l.member_id=? AND f.owner_id=? AND f.campaign_id=? AND f.mime IN ('image/png','image/jpeg','image/webp') AND f.visibility='private'").bind(memberId,memberId,a.campaignId).first<{key:string;mime:string}>();
 if(!f||!env.BUCKET)throw new HttpError(404,'Kein Spieleravatar vorhanden.');
 const image=await env.BUCKET.get(f.key);if(!image)throw new HttpError(404,'Spieleravatar nicht vorhanden.');
 return new Response(image.body,{headers:{'Content-Type':f.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
