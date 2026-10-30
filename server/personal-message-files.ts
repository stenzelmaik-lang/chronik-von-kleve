import type {Actor} from '@/domain/types';

/** A sent private message is the existing recipient-bound grant; never a group grant. */
export async function canReadPersonalMessageFile(db:D1Database,a:Actor,fileId:string) {
  return !!await db.prepare(`SELECT r.id FROM records r WHERE r.campaign_id=? AND r.kind='notizen'
    AND json_valid(r.body) AND json_extract(r.body,'$.context')='sl-message'
    AND json_extract(r.body,'$.format')='rich' AND (r.owner_id=? OR json_extract(r.body,'$.senderId')=?)
    AND EXISTS (SELECT 1 FROM json_each(r.body,'$.attachmentIds') f WHERE f.value=?) LIMIT 1`)
    .bind(a.campaignId,a.id,a.id,fileId).first();
}
export async function personalMessageFiles(db:D1Database,campaignId:string,body:Record<string,unknown>) {
  const ids=Array.isArray(body.attachmentIds)?body.attachmentIds.filter((id):id is string=>typeof id==='string').slice(0,20):[];
  if(body.format!=='rich'||!ids.length)return [];
  const rows=await db.prepare(`SELECT id,name,mime FROM files WHERE campaign_id=? AND id IN (${ids.map(()=>'?').join(',')})`).bind(campaignId,...ids).all<{id:string;name:string;mime:string}>();
  return ids.flatMap(id=>rows.results.filter(file=>file.id===id));
}
