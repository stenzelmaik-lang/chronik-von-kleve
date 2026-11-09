import {sharedProfile,hasSharedProfile} from '@/domain/character-profile';
import {env} from 'cloudflare:workers';
import {database,HttpError,canRead,type Actor} from './access';
import {stageRoom} from './live-stage';
import {liveMembers,roomCrew} from './live-game';
import {characterDetailProjection} from './character-projection';
import {characterRecord} from './inventory';
import {profileBanners,profilePlayStyles} from '@/domain/account-access';
import {publicCharacterCard} from '@/domain/live-participants';
import type {LegacyRecordRow} from '@/domain/legacy';

export async function participantContext(a:Actor,sessionId:string,memberId:string){
 const {room}=await stageRoom(a,sessionId);
 const member=roomCrew(room,await liveMembers(a)).find(m=>m.id===memberId);
 if(!member)throw new HttpError(404,'Teilnehmer ist nicht in dieser Spielrunde.');
 return member;
}
export async function participantIdentity(a:Actor,memberId:string){
 const row=await database().prepare("SELECT COALESCE(u.display_name,m.name) AS name,p.avatar_file_id AS avatar,p.preferences FROM members m LEFT JOIN auth_member_links l ON l.member_id=m.id LEFT JOIN auth_users u ON u.id=l.auth_user_id AND u.status='active' LEFT JOIN auth_profiles p ON p.user_id=u.id WHERE m.id=?").bind(memberId).first<{name:string;avatar:string|null;preferences:string|null}>();
 const preferences=JSON.parse(row?.preferences||'{}')??{};
 const shared=Array.isArray(preferences.sharePlayerProfileCampaigns)&&preferences.sharePlayerProfileCampaigns.includes(a.campaignId);
 const activeCharacterId=preferences.activeCharacters?.[a.campaignId];
 return {name:row?.name||'',hasAvatar:!!row?.avatar,activeCharacterId:typeof activeCharacterId==='string'?activeCharacterId:null,
  presentation:shared?{
   pronouns:typeof preferences.pronouns==='string'?preferences.pronouns:'',
   introduction:typeof preferences.introduction==='string'?preferences.introduction:'',
   banner:profileBanners.find(banner=>banner===preferences.banner)??'fog',
   playStyles:Array.isArray(preferences.playStyles)?profilePlayStyles.filter(style=>preferences.playStyles.includes(style)).slice(0,5):[],
  }:null};
}
export async function participantCharacters(a:Actor,memberId:string,publicOnly=false){
 const rows=await database().prepare("SELECT r.* FROM records r JOIN entities e ON e.id=r.id AND e.campaign_id=r.campaign_id WHERE r.campaign_id=? AND r.owner_id=? AND r.kind='charaktere' AND e.canon_status<>'GM_SECRET' AND (?=1 OR (COALESCE(e.default_visibility,'')<>'sl_secret' AND (json_extract(r.body,'$.presentation.published')=1 OR json_extract(r.body,'$.profile.visibility.description')='group' OR json_extract(r.body,'$.profile.visibility.story')='group' OR json_extract(r.body,'$.profile.visibility.drive')='group' OR json_extract(r.body,'$.profile.visibility.allies')='group' OR EXISTS (SELECT 1 FROM json_each(r.body,'$.characterMedia') m WHERE json_extract(m.value,'$.shared')=1) OR (json_type(r.body,'$.presentation') IS NULL AND r.visibility='group' AND COALESCE(json_extract(r.body,'$.discovered'),1)<>0 AND COALESCE(json_extract(r.body,'$.content_unlocked'),1)<>0)))) ORDER BY r.created_at,r.id").bind(a.campaignId,memberId,!publicOnly&&(a.id===memberId||a.gm)?1:0).all<LegacyRecordRow>();
 return rows.results.filter(r=>{const b=JSON.parse(r.body);return b.archived!==true&&b.recoveryOnly!==true&&b.lifecycleStatus!=='ARCHIVED';});
}
async function portrait(a:Actor,row:LegacyRecordRow,publicOnly=false){
 const image=JSON.parse(row.body).image;
 if(typeof image!=='string')return null;
 if(/^\/images\/[a-zA-Z0-9_.-]+$/.test(image))return image;
 const match=/^\/api\/files\?id=([a-zA-Z0-9_-]+)$/.exec(image);
 if(!match)return null;
 const f=await database().prepare('SELECT owner_id,visibility,mime FROM files WHERE id=? AND campaign_id=?').bind(match[1],a.campaignId).first<{owner_id:string;visibility:string;mime:string}>();
 return f&&canRead(a,f)&&(!publicOnly||f.visibility==='group')&&f.mime.startsWith('image/')?image:null;
}
export async function participantView(a:Actor,sessionId:string,memberId:string,view:string,characterId?:string){
 await participantContext(a,sessionId,memberId);
 if(view==='sheet'&&a.id!==memberId&&!a.gm)throw new HttpError(403,'Der vollständige fremde Charakterbogen bleibt geschützt.');
 if(view==='inventory'&&a.id!==memberId&&!a.gm)throw new HttpError(403,'Das Inventar anderer Spieler bleibt privat.');
 const identity=view==='profile'?await participantIdentity(a,memberId):null;
 const rows=await participantCharacters(a,memberId,view==='profile');
 const row=characterId?rows.find(r=>r.id===characterId):identity?.activeCharacterId?rows.find(r=>r.id===identity.activeCharacterId):rows[0];
 if(characterId&&!row)throw new HttpError(404,'Charakter gehört nicht zu diesem Teilnehmer oder ist nicht freigegeben.');
 const characters=rows.map(r=>({id:r.id,name:r.title}));
 if(identity){
  const body=row?JSON.parse(row.body):{};
  const figure=body.presentation?.published===true?body.presentation:null;
  const blocks=row&&!figure?(await database().prepare("SELECT kind,content,visibility FROM entity_content_blocks WHERE entity_id=? AND campaign_id=? AND visibility='player_visible' AND kind IN ('summary','description','appearance','biography') ORDER BY position,id").bind(row.id,a.campaignId).all<{kind:string;content:string;visibility:string}>()).results:[];
  const images=row?await participantGallery(a,sessionId,memberId,row,body):{portrait:null,gallery:[]};
  const gallery=images.gallery;
  const legacy=row&&!figure?publicCharacterCard(row,blocks):null;
  // Charakterprofil: only blocks the owner shared with the group (the SL and the owner see the full profile in the sheet).
  const shared=row?sharedProfile(body):{};
  const character=row&&(figure||legacy||hasSharedProfile(shared)||images.portrait||gallery.length)?{
   id:row.id,name:row.title,
   descriptions:legacy?.descriptions??[],
   tagline:typeof figure?.tagline==='string'?figure.tagline:'',
   introduction:typeof figure?.introduction==='string'?figure.introduction:'',
   gallery,portrait:images.portrait??await portrait(a,row,true)??gallery[0]?.url??null,
   profile:shared,
  }:null;
  return {member:{id:memberId,name:identity.name,avatar:identity.hasAvatar?'/api/live-participants?view=avatar&sessionId='+encodeURIComponent(sessionId)+'&memberId='+encodeURIComponent(memberId):null,presentation:identity.presentation},own:a.id===memberId,characters,selectedCharacter:row?.id??null,character};
 }
 if(view==='sheet'){
  if(!row)return {characters,selectedCharacter:null,projection:null};
  const projection=characterDetailProjection(a,row,JSON.parse(row.body));
  if(!projection)throw new HttpError(404,'Charakterbogen nicht verfügbar.');
  return {characters,selectedCharacter:row.id,projection:{...projection,identity:{...projection.identity,portraitRef:await portrait(a,row)},permissions:{canEdit:false,canChangeRuntimeValues:false,canArchive:false}}};
 }
 if(view==='inventory'){
  if(!row)return {characters,selectedCharacter:null,publicOnly:true,items:[]};
  await characterRecord(database(),a,row.id);
  return {characters,selectedCharacter:row.id,publicOnly:false};
 }
 throw new HttpError(400,'Unbekannte Teilnehmeransicht.');
}
type GalleryFile={id:string;key:string;mime:string};

