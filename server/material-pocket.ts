import {database,HttpError,type Actor} from './access';
import {inventoryWriteContext,ownCharacters,recordBody,type InventoryRecord} from './inventory';
import {writeInventoryItem} from './inventory-write';
import {richTextToPlainText} from '@/domain/location-rich-text';
import type {StageObject} from '@/domain/live-stage';

/**
 * Pocketing table material (Spielmaterial im Inventar). A player takes a released material from the table into
 * their character's inventory: the item keeps a snapshot of the table object (files, display states, effect, text)
 * in its body as `tableObject`, the object leaves the table for everyone. Laid out again, the snapshot becomes a table
 * object owned by that player and the item is archived. Only one holder at a time: the GM cannot lay out the same
 * prepared material while someone carries it, and can take it back. No new table, no migration.
 */
export type TableObject=Exclude<StageObject,{kind:'note'}>;
export type PocketSnapshot=Omit<TableObject,'id'|'rect'|'visibility'|'recipients'|'ownerId'>;
type ItemRow=InventoryRecord;

const plain=(html?:string)=>html?richTextToPlainText(html).replace(/\s+/g,' ').trim():'';
const isActive=(row:ItemRow)=>recordBody(row).lifecycleStatus!=='ARCHIVED';
export function snapshotOf(o:TableObject):PocketSnapshot{
 const {id:_id,rect:_rect,visibility:_v,recipients:_r,ownerId:_o,...rest}=o;void _id;void _rect;void _v;void _r;void _o;
 return rest;
}
export function pocketSnapshot(row:ItemRow):PocketSnapshot|null{
 const s=recordBody(row).tableObject;
 return s&&typeof s==='object'&&!Array.isArray(s)&&(s as {kind?:unknown}).kind==='document'?s as PocketSnapshot:null;
}

/** Creates the inventory item for the player's own character. Falls back to storage when the pack is full. */
export async function pocketItem(a:Actor,o:TableObject){
 if(a.gm)throw new HttpError(403,'Die Spielleitung steckt nichts ein. Nimm das Material einfach vom Tisch.');
 const db=database(),own=(await ownCharacters(db,a)).filter(c=>c.own);
 if(!own.length)throw new HttpError(409,'Zum Einstecken brauchst du einen aktiven Charakter.');
 const character=own[0];
 const input={characterId:character.id,name:(o.title||'Spielmaterial').slice(0,200),category:'Dokument' as const,description:(plain(o.documentContent)||'Vom Spieltisch eingesteckt.').slice(0,2000),quantity:1,status:'Mitgeführt' as const,visibility:'sl' as const,tags:['Spielmaterial'],slotCost:1,location:'BACKPACK' as const,testData:false};
 let created:{id:string};
 try{created=await writeInventoryItem(db,a,input,(await inventoryWriteContext(db,a,character.id)).carry.revision);}
 catch(e){
  if(!(e instanceof HttpError)||e.status!==409)throw e;
  created=await writeInventoryItem(db,a,{...input,status:'Gelagert',location:'STORED'},(await inventoryWriteContext(db,a,character.id)).carry.revision);
 }
 await db.prepare("UPDATE records SET body=json_set(body,'$.tableObject',json(?)) WHERE id=? AND campaign_id=? AND owner_id=? AND kind='inventar'").bind(JSON.stringify(snapshotOf(o)),created.id,a.campaignId,a.id).run();
 return {itemId:created.id,characterName:character.name};
}

/** Archives a pocketed item (laid out again or taken back). Only the item's owner or the GM. */
export async function archivePocket(a:Actor,itemId:string){
 const db=database(),row=await pocketRow(a,itemId);
 const r=await db.prepare("UPDATE records SET body=json_set(body,'$.lifecycleStatus','ARCHIVED'),version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND kind='inventar' AND version=?").bind(new Date().toISOString(),row.id,a.campaignId,row.version).run();
 if(!r.meta.changes)throw new HttpError(409,'Der Gegenstand wurde inzwischen geändert. Bitte neu laden.');
 return row;
}
/** Undo of an archive when the table could not be saved (the item stays in the inventory). */
export async function restorePocket(a:Actor,itemId:string){
 await database().prepare("UPDATE records SET body=json_set(body,'$.lifecycleStatus','ACTIVE'),version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND kind='inventar'").bind(new Date().toISOString(),itemId,a.campaignId).run();
}
export async function removePocket(a:Actor,itemId:string){await archivePocket(a,itemId).catch(()=>{});}

