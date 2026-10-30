import type {Actor} from '@/domain/types';
import {canRead} from '@/server/access';

/**
 * A sent private message is the existing recipient-bound grant; never a group grant.
 * The grant ends once that person removed the copy from their mailbox, unless they
 * kept the letter as their own note beforehand.
 */
export async function canReadPersonalMessageFile(db:D1Database,a:Actor,fileId:string) {
  return !!await db.prepare(`SELECT r.id FROM records r WHERE r.campaign_id=? AND r.kind='notizen'
    AND json_valid(r.body) AND json_extract(r.body,'$.context')='sl-message'
    AND EXISTS (SELECT 1 FROM json_each(r.body,'$.attachmentIds') f WHERE f.value=?)
    AND ((r.owner_id=? AND json_extract(r.body,'$.removedAt') IS NULL)
      OR (json_extract(r.body,'$.senderId')=? AND json_extract(r.body,'$.senderRemovedAt') IS NULL)
      OR ((r.owner_id=? OR json_extract(r.body,'$.senderId')=?) AND EXISTS (SELECT 1 FROM records n WHERE n.campaign_id=r.campaign_id
        AND n.kind='notizen' AND n.owner_id=? AND json_valid(n.body) AND json_extract(n.body,'$.sourceMessageId')=r.id)))
    LIMIT 1`)
    .bind(a.campaignId,fileId,a.id,a.id,a.id,a.id,a.id).first();
}
/** Attachment metadata; `forwardable` only when the reader may share the file from their own access. */
export async function personalMessageFiles(db:D1Database,a:Actor,body:Record<string,unknown>) {
  const ids=Array.isArray(body.attachmentIds)?body.attachmentIds.filter((id):id is string=>typeof id==='string').slice(0,20):[];
  if(!ids.length)return [];
  const rows=await db.prepare(`SELECT id,name,mime,owner_id,visibility FROM files WHERE campaign_id=? AND id IN (${ids.map(()=>'?').join(',')})`).bind(a.campaignId,...ids).all<{id:string;name:string;mime:string;owner_id:string;visibility:string}>();
  return ids.flatMap(id=>rows.results.filter(file=>file.id===id).map(file=>({id:file.id,name:file.name,mime:file.mime,forwardable:canRead(a,file)})));
}