async function galleryFiles(a:Actor,ownerId:string,ids:string[]){
 if(!ids.length)return [];
 const placeholders=ids.map(()=>'?').join(',');
 return (await database().prepare(`SELECT id,key,mime FROM files WHERE owner_id=? AND campaign_id=? AND mime IN ('image/png','image/jpeg','image/webp') AND id IN (${placeholders})`).bind(ownerId,a.campaignId,...ids).all<GalleryFile>()).results;
}

function galleryEntries(value:unknown):{fileId:string;caption:string}[]{
 if(!Array.isArray(value))return [];
 return value.slice(0,8).filter(item=>item&&typeof item.fileId==='string'&&typeof item.caption==='string');
}

/** Images the owner shared at the table: the one image list of the Charakterprofil, plus a not yet merged appearance gallery. */
function sharedImages(body:Record<string,unknown>){
 const media=(Array.isArray(body.characterMedia)?body.characterMedia:[]).slice(0,8).filter((m:Record<string,unknown>)=>m&&m.shared===true&&typeof m.fileId==='string').map((m:Record<string,unknown>)=>({fileId:String(m.fileId),caption:typeof m.caption==='string'?m.caption:'',portrait:m.type==='portrait'}));
 const presentation=body.presentation as {published?:unknown;gallery?:unknown}|undefined;
 const legacy=presentation?.published===true?galleryEntries(presentation.gallery).filter(item=>!media.some(m=>m.fileId===item.fileId)).map(item=>({...item,portrait:false})):[];
 return [...media,...legacy];
}