/** One active pocketed item the actor may use: their own, or (GM) anyone's. */
export async function pocketRow(a:Actor,itemId:string){
 const row=await database().prepare("SELECT * FROM records WHERE id=? AND campaign_id=? AND kind='inventar'").bind(itemId,a.campaignId).first<ItemRow>();
 if(!row||!isActive(row)||!pocketSnapshot(row)||(row.owner_id!==a.id&&!a.gm))throw new HttpError(404,'Eingesteckter Gegenstand nicht gefunden.');
 return row;
}

/** Who carries a prepared material right now (for the Regie and to keep it unique). */
export async function pocketHolders(a:Actor,sourceIds:string[]){
 if(!sourceIds.length)return new Map<string,{itemId:string;name:string}>();
 const rows=await database().prepare(`SELECT r.id,json_extract(r.body,'$.tableObject.sourceId') source,c.title name FROM records r LEFT JOIN records c ON c.id=json_extract(r.body,'$.characterId') AND c.campaign_id=r.campaign_id
  WHERE r.campaign_id=? AND r.kind='inventar' AND json_valid(r.body) AND coalesce(json_extract(r.body,'$.lifecycleStatus'),'ACTIVE')<>'ARCHIVED' AND json_extract(r.body,'$.tableObject.sourceId') IN (${sourceIds.map(()=>'?').join(',')})`).bind(a.campaignId,...sourceIds).all<{id:string;source:string;name:string|null}>();
 return new Map(rows.results.map(r=>[r.source,{itemId:r.id,name:r.name||'einem Charakter'}]));
}

/** The actor's pocketed materials (players: own; GM: everyone's, with the holder). */
export async function pocketList(a:Actor){
 const rows=await database().prepare(`SELECT r.*,c.title holder FROM records r LEFT JOIN records c ON c.id=json_extract(r.body,'$.characterId') AND c.campaign_id=r.campaign_id
  WHERE r.campaign_id=? AND r.kind='inventar' AND json_valid(r.body) AND json_type(r.body,'$.tableObject')='object' AND coalesce(json_extract(r.body,'$.lifecycleStatus'),'ACTIVE')<>'ARCHIVED' AND (r.owner_id=? OR ?=1) ORDER BY r.updated_at DESC`).bind(a.campaignId,a.id,a.gm?1:0).all<ItemRow&{holder:string|null}>();
 return rows.results.flatMap(row=>{const s=pocketSnapshot(row);if(!s?.material)return [];
  const base='/api/inventory/material?itemId='+encodeURIComponent(row.id);
  return [{id:row.id,title:row.title,holder:row.holder||'',own:row.owner_id===a.id,...(a.gm?{sourceId:s.sourceId}:{}),type:s.material.type,display:s.material.display,effect:s.material.effect,
   states:s.material.states.map(st=>({key:st.key,src:base+'&state='+encodeURIComponent(st.key)})),
   pages:s.pages?.length?s.pages.map((p,i)=>({title:p.title,src:base+'&page='+i,mime:'image/*'})):s.sourceFileId&&s.media?[{title:s.title,src:base+'&page=0',mime:s.media==='image'?'image/*':s.media==='audio'?'audio/*':s.media==='video'?'video/*':'application/pdf'}]:[],
   ...(s.documentContent?{caption:s.documentContent}:{}),...(s.material.soundFileId?{soundSrc:base+'&sound=1'}:{})}];});
}

/** File of a pocketed item, authorised by owning the item (or being GM), not by the file's own visibility. */
export async function pocketFile(a:Actor,itemId:string,q:{state?:string|null;page?:number|null;sound?:boolean}){
 const s=pocketSnapshot(await pocketRow(a,itemId))!;
 const fileId=q.sound?s.material?.soundFileId:q.state?s.material?.states.find(st=>st.key===q.state)?.fileId:q.page!==null&&q.page!==undefined?(s.pages?.length?s.pages[q.page]?.fileId:q.page===0?s.sourceFileId:undefined):undefined;
 if(!fileId)throw new HttpError(404,'Datei des Gegenstands nicht verfügbar.');
 const f=await database().prepare('SELECT id,key,mime,name FROM files WHERE id=? AND campaign_id=?').bind(fileId,a.campaignId).first<{id:string;key:string;mime:string;name:string}>();
 if(!f)throw new HttpError(404,'Datei des Gegenstands nicht verfügbar.');
 return f;
}
