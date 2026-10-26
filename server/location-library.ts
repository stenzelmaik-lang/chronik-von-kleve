import type {Actor} from '@/domain/types';
import {chapterDataSchema,mediaDataSchema,LOCATION_CHAPTER_KIND,LOCATION_MEDIA_KIND,LOCATION_ADOPTION_KIND,parseLocationItemContent,locationItemSearchText,type LocationLibraryItem,type LocationLibraryData} from '@/domain/location-library';
import {slDossierChapters,slDossierChapterTitles} from '@/domain/location-dossier';
import {requireCmsPublisher,getLocationNode} from './location-cms-service';
import {HttpError} from './access';

type Row={id:string;entity_id:string;kind:string;content:string;position:number;visibility:string};
const object=(s:string)=>{try{return JSON.parse(s);}catch{return {};}};
export async function legacyLocationNote(db:D1Database,a:Actor,entityId:string){
  const row=await db.prepare("SELECT id,version,gm_secret_json FROM entity_revisions WHERE campaign_id=? AND entity_id=? AND audience_scope='gm' AND audience_key='@gm' AND status IN ('draft','in_review','approved') ORDER BY revision_no DESC LIMIT 1").bind(a.campaignId,entityId).first<{id:string;version:number;gm_secret_json:string}>();
  const value=object(row?.gm_secret_json||'{}');return {revisionId:row?.id||null,version:row?.version||0,text:typeof value.text==='string'?value.text:'',source:typeof value.source==='string'?value.source:''};
}
const map=(r:Row):LocationLibraryItem|null=>{const parsed=parseLocationItemContent(r.content,r.kind);return parsed?{id:r.id,entityId:r.entity_id,kind:r.kind===LOCATION_CHAPTER_KIND?'chapter':'media',position:r.position,...parsed}:null;};
async function selected(db:D1Database,a:Actor,entityId:string,id:string){
  const row=await db.prepare("SELECT id,entity_id,kind,content,position,visibility FROM entity_content_blocks WHERE campaign_id=? AND entity_id=? AND id=? AND kind IN (?,?) AND visibility='sl_secret'").bind(a.campaignId,entityId,id,LOCATION_CHAPTER_KIND,LOCATION_MEDIA_KIND).first<Row>();
  const item=row&&map(row);if(!row||!item)throw new HttpError(404,'Ortsinhalt nicht gefunden.');return {row,item};
}
export async function readLocationLibrary(db:D1Database,a:Actor,entityId:string,options:{id?:string;full?:boolean;history?:boolean;archived?:boolean;q?:string}={}){
  requireCmsPublisher(a);await getLocationNode(db,a,entityId);
  const rows=await db.prepare("SELECT id,entity_id,kind,content,position,visibility FROM entity_content_blocks WHERE campaign_id=? AND entity_id=? AND kind IN (?,?) AND visibility='sl_secret' ORDER BY position,id").bind(a.campaignId,entityId,LOCATION_CHAPTER_KIND,LOCATION_MEDIA_KIND).all<Row>();
  let items=rows.results.flatMap(row=>{const item=map(row);return item?[item]:[];});
  if(options.id)items=items.filter(item=>item.id===options.id);
  if(!options.archived)items=items.filter(item=>item.data.state==='active');
  if(options.q)items=items.filter(item=>locationItemSearchText(item).toLocaleLowerCase('de-DE').includes(options.q!.trim().toLocaleLowerCase('de-DE')));
  if(options.id&&!items.length)throw new HttpError(404,'Ortsinhalt nicht gefunden.');
  const adopted=!!await db.prepare('SELECT id FROM entity_content_blocks WHERE campaign_id=? AND entity_id=? AND kind=?').bind(a.campaignId,entityId,LOCATION_ADOPTION_KIND).first();
  const legacy=await legacyLocationNote(db,a,entityId);
  const history=options.history?(await db.prepare("SELECT id,type,payload,created_at,actor_id FROM world_events WHERE campaign_id=? AND entity_id=? AND type LIKE 'location.library.%' ORDER BY created_at DESC,id DESC LIMIT 100").bind(a.campaignId,entityId).all<{id:string;type:string;payload:string;created_at:string;actor_id:string}>()).results.filter(event=>!options.id||object(event.payload).itemId===options.id).map(event=>{const payload=object(event.payload);return {...event,payload:{itemId:payload.itemId,restoredFrom:payload.restoredFrom,after:payload.after?{id:payload.after.id,version:payload.after.version,title:payload.after.data?.title}:null}};}):[];
  return {items:items.map(item=>({...item,...('body' in item.data?{hasBody:!!item.data.body,data:{...item.data,body:options.full||options.id||options.q||item.data.overview?item.data.body:''}}:{url:`/api/locations/media?id=${encodeURIComponent(item.id)}&preview=1`})})),adopted,legacy:adopted?{...legacy,text:''}:legacy,history};
}
export async function writeLocationLibrary(db:D1Database,a:Actor,input:{entityId:string;kind:'chapter'|'media';id?:string;expectedVersion:number;position:number;data?:unknown;action?:'save'|'restore_version';eventId?:string}){
  requireCmsPublisher(a);await getLocationNode(db,a,input.entityId,true);
  if(!Number.isSafeInteger(input.position)||input.position<0||input.position>2147483647)throw new HttpError(400,'Ungültige Reihenfolge.');
  const existing=input.id?await selected(db,a,input.entityId,input.id):null;
  if(existing&&existing.item.kind!==input.kind)throw new HttpError(400,'Die Inhaltsart kann nicht geändert werden.');
  if((existing?.item.version||0)!==input.expectedVersion)throw new HttpError(409,'Dieser Inhalt wurde inzwischen geändert. Lade ihn neu; dein Entwurf bleibt erhalten.');
  let raw=input.data;
  if(input.action==='restore_version'){
    if(!existing||!input.eventId)throw new HttpError(400,'Wähle eine gespeicherte Version.');
    const event=await db.prepare("SELECT payload FROM world_events WHERE id=? AND campaign_id=? AND entity_id=? AND type LIKE 'location.library.%'").bind(input.eventId,a.campaignId,input.entityId).first<{payload:string}>();
    const snap=event&&object(event.payload);if(!snap||snap.itemId!==input.id||!snap.after?.data)throw new HttpError(404,'Version nicht gefunden.');raw=snap.after.data;
  }
  const parsed=(input.kind==='chapter'?chapterDataSchema:mediaDataSchema).safeParse(raw);
  if(!parsed.success)throw new HttpError(400,parsed.error.issues[0]?.message||'Ungültiger Ortsinhalt.');
  const data=parsed.data as LocationLibraryData;
  if(input.kind==='chapter'&&!existing){
    const legacy=await legacyLocationNote(db,a,input.entityId);
    const adopted=await db.prepare('SELECT id FROM entity_content_blocks WHERE campaign_id=? AND entity_id=? AND kind=?').bind(a.campaignId,input.entityId,LOCATION_ADOPTION_KIND).first();
    if(legacy.text.trim()&&!adopted)throw new HttpError(409,'Übernimm zuerst den vorhandenen Vermerk in Einzelkapitel. So entsteht keine doppelte Kapitelstruktur.');
  }
  if('fileId' in data){
    const file=await db.prepare("SELECT id,mime FROM files WHERE campaign_id=? AND id=? AND visibility='sl'").bind(a.campaignId,data.fileId).first<{id:string;mime:string}>();
    if(!file||!['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.mime))throw new HttpError(404,'Private Ortsdatei nicht gefunden.');
    if(data.hero&&!file.mime.startsWith('image/'))throw new HttpError(400,'Ein Titelbild muss ein Bild sein.');
  }
  const id=existing?.item.id||crypto.randomUUID(),now=new Date().toISOString(),version=input.expectedVersion+1;
  const content=JSON.stringify({version,updatedAt:now,data});if(content.length>90000)throw new HttpError(400,'Die Formatierung ist zu umfangreich. Bitte vereinfache die Struktur.');
  const eventId=crypto.randomUUID();
  const mutation=existing
    ?db.prepare("UPDATE entity_content_blocks SET content=?,position=? WHERE campaign_id=? AND entity_id=? AND id=? AND content=? AND visibility='sl_secret'").bind(content,input.position,a.campaignId,input.entityId,id,existing.row.content)
    :db.prepare('INSERT INTO entity_content_blocks(id,campaign_id,entity_id,kind,content,visibility,position) VALUES(?,?,?,?,?,?,?)').bind(id,a.campaignId,input.entityId,input.kind==='chapter'?LOCATION_CHAPTER_KIND:LOCATION_MEDIA_KIND,content,'sl_secret',input.position);
  const after={id,entityId:input.entityId,kind:input.kind,position:input.position,version,updatedAt:now,data};
  const statements=[mutation,db.prepare("INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,'location.library.saved',?,? WHERE changes()=1").bind(eventId,a.campaignId,input.entityId,a.id,JSON.stringify({itemId:id,before:existing?.item||null,after,restoredFrom:input.eventId||null}),now)];
  if('fileId' in data&&data.hero&&data.state==='active'){
    // Select and audit previous heroes inside the same transaction. Concurrent
    // title-image choices are serialized; the last successful save is the hero.
    statements.push(db.prepare(`INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at)
      SELECT lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-8'||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))),campaign_id,entity_id,?,'location.library.saved',
      json_object('itemId',id,'before',json_object('id',id,'entityId',entity_id,'kind','media','position',position,'version',json_extract(content,'$.version'),'data',json_extract(content,'$.data')),
      'after',json_object('id',id,'entityId',entity_id,'kind','media','position',position,'version',json_extract(content,'$.version')+1,'data',json_extract(json_set(content,'$.data.hero',json('false')),'$.data'))),?
      FROM entity_content_blocks WHERE campaign_id=? AND entity_id=? AND kind=? AND id<>? AND visibility='sl_secret' AND json_valid(content) AND json_extract(content,'$.data.hero')=1 AND json_extract(content,'$.data.state')='active' AND EXISTS(SELECT 1 FROM world_events WHERE id=?)`).bind(a.id,now,a.campaignId,input.entityId,LOCATION_MEDIA_KIND,id,eventId));
    statements.push(db.prepare(`UPDATE entity_content_blocks SET content=json_set(content,'$.data.hero',json('false'),'$.version',json_extract(content,'$.version')+1,'$.updatedAt',?) WHERE campaign_id=? AND entity_id=? AND kind=? AND id<>? AND visibility='sl_secret' AND json_valid(content) AND json_extract(content,'$.data.hero')=1 AND json_extract(content,'$.data.state')='active' AND EXISTS(SELECT 1 FROM world_events WHERE id=?)`).bind(now,a.campaignId,input.entityId,LOCATION_MEDIA_KIND,id,eventId));
  }
  const results=await db.batch(statements);
  if(!results[0].meta.changes||!results[1].meta.changes)throw new HttpError(409,'Parallel geändert. Bitte lade den Inhalt erneut.');
  return after;
}
export async function initializeLocationChapters(db:D1Database,a:Actor,entityId:string,adopt:boolean,expectedLegacyVersion?:number){
  requireCmsPublisher(a);await getLocationNode(db,a,entityId,true);
  const legacy=await legacyLocationNote(db,a,entityId);
  const present=await db.prepare('SELECT id FROM entity_content_blocks WHERE campaign_id=? AND entity_id=? AND kind IN (?,?) LIMIT 1').bind(a.campaignId,entityId,LOCATION_CHAPTER_KIND,LOCATION_ADOPTION_KIND).first();
  if(present)throw new HttpError(409,'Einzelkapitel sind bereits vorhanden. Lade die Kapitel neu.');
  if(legacy.text.trim()&&!adopt)throw new HttpError(409,'Der vorhandene Vermerk muss ausdrücklich übernommen werden.');
  if(adopt&&expectedLegacyVersion!==legacy.version)throw new HttpError(409,'Der bisherige Vermerk wurde geändert. Bitte prüfe den aktuellen Stand.');
  const chapters=adopt&&legacy.text.trim()?slDossierChapters(legacy.text).map(c=>({title:c.title,body:c.content,overview:c.overview,state:'active' as const})):slDossierChapterTitles.map(title=>({title,body:'',overview:title==='Schnellübersicht',state:'active' as const}));
  const now=new Date().toISOString(),operation=crypto.randomUUID(),marker='location-sl-adopted:'+entityId;
  const statements=[db.prepare(`INSERT INTO entity_content_blocks(id,campaign_id,entity_id,kind,content,visibility,position)
    SELECT ?,?,?,?,?,'sl_secret',0 WHERE NOT EXISTS(SELECT 1 FROM entity_content_blocks WHERE campaign_id=? AND entity_id=? AND kind IN (?,?))
    ${legacy.revisionId?'AND EXISTS(SELECT 1 FROM entity_revisions WHERE id=? AND campaign_id=? AND version=?)':''}`)
    .bind(marker,a.campaignId,entityId,LOCATION_ADOPTION_KIND,JSON.stringify({operation,sourceRevision:legacy.revisionId,sourceVersion:legacy.version}),a.campaignId,entityId,LOCATION_CHAPTER_KIND,LOCATION_ADOPTION_KIND,...(legacy.revisionId?[legacy.revisionId,a.campaignId,legacy.version]:[])),
    db.prepare("INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,'location.library.initialized',?,? WHERE changes()=1").bind(operation,a.campaignId,entityId,a.id,JSON.stringify({sourceRevision:legacy.revisionId,sourceVersion:legacy.version,count:chapters.length}),now)];
  for(const [position,chapter] of chapters.entries()){
    const parsed=chapterDataSchema.safeParse(chapter);if(!parsed.success)throw new HttpError(422,'Der Alttext kann noch nicht vollständig übernommen werden. Der Originalvermerk bleibt erhalten.');
    const id=crypto.randomUUID(),content=JSON.stringify({version:1,updatedAt:now,data:parsed.data});
    if(content.length>90000)throw new HttpError(422,'Der vorhandene Abschnitt ist zu umfangreich; er wurde nicht verändert.');
    statements.push(db.prepare("INSERT INTO entity_content_blocks(id,campaign_id,entity_id,kind,content,visibility,position) SELECT ?,?,?,?,?,'sl_secret',? WHERE EXISTS(SELECT 1 FROM world_events WHERE id=?)").bind(id,a.campaignId,entityId,LOCATION_CHAPTER_KIND,content,position,operation));
    statements.push(db.prepare("INSERT INTO world_events(id,campaign_id,entity_id,actor_id,type,payload,created_at) SELECT ?,?,?,?,'location.library.saved',?,? WHERE EXISTS(SELECT 1 FROM world_events WHERE id=?)").bind(crypto.randomUUID(),a.campaignId,entityId,a.id,JSON.stringify({itemId:id,before:null,after:{id,entityId,kind:'chapter',position,version:1,updatedAt:now,data:parsed.data}}),now,operation));
  }
  const results=await db.batch(statements);if(!results[0].meta.changes)throw new HttpError(409,'Der Vermerk wurde parallel geändert oder bereits übernommen. Bitte lade neu.');
  return {created:chapters.length,originalPreserved:true};
}