async function participantGallery(a:Actor,sessionId:string,memberId:string,row:LegacyRecordRow,body:Record<string,unknown>){
 const entries=sharedImages(body);
 const files=await galleryFiles(a,row.owner_id,entries.map(item=>item.fileId));
 const url=(fileId:string)=>'/api/live-participants?'+new URLSearchParams({view:'figure-image',sessionId,memberId,characterId:row.id,fileId});
 const usable=entries.filter(item=>files.some(file=>file.id===item.fileId));
 const portrait=usable.find(item=>item.portrait);
 return {portrait:portrait?url(portrait.fileId):null,gallery:usable.filter(item=>!item.portrait).map(item=>({caption:item.caption,url:url(item.fileId)}))};
}

export async function participantFigureImage(a:Actor,sessionId:string,memberId:string,characterId:string,fileId:string){
 await participantContext(a,sessionId,memberId);
 const row=(await participantCharacters(a,memberId,true)).find(character=>character.id===characterId);
 if(!row||!sharedImages(JSON.parse(row.body)).some(item=>item.fileId===fileId))throw new HttpError(404,'Figurenbild nicht verfügbar.');
 const [file]=await galleryFiles(a,row.owner_id,[fileId]);
 const image=file&&env.BUCKET?await env.BUCKET.get(file.key):null;
 if(!image)throw new HttpError(404,'Figurenbild nicht verfügbar.');
 return new Response(image.body,{headers:{'Content-Type':file.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}

export async function participantAvatar(a:Actor,sessionId:string,memberId:string){
 await participantContext(a,sessionId,memberId);
 const f=await database().prepare("SELECT f.key,f.mime FROM auth_member_links l JOIN auth_users u ON u.id=l.auth_user_id AND u.status='active' JOIN auth_profiles p ON p.user_id=l.auth_user_id JOIN files f ON f.id=p.avatar_file_id WHERE l.member_id=? AND f.owner_id=? AND f.campaign_id=? AND f.mime IN ('image/png','image/jpeg','image/webp') AND f.visibility='private'").bind(memberId,memberId,a.campaignId).first<{key:string;mime:string}>();
 if(!f||!env.BUCKET)throw new HttpError(404,'Kein Spieleravatar vorhanden.');
 const image=await env.BUCKET.get(f.key);if(!image)throw new HttpError(404,'Spieleravatar nicht vorhanden.');
 return new Response(image.body,{headers:{'Content-Type':f.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
