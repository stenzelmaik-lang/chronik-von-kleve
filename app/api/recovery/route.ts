import {actor,gmOnly,database,json,failure,sameOrigin,input,HttpError} from "@/server/access";
import {importRecovery,recoveryDetail,recoveryImportPreview,recoveryManifest,RECOVERY_IMPORT_MODE} from "@/server/recovery";
export const dynamic="force-dynamic";
export async function GET(req:Request){
  try{
    const a=await actor();gmOnly(a);const db=database();const p=new URL(req.url).searchParams;
    if(p.has("id"))return json(await recoveryDetail(db,a,p.get("id")!));
    const search=(p.get("q")||"").slice(0,200),status=(p.get("status")||"").slice(0,40);
    const rows=await db.prepare("SELECT id,source_id,entity_id,legacy_id,title,recovery_status FROM recovery_records WHERE campaign_id=? AND (?='' OR title LIKE ?) AND (?='' OR recovery_status=?) ORDER BY source_id,id LIMIT 100").bind(a.campaignId,search,'%'+search+'%',status,status).all();
    const counts=await db.batch<{n?:number;metadata?:string}>([db.prepare("SELECT COUNT(*) n FROM recovery_sources WHERE campaign_id=?").bind(a.campaignId),db.prepare("SELECT COUNT(*) n FROM recovery_records WHERE campaign_id=?").bind(a.campaignId),db.prepare("SELECT metadata FROM recovery_conflicts WHERE campaign_id=?").bind(a.campaignId)]);
    const importedSourceRows=await db.prepare("SELECT id FROM recovery_sources WHERE campaign_id=?").bind(a.campaignId).all<{id:string}>();
    const preview=recoveryImportPreview(new Set(importedSourceRows.results.map(row=>row.id)));
    return json({records:rows.results,shownLimit:100,importedSources:counts[0].results[0]?.n,importedRecords:counts[1].results[0]?.n,expectedSources:recoveryManifest.sources.length,expectedRecords:recoveryManifest.records.length,nextImportOffset:preview.nextOffset,nextImportSources:preview.nextSources,nextImportRecords:preview.nextRecords,nextImportSourceNames:preview.nextSourceNames,importMode:RECOVERY_IMPORT_MODE,conflicts:counts[2].results.map(r=>JSON.parse(String(r.metadata))),missingRawTables:recoveryManifest.missingRawTables});
  }catch(e){return failure(e,req);}
}
export async function POST(req:Request){
  try{sameOrigin(req);const a=await actor();gmOnly(a);const d=await input(req);if(!Number.isInteger(d.offset)||d.offset<0||d.offset>=recoveryManifest.sources.length)throw new HttpError(400,"Ungültiger Quellenabschnitt.");if(d.mode!==RECOVERY_IMPORT_MODE)throw new HttpError(400,"Bestätigung des Recovery-Importmodus fehlt.");return json(await importRecovery(database(),a,d.offset,d.mode));}catch(e){return failure(e,req);}
}
