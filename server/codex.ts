import type {Actor,Entity} from '../domain/types.ts';
import {CODEX_PRE_ALPHA_DECISION,chapterSchema,editions,sourceSchema,searchExpression,type Book,type Edition,type Contents,type Hit} from '../domain/codex.ts';
import {loadEntitiesForIds,grantsFor,projectEntity} from './entities.ts';

export class CodexError extends Error {status:number;constructor(status:number,message:string){super(message);this.status=status;}}
const sl=(a:Actor)=>a.gm&&a.status==='active'&&['campaign_gm','campaign_owner'].includes(a.role);
function book(e:Entity,review:boolean):Book{
  const c=e.content;
  const rights=c.rights==='own'?'own':c.rights==='licensed'&&typeof c.rightsEvidence==='string'&&c.rightsEvidence.trim()&&typeof c.rightsConfirmedAt==='string'&&c.rightsConfirmedAt.trim()?'licensed':'pending';
  const released=c.playerReleased===true||(c.playerReleased===undefined&&rights==='own');
  const operatorDecision=c.playerAccessBasis==='operator_pre_alpha'&&c.playerAccessDecision===CODEX_PRE_ALPHA_DECISION;
  const mayPublish=rights!=='pending'||operatorDecision;
  return {id:e.id,title:e.title,edition:editions.includes(c.edition as Edition)?c.edition as Edition:'UNKNOWN',type:String(c.bookType??'Regelwerk'),format:String(c.format??''),rights,readerReady:c.readerReady===true&&(review||(mayPublish&&released)),modified:String(c.sourceModified??''),hash:String(c.sourceHash??''),reviewOnly:review&&(!mayPublish||!released),quality:String(c.qualityNote??''),...(operatorDecision?{publicationBasis:'operator_pre_alpha' as const}:{}),...(review?{canManage:true,canRelease:mayPublish&&c.readerReady===true,playerReleased:released}:{})};
}
export async function library(db:D1Database,a:Actor,localReview=false):Promise<Book[]>{
  if(a.status!=='active')throw new CodexError(403,'Zugang nicht aktiv.');
  const viewer={...a,gm:sl(a)},grants=await grantsFor(db,viewer);
  const rows=await db.prepare("SELECT id FROM entities WHERE campaign_id=? AND type='RULE' AND json_extract(content,'$.documentKind')='codex_book'").bind(a.campaignId).all<{id:string}>();
  void localReview;
  return (await loadEntitiesForIds(db,a.campaignId,rows.results.map(r=>r.id))).filter(e=>projectEntity(viewer,e,grants)).map(e=>book(e,sl(a)));
}
// Publication is distinct from rights confirmation. This endpoint cannot grant
// a licence, mutate originals, or bypass campaign roles. D1 batch is atomic.
export async function setBookRelease(db:D1Database,a:Actor,id:string,released:boolean){
  if(!sl(a))throw new CodexError(403,'Nur für die Spielleitung.');
  const b=(await library(db,a)).find(b=>b.id===id);
  if(!b)throw new CodexError(404,'Regelwerk nicht verfügbar.');
  if(released&&!b.canRelease)throw new CodexError(403,'Dokumentierte Bereitstellungsgrundlage fehlt.');
  const now=new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE entities SET content=json_set(content,'$.playerReleased',json(?),'$.releaseActor',?,'$.releaseChangedAt',?), default_visibility=CASE WHEN ? THEN 'player_visible' ELSE default_visibility END,updated_at=?,version=version+1 WHERE id=? AND campaign_id=? AND type='RULE' AND json_extract(content,'$.documentKind')='codex_book'").bind(JSON.stringify(released),a.id,now,released?1:0,now,id,a.campaignId),
    ...(released?[db.prepare("UPDATE entity_content_blocks SET visibility='player_visible' WHERE entity_id=? AND campaign_id=? AND kind='codex_chapter'").bind(id,a.campaignId)]:[]),
  ]);
  return (await library(db,a)).find(b=>b.id===id)!;
}
async function readable(db:D1Database,a:Actor,id:string,localReview=false){
  const found=(await library(db,a,localReview)).find(b=>b.id===id);
  if(!found)throw new CodexError(404,'Regelwerk nicht verfügbar.');
  if(!found.readerReady)throw new CodexError(403,'Für dieses Regelwerk fehlen Inhaltsfreigabe oder Nutzungsrechte. Nur Metadaten verfügbar.');
  return found;
}
const visible=(a:Actor)=>sl(a)?'':" AND visibility='player_visible'";
export async function contents(db:D1Database,a:Actor,id:string,localReview=false):Promise<Contents>{
  const b=await readable(db,a,id,localReview);
  const rows=await db.prepare("SELECT id,json_extract(content,'$.title') AS title,json_extract(content,'$.sections[0].source') AS source,json_extract(content,'$.bookmarks') AS bookmarks FROM entity_content_blocks WHERE campaign_id=? AND entity_id=? AND kind='codex_chapter'"+visible(a)+' ORDER BY position,id').bind(a.campaignId,id).all<{id:string;title:string;source:string;bookmarks:string|null}>();
  // Only TOC metadata leaves this function; no chapter bodies in the response.
  const chapters=rows.results.map(r=>({id:r.id,title:r.title,source:sourceSchema.parse(JSON.parse(r.source)),bookmarks:r.bookmarks?JSON.parse(r.bookmarks):[]})) as Contents['chapters'];
  const outline=chapters.flatMap(c=>(c.bookmarks??[]).map(mark=>({...mark,chapterId:c.id}))).sort((a,b)=>(a.order??0)-(b.order??0)).map(({title,level,sectionId,chapterId})=>({title,level,sectionId,chapterId}));
  return {book:b,chapters,outline};
}
export async function readChapter(db:D1Database,a:Actor,id:string,chapter:string,localReview=false){
  await readable(db,a,id,localReview);
  const row=await db.prepare("SELECT content FROM entity_content_blocks WHERE campaign_id=? AND entity_id=? AND id=? AND kind='codex_chapter'"+visible(a)).bind(a.campaignId,id,chapter).first<{content:string}>();
  if(!row)throw new CodexError(404,'Kapitel nicht verfügbar.');
  return chapterSchema.parse(JSON.parse(row.content));
}
export async function search(db:D1Database,a:Actor,q:string,edition?:Edition,localReview=false):Promise<Hit[]>{
  const books=await library(db,a,localReview),allowed=new Map(books.filter(b=>b.readerReady&&(!edition||b.edition===edition)).map(b=>[b.id,b]));
  const expr=searchExpression(q);if(!expr||!allowed.size)return [];
  // Index lookup is restricted BEFORE LIMIT/snippet generation, not filtered afterwards.
  const ids=[...allowed.keys()];
  const rows=await db.prepare(`SELECT s.id,s.heading,s.source,b.id AS block_id,b.entity_id,json_extract(b.content,'$.title') AS chapter_title,
    snippet(codex_fts,1,'','',' … ',22) AS excerpt
    FROM codex_fts JOIN codex_sections s ON s.rowid=codex_fts.rowid
    JOIN entity_content_blocks b ON b.id=s.block_id
    WHERE codex_fts MATCH ? AND b.campaign_id=? AND b.kind='codex_chapter'
    ${sl(a)?'':"AND b.visibility='player_visible'"} AND b.entity_id IN (${ids.map(()=>'?').join(',')})
    ORDER BY bm25(codex_fts),s.id LIMIT 30`).bind(expr,a.campaignId,...ids).all<{id:string;heading:string;source:string;block_id:string;entity_id:string;chapter_title:string;excerpt:string}>();
  return rows.results.map(r=>{const b=allowed.get(r.entity_id)!;return {bookId:b.id,title:b.title,edition:b.edition,chapterId:r.block_id,chapter:r.chapter_title,sectionId:r.id.slice(r.block_id.length+1),heading:r.heading,snippet:r.excerpt,source:sourceSchema.parse(JSON.parse(r.source))};});
}
export async function pageAsset(db:D1Database,bucket:R2Bucket,a:Actor,id:string,chapter:string,page:number,localReview=false){
  const b=await readable(db,a,id,localReview),c=await readChapter(db,a,id,chapter,localReview);
  if(!c.sections.some(s=>s.kind==='page'&&s.source.page===page)||!/^[a-f0-9]{64}$/.test(b.hash))throw new CodexError(404,'Seite nicht verfügbar.');
  const object=await bucket.get(`codex-pages/${b.hash}/page-${page}.jpg`);
  if(!object)throw new CodexError(404,'Seite nicht verfügbar.');
  return new Response(object.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'}});
}
