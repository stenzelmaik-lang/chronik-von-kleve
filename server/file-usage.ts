import type {Actor} from '@/domain/types';
import {canRead} from './access';

/** Where a stored file is still in use. Titles are only named when the viewer may read the source. */
export type FileUsage={kind:'avatar'|'release'|'inventory'|'entity'|'record';label:string;title:string|null};
export type FileUsageReport={usages:FileUsage[];history:number};

const entityLabels:Record<string,string>={CHARACTER:'Charakter',NPC:'NSC',PLACE:'Ort',CLUE:'Hinweis',HANDOUT:'Handout',SESSION:'Spielabend',SCENE:'Szene',storyline:'Handlungsstrang',FACTION:'Fraktion',CHRONICLE:'Chronik',RULE:'Regel',MERCHANT:'Händler',NOTE:'Notiz',ITEM:'Gegenstand',LEGACY:'Archiv'};
const recordLabels:Record<string,string>={charaktere:'Charakter',notizen:'Notiz oder Vorbereitung',inventar:'Inventar',sitzungen:'Spielabend'};

type Db=D1Database;
type Source={title:string;owner_id:string;visibility:string;kind?:string};
const named=(a:Actor,source:Source)=>canRead(a,source)?source.title:null;

/**
 * Same predicates as the delete guard in /api/files. Scene saves are logged in
 * world_events with the full document; that log is history and never blocks deletion.
 */
export async function fileUsages(db:Db,a:Actor,id:string):Promise<FileUsageReport>{
 const [avatar,release,inventory,entities,records,history]=await db.batch([
  db.prepare('SELECT COUNT(*) AS n FROM auth_profiles WHERE avatar_file_id=?').bind(id),
  db.prepare('SELECT DISTINCT e.title,e.owner_id,e.visibility,e.type FROM entity_revision_media m JOIN entities e ON e.id=m.entity_id AND e.campaign_id=m.campaign_id WHERE m.campaign_id=? AND m.file_id=?').bind(a.campaignId,id),
  db.prepare("SELECT title,owner_id,visibility,kind FROM records WHERE campaign_id=? AND kind='inventar' AND json_valid(body) AND json_extract(body,'$.imageFileId')=?").bind(a.campaignId,id),
  db.prepare('SELECT title,owner_id,visibility,type FROM entities WHERE campaign_id=? AND (instr(content,?)>0 OR instr(gm_body,?)>0)').bind(a.campaignId,id,id),
  db.prepare('SELECT title,owner_id,visibility,kind FROM records WHERE campaign_id=? AND instr(body,?)>0').bind(a.campaignId,id),
  db.prepare('SELECT COUNT(*) AS n FROM world_events WHERE campaign_id=? AND instr(payload,?)>0').bind(a.campaignId,id),
 ]);
 const usages:FileUsage[]=[];
 if(Number((avatar.results[0] as {n:number})?.n||0)>0)usages.push({kind:'avatar',label:'Profilbild',title:null});
 for(const e of release.results as (Source&{type:string})[])usages.push({kind:'release',label:'Veröffentlichte Fassung · '+(entityLabels[e.type]||'Eintrag'),title:named(a,e)});
 for(const r of inventory.results as Source[])usages.push({kind:'inventory',label:'Inventar',title:named(a,r)});
 for(const e of entities.results as (Source&{type:string})[])usages.push({kind:'entity',label:entityLabels[e.type]||'Eintrag',title:named(a,e)});
 for(const r of records.results as Source[])if(r.kind!=='inventar')usages.push({kind:'record',label:recordLabels[r.kind||'']||'Datensatz',title:named(a,r)});
 return {usages,history:Number((history.results[0] as {n:number})?.n||0)};
}
