import type {Actor} from '@/domain/types';
import {getLocationNode,requireCmsPublisher} from './location-cms-service';
import {HttpError} from './access';
type Row={entity_id:string;parent_id:string|null;location_id:string;level:string;position:number;revision:number;attributes:string;content:string;version:number};
const parse=(s:string):Record<string,unknown>=>{try{return JSON.parse(s);}catch{return {};}};
export async function changeLocationStructure(db:D1Database,a:Actor,input:{entityId:string;expectedRevision:number;action:'rename'|'move'|'archive'|'remove'|'restore';title?:string;parentId?:string;reason:string}){
  requireCmsPublisher(a);const node=await getLocationNode(db,a,input.entityId);
  const result=await db.prepare('SELECT n.*,e.content,e.version FROM location_nodes n JOIN entities e ON e.id=n.entity_id AND e.campaign_id=n.campaign_id WHERE n.campaign_id=? AND n.location_id=?').bind(a.campaignId,node.location_id).all<Row>();
  const selected=result.results.find(r=>r.entity_id===input.entityId);if(!selected)throw new HttpError(404,'Eintrag nicht gefunden.');
  if(selected.revision!==input.expectedRevision)throw new HttpError(409,'Die Ortsstruktur wurde geändert. Bitte lade neu.');
  const ids=new Set([input.entityId]);for(let i=0;i<16;i++)for(const row of result.results)if(row.parent_id&&ids.has(row.parent_id))ids.add(row.entity_id);
  const subtree=result.results.filter(r=>ids.has(r.entity_id));if(subtree.length>250)throw new HttpError(422,'Dieser Teilbaum ist für eine einzelne Änderung zu groß. Bearbeite kleinere Abschnitte.');
  const own=parse(selected.attributes),inactive=['archived','deleted'].includes(String(own.lifecycle));
  if(inactive&&!['restore','archive','remove'].includes(input.action))throw new HttpError(409,'Stelle den Eintrag vor dem Bearbeiten wieder her.');
  let parent:Awaited<ReturnType<typeof getLocationNode>>|undefined;
  if(input.action==='move'){
    if(node.level==='location'||!input.parentId||ids.has(input.parentId))throw new HttpError(400,'Ungültiger Zielort.');
    parent=await getLocationNode(db,a,input.parentId);
    if(['archived','deleted'].includes(String(parse(parent.attributes).lifecycle)))throw new HttpError(400,'Der Zielort ist archiviert.');
    const valid=node.level==='area'?parent.level==='location':node.level==='room'?parent.level==='area':['location','area','room'].includes(parent.level);
    if(!valid)throw new HttpError(400,'Bereiche gehören zu Hauptorten, Räume zu Bereichen und Erkenntnisse zu Orten, Bereichen oder Räumen.');
  }
  if(input.action==='rename'&&(!input.title?.trim()||input.title.trim().length>160))throw new HttpError(400,'Ein Name mit höchstens 160 Zeichen ist erforderlich.');
  if(input.action==='restore'&&selected.parent_id){const p=result.results.find(r=>r.entity_id===selected.parent_id);if(p&&['archived','deleted'].includes(String(parse(p.attributes).lifecycle)))throw new HttpError(409,'Stelle zuerst den übergeordneten Eintrag wieder her.');}
  const nextPosition=parent?(await db.prepare('SELECT COALESCE(MAX(position),-1)+1 AS position FROM location_nodes WHERE campaign_id=? AND parent_id=? AND level=? AND entity_id<>?').bind(a.campaignId,parent.entity_id,node.level,input.entityId).first<{position:number}>())!.position:selected.position;
  const affected=input.action==='rename'?[selected]:subtree;
  const now=new Date().toISOString(),operation=crypto.randomUUID();
  const snapshots=affected.map(row=>{
    const attributes={...parse(row.attributes)},content={...parse(row.content)};
    if(input.action==='rename')attributes.title=input.title!.trim();
    if(input.action==='archive'||input.action==='remove'){
      if(!attributes.archiveRoot){attributes.archivePrevious=attributes.lifecycle||'active';attributes.archiveRoot=input.entityId;}
      if(attributes.archiveRoot===input.entityId){attributes.lifecycle=input.action==='archive'?'archived':'deleted';content.locationLifecycle=attributes.lifecycle;}
    }
    if(input.action==='restore'&&attributes.archiveRoot===input.entityId){attributes.lifecycle=attributes.archivePrevious||'active';delete attributes.archiveRoot;delete attributes.archivePrevious;content.locationLifecycle=attributes.lifecycle;}
    return {before:row,after:{attributes,content,position:input.action==='move'&&row.entity_id===input.entityId?nextPosition:row.position,parentId:input.action==='move'&&row.entity_id===input.entityId?parent!.entity_id:row.parent_id,locationId:parent?.location_id||row.location_id}};
  });
  // The event is the transaction's compare-and-swap gate. No mutation runs when
  // any node/entity revision or the subtree membership changed since the read.
  const guard=JSON.stringify(subtree.map(r=>({id:r.entity_id,revision:r.revision,version:r.version})));
  const statements=[db.prepare(`INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at)
    SELECT ?,?,?,?,'location.structure.changed',?,? WHERE NOT EXISTS(
      SELECT 1 FROM json_each(?) j LEFT JOIN location_nodes n ON n.campaign_id=? AND n.entity_id=json_extract(j.value,'$.id')
      LEFT JOIN entities e ON e.campaign_id=n.campaign_id AND e.id=n.entity_id
      WHERE n.entity_id IS NULL OR n.revision<>json_extract(j.value,'$.revision') OR e.version<>json_extract(j.value,'$.version'))
    AND (WITH RECURSIVE tree(id) AS (SELECT entity_id FROM location_nodes WHERE campaign_id=? AND entity_id=? UNION SELECT n.entity_id FROM location_nodes n JOIN tree t ON n.parent_id=t.id WHERE n.campaign_id=?) SELECT COUNT(*) FROM tree)=?
    ${parent?'AND EXISTS(SELECT 1 FROM location_nodes WHERE campaign_id=? AND entity_id=? AND revision=? AND attributes=?) AND (SELECT COALESCE(MAX(position),-1)+1 FROM location_nodes WHERE campaign_id=? AND parent_id=? AND level=? AND entity_id<>?)=?':''}`)
    .bind(operation,a.campaignId,input.entityId,a.id,JSON.stringify({action:input.action,reason:input.reason,snapshots}),now,guard,a.campaignId,a.campaignId,input.entityId,a.campaignId,subtree.length,...(parent?[a.campaignId,parent.entity_id,(parent as typeof parent&{revision:number}).revision,parent.attributes,a.campaignId,parent.entity_id,node.level,input.entityId,nextPosition]:[]))];
  for(const {before,after} of snapshots){
    statements.push(db.prepare('UPDATE location_nodes SET attributes=?,parent_id=?,location_id=?,position=?,revision=revision+1,updated_at=? WHERE campaign_id=? AND entity_id=? AND EXISTS(SELECT 1 FROM world_events WHERE id=?)').bind(JSON.stringify(after.attributes),after.parentId,after.locationId,after.position,now,a.campaignId,before.entity_id,operation));
    if(['archive','remove','restore'].includes(input.action))statements.push(db.prepare('UPDATE entities SET content=?,version=version+1,updated_at=? WHERE campaign_id=? AND id=? AND EXISTS(SELECT 1 FROM world_events WHERE id=?)').bind(JSON.stringify(after.content),now,a.campaignId,before.entity_id,operation));
  }
  if(parent)statements.push(db.prepare("UPDATE relationships SET source_id=? WHERE campaign_id=? AND target_id=? AND type='location.contains' AND EXISTS(SELECT 1 FROM world_events WHERE id=?)").bind(parent.entity_id,a.campaignId,input.entityId,operation));
  const saved=await db.batch(statements);if(!saved[0].meta.changes)throw new HttpError(409,'Die Struktur wurde parallel geändert. Es wurde nichts verschoben.');
  return {ok:true,locationId:parent?.location_id||node.location_id,entityId:input.entityId,revision:selected.revision+1,affected:affected.length};
}
