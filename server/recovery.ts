import { env } from "cloudflare:workers";
import packaged from "./recovery-package.json";
import { HttpError } from "./access";
import type { Actor } from "@/domain/types";
import { sourcePointer } from "@/domain/recovery";

type Source = { id:string; sha256:string; packagePath:string|null; name:string; ref:string; recordCount:number|null; [key:string]:unknown };
type Claim = { id:string; sourceId:string; pointer:string; entityId:string|null; entityType:string; legacyId:string|null; title:string; recoveryStatus:string; [key:string]:unknown };
type Conflict = {id:string; [key:string]:unknown};
type Package = {manifest:{campaignId:string;sources:Source[];records:Claim[];conflicts:Conflict[];missingRawTables:unknown[]};blobs:Record<string,string>};
const data=packaged as unknown as Package;
export const recoveryManifest=data.manifest;
/** Explicit capability string required by the UI and API before any productive write. */
export const RECOVERY_IMPORT_MODE="confirmed-recovery-import" as const;
export type RecoveryImportMode=typeof RECOVERY_IMPORT_MODE;

export function recoveryImportPreview(importedSourceIds:ReadonlySet<string>){
  const pending=data.manifest.sources.filter(source=>!importedSourceIds.has(source.id));
  const nextSources=pending.slice(0,5);
  const nextOffset=nextSources.length?data.manifest.sources.findIndex(source=>source.id===nextSources[0].id):data.manifest.sources.length;
  return {
    nextOffset,
    nextSources:nextSources.length,
    nextRecords:nextSources.reduce((total,source)=>total+data.manifest.records.filter(record=>record.sourceId===source.id).length,0),
    nextSourceNames:nextSources.map(source=>source.name),
  };
}
const sha256=async (bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes as BufferSource)),x=>x.toString(16).padStart(2,"0")).join("");
export async function importRecovery(db:D1Database,a:Actor,offset:number,mode:RecoveryImportMode) {
  if(mode!==RECOVERY_IMPORT_MODE)throw new HttpError(400,"Produktiver Recovery-Import erfordert die ausdrückliche Bestätigung der Spielleitung.");
  if(!a.gm||a.status!=="active"||a.campaignId!==data.manifest.campaignId)throw new HttpError(403,"Nur für die Spielleitung dieser Chronik.");
  if(!env.BUCKET)throw new HttpError(503,"Quellenarchiv ist nicht erreichbar.");
  const now=new Date().toISOString();
  const known=new Set((await db.prepare("SELECT id FROM entities WHERE campaign_id=?").bind(a.campaignId).all<{id:string}>()).results.map(x=>x.id));
  const selected=data.manifest.sources.slice(offset,offset+5);
  for(const s of selected){
    const claims=data.manifest.records.filter(r=>r.sourceId===s.id);
    // Baseline links must never create a native stand-in that blocks legacy import.
    for(const r of claims)if(r.entityId?.startsWith("legacy-")&&!known.has(r.entityId)&&r.mappingBasis==="accepted catalog original kind:id SHA256 algorithm")throw new HttpError(409,"Bitte zuerst den bestehenden Legacy-Katalog importieren.");
    const key=s.packagePath?`recovery/${a.campaignId}/${s.sha256}`:null;
    if(key){
      const packed=Uint8Array.from(atob(data.blobs[s.sha256]),x=>x.charCodeAt(0));
      const raw=new Uint8Array(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
      if(await sha256(raw)!==s.sha256)throw new Error("Recovery original checksum mismatch");
      const existing=await env.BUCKET.get(key);
      if(existing&&await sha256(new Uint8Array(await existing.arrayBuffer()))!==s.sha256)throw new Error("Stored original checksum mismatch");
      if(!existing)await env.BUCKET.put(key,raw,{httpMetadata:{contentType:"application/octet-stream"}});
    }
    await db.prepare("INSERT OR IGNORE INTO recovery_sources(id,campaign_id,sha256,r2_key,metadata,created_at) VALUES(?,?,?,?,?,?)").bind(s.id,a.campaignId,s.sha256,key,JSON.stringify(s),now).run();
    const done=new Set((await db.prepare("SELECT id FROM recovery_records WHERE campaign_id=? AND source_id=?").bind(a.campaignId,s.id).all<{id:string}>()).results.map(x=>x.id));
    const writes:D1PreparedStatement[]=[];
    for(const r of claims){
      if(done.has(r.id))continue;
      if(r.entityId&&!known.has(r.entityId)){
        writes.push(db.prepare("INSERT INTO entities(id,campaign_id,type,canon_status,owner_id,visibility,title,content,gm_body,version,created_at,updated_at) VALUES(?,?,?,'GM_SECRET',?,'sl',?,?,'',1,?,?) ON CONFLICT(id) DO NOTHING").bind(r.entityId,a.campaignId,r.entityType,a.id,r.title,JSON.stringify({recoveryOnly:true}),now,now));known.add(r.entityId);
      }
      writes.push(db.prepare("INSERT OR IGNORE INTO recovery_records(id,campaign_id,source_id,entity_id,legacy_id,title,recovery_status,metadata,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(r.id,a.campaignId,s.id,r.entityId,r.legacyId,r.title,r.recoveryStatus,JSON.stringify(r),now));
    }
    for(let i=0;i<writes.length;i+=50)await db.batch(writes.slice(i,i+50));
  }
  if(offset===0)await db.batch(data.manifest.conflicts.map(c=>db.prepare("INSERT OR IGNORE INTO recovery_conflicts(id,campaign_id,metadata,created_at) VALUES(?,?,?,?)").bind(c.id,a.campaignId,JSON.stringify(c),now)));
  return {next:Math.min(offset+selected.length,data.manifest.sources.length),total:data.manifest.sources.length};
}
export async function recoveryDetail(db:D1Database,a:Actor,id:string){
  if(!a.gm||a.status!=="active")throw new HttpError(403,"Nur für die Spielleitung.");
  const row=await db.prepare("SELECT r.metadata,s.r2_key,s.sha256 FROM recovery_records r JOIN recovery_sources s ON r.source_id=s.id AND r.campaign_id=s.campaign_id WHERE r.id=? AND r.campaign_id=?").bind(id,a.campaignId).first<{metadata:string;r2_key:string|null;sha256:string}>();
  if(!row)throw new HttpError(404,"Quelleintrag nicht gefunden.");
  if(!row.r2_key||!env.BUCKET)throw new HttpError(503,"Original ist nicht materialisiert.");
  const object=await env.BUCKET.get(row.r2_key);
  if(!object)throw new HttpError(503,"Original fehlt im Quellenarchiv.");
  const bytes=new Uint8Array(await object.arrayBuffer());
  if(await sha256(bytes)!==row.sha256)throw new Error("Recovery original checksum mismatch");
  const metadata=JSON.parse(row.metadata) as Claim;
  const original=sourcePointer(JSON.parse(new TextDecoder().decode(bytes).replace(/^\uFEFF/,"")),metadata.pointer);
  return {metadata,original};
}
