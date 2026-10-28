import type {Actor} from '@/domain/types';
import type {LegacyRecordRow} from '@/domain/legacy';
import {activeCharacterBody} from '@/domain/character-selection';
import {database,HttpError,canRead} from './access';

export async function ownedActiveCharacter(a:Actor,id:string) {
  const row=await database().prepare("SELECT r.* FROM records r JOIN entities e ON e.id=r.id AND e.campaign_id=r.campaign_id WHERE r.id=? AND r.campaign_id=? AND r.owner_id=? AND r.kind='charaktere' AND e.canon_status<>'GM_SECRET'").bind(id,a.campaignId,a.id).first<LegacyRecordRow>();
  if(!row||!canRead(a,row))return null;
  try{return activeCharacterBody(JSON.parse(row.body))?row:null;}catch{return null;}
}
export async function selectedCharacter(a:Actor,userId:string,requested?:string) {
  let id=requested;
  if(id===undefined){
    const row=await database().prepare('SELECT preferences FROM auth_profiles WHERE user_id=?').bind(userId).first<{preferences:string}>();
    try{const value=JSON.parse(row?.preferences||'{}').activeCharacters?.[a.campaignId];id=typeof value==='string'?value:undefined;}catch{id=undefined;}
  }
  return id&&await ownedActiveCharacter(a,id)?id:null;
}
export async function saveSelectedCharacter(a:Actor,userId:string,id:string|null) {
  if(id&&!await ownedActiveCharacter(a,id))throw new HttpError(404,'Dieser aktive eigene Charakter ist nicht verfügbar.');
  const db=database(),path='$.activeCharacters.'+JSON.stringify(a.campaignId);
  const valid="(? IS NULL OR EXISTS(SELECT 1 FROM records r JOIN entities e ON e.id=r.id AND e.campaign_id=r.campaign_id WHERE r.id=? AND r.owner_id=? AND r.campaign_id=? AND r.kind='charaktere' AND e.canon_status<>'GM_SECRET' AND COALESCE(json_extract(r.body,'$.archived'),0)=0 AND COALESCE(json_extract(r.body,'$.recoveryOnly'),0)=0 AND COALESCE(json_extract(r.body,'$.lifecycleStatus'),'ACTIVE')<>'ARCHIVED'))";
  const args=[id,id,a.id,a.campaignId];
  const result=await db.prepare(`INSERT INTO auth_profiles(user_id,preferences) SELECT ?,json_set('{"reducedMotion":false,"compactView":false}',?,?) WHERE ${valid} ON CONFLICT(user_id) DO UPDATE SET preferences=json_set(auth_profiles.preferences,?,?) WHERE ${valid}`).bind(userId,path,id,...args,path,id,...args).run();
  if(!result.meta.changes)throw new HttpError(409,'Die Figur wurde inzwischen archiviert. Bitte erneut auswählen.');
  return {characterId:id};
}
