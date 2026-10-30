import { z } from "zod";
import type { LegacyRecordRow } from "@/domain/legacy";
import { actor, database, HttpError, input, sameOrigin, json, failure, type Actor } from "@/server/access";
import { personalMessageSchema } from "@/domain/personal-message";
import { richTextFileIds,sanitizeRichTextInput } from "@/domain/location-rich-text";
import { validatePreparationMedia } from "@/server/preparation-media";
import { personalMessageFiles } from "@/server/personal-message-files";
import { characterBody } from "@/server/character-engine-service";
export const dynamic = "force-dynamic";

const readSchema = z.object({ id: z.string().min(1).max(100) }).strict();
function requireSender(a:Actor){if(a.status!=='active'||!['player','campaign_gm','campaign_owner'].includes(a.role))throw new HttpError(403,'Nur aktive Mitglieder der Spielrunde können privat schreiben.');}
function projection(row: LegacyRecordRow) {
  const body = characterBody(row.body);
  return { id: row.id, title: row.title, text: body.text, senderName: body.senderName, recipientId: row.owner_id, readAt: body.readAt, createdAt: row.created_at };
}
async function digest(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(v => v.toString(16).padStart(2, "0")).join(""); }

export async function GET(req: Request) {
  try {
    const a = await actor(), db = database(), query = new URL(req.url).searchParams;
    if (query.has("recipients")) {
      requireSender(a);
      const rows = await db.prepare("SELECT m.id,m.name,c.role FROM members m JOIN campaign_memberships c ON c.user_id=m.id WHERE c.campaign_id=? AND c.status='active' AND c.role IN ('player','campaign_owner','campaign_gm') AND m.status='active' ORDER BY m.name,m.id").bind(a.campaignId).all<{id:string;name:string;role:string}>();
      return json({ recipients: rows.results });
    }
    const sent = query.get("sent") === "1"; if (sent) requireSender(a);
    const id = query.get("id"), cursor = query.get("before");
    let before: [string, string] | null = null;
    if (cursor) { try { const parsed = JSON.parse(cursor); if (!Array.isArray(parsed) || parsed.length !== 2 || parsed.some(v => typeof v !== "string" || v.length > 100)) throw new Error(); before = [parsed[0], parsed[1]]; } catch { throw new HttpError(400, "Ungültige Archivposition."); } }
    const rows = id ? await db.prepare("SELECT * FROM records WHERE campaign_id=? AND kind='notizen' AND json_extract(body,'$.context')='sl-message' AND " + (sent ? "json_extract(body,'$.senderId')=?" : "owner_id=?") + (id ? " AND id=?" : "") + " ORDER BY created_at DESC,id DESC LIMIT 200")
      .bind(a.campaignId, a.id, ...(id ? [id] : [])).all<LegacyRecordRow>() : { results: [] as LegacyRecordRow[] };
    if (id && !rows.results.length) throw new HttpError(404, "Nachricht nicht verfügbar.");
    const archive = id ? rows : await db.prepare("SELECT * FROM records WHERE campaign_id=? AND kind='notizen' AND json_extract(body,'$.context')='sl-message' AND " + (sent ? "json_extract(body,'$.senderId')=?" : "owner_id=?") + (before ? " AND (created_at<? OR (created_at=? AND id<?))" : "") + " ORDER BY created_at DESC,id DESC LIMIT 50")
      .bind(a.campaignId, a.id, ...(before ? [before[0], before[0], before[1]] : [])).all<LegacyRecordRow>();
    const count = await db.prepare("SELECT count(*) AS n FROM records WHERE campaign_id=? AND owner_id=? AND json_extract(body,'$.context')='sl-message' AND json_extract(body,'$.readAt') IS NULL").bind(a.campaignId,a.id).first<{n:number}>();
    const last = archive.results.at(-1);
    return json({ messages: await Promise.all(archive.results.map(async r => { const projected = projection(r); const body=characterBody(r.body); return id ? {...projected,...(body.format==='rich'?{format:'rich',attachments:await personalMessageFiles(db,a.campaignId,body)}:{})} : { ...projected, text: undefined }; })), unread: count?.n || 0, next: !id && archive.results.length === 50 && last ? JSON.stringify([last.created_at, last.id]) : null });
  } catch (e) { return failure(e, req); }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req); const a = await actor(); requireSender(a);
    const parsed = personalMessageSchema.safeParse(await input(req)); if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const d = parsed.data;
    if(d.format==='rich'&&!a.gm)throw new HttpError(403,"Formatierte Regiebotschaften kann nur die Spielleitung versenden.");
    const text=d.format==='rich'?sanitizeRichTextInput(d.text):d.text.trim();
    const attachmentIds=d.format==='rich'?[...new Set([...(d.fileIds||[]),...richTextFileIds(text)])]:[];
    if(attachmentIds.length>20)throw new HttpError(400,"Höchstens 20 Dateien je Botschaft.");
    if(d.format==='rich')await validatePreparationMedia(database(),a,[text],attachmentIds.map(id=>({id,kind:"handout"})));
    const recipients = [...new Set(d.recipients)], db = database();
    const members = await db.prepare(`SELECT m.id FROM members m JOIN campaign_memberships c ON c.user_id=m.id WHERE c.campaign_id=? AND c.status='active' AND c.role IN ('player','campaign_owner','campaign_gm') AND m.status='active' AND m.id IN (${recipients.map(() => "?").join(",")})`).bind(a.campaignId, ...recipients).all<{id:string}>();
    if (members.results.length !== recipients.length) throw new HttpError(403, "Alle Empfänger müssen aktive Mitglieder dieser Kampagne sein.");
    const hash = await digest(JSON.stringify({ title: d.title, text, recipients: [...recipients].sort(),...(d.format==='rich'?{format:'rich',attachmentIds:[...attachmentIds].sort()}:{}) }));
    const now = new Date().toISOString();
    const payloads = await Promise.all(recipients.map(async recipient => ({ id: "message-" + (await digest(a.campaignId + ":" + a.id + ":" + d.clientRequestId + ":" + recipient)).slice(0, 56), recipient })));
    const prior = await db.prepare("SELECT * FROM records WHERE campaign_id=? AND json_extract(body,'$.context')='sl-message' AND json_extract(body,'$.senderId')=? AND json_extract(body,'$.clientRequestId')=?")
      .bind(a.campaignId, a.id, d.clientRequestId).all<LegacyRecordRow>();
    if (prior.results.some(r => characterBody(r.body).hash !== hash)) throw new HttpError(409, "Diese Sendung wurde bereits mit anderem Inhalt gespeichert.");
    const recent = await db.prepare("SELECT count(DISTINCT json_extract(body,'$.clientRequestId')) AS n FROM records WHERE campaign_id=? AND json_extract(body,'$.context')='sl-message' AND json_extract(body,'$.senderId')=? AND created_at>?")
      .bind(a.campaignId, a.id, new Date(Date.now() - 60000).toISOString()).first<{n:number}>();
    if (!prior.results.length && (recent?.n || 0) >= 20) throw new HttpError(429, "Bitte kurz warten. Es wurden bereits viele Nachrichten gesendet.");
    // The D1 batch is atomic. A competing send using the same command identity
    // cannot append recipients or content once a different payload has won.
    await db.batch(payloads.map(({id,recipient}) => db.prepare("INSERT OR IGNORE INTO records(id,campaign_id,owner_id,kind,visibility,title,body,gm_body,version,created_at,updated_at) SELECT ?,?,?,'notizen','private',?,?,'',1,?,? WHERE NOT EXISTS (SELECT 1 FROM records WHERE campaign_id=? AND json_extract(body,'$.context')='sl-message' AND json_extract(body,'$.senderId')=? AND json_extract(body,'$.clientRequestId')=? AND json_extract(body,'$.hash')<>?)")
      .bind(id, a.campaignId, recipient, d.title, JSON.stringify({ context: "sl-message", senderId: a.id, senderName: a.name, recipientId: recipient, text, ...(d.format==='rich'?{format:'rich',attachmentIds}:{}), readAt: null, clientRequestId: d.clientRequestId, hash }), now, now, a.campaignId, a.id, d.clientRequestId, hash)));
    const saved = await db.prepare("SELECT * FROM records WHERE campaign_id=? AND json_extract(body,'$.context')='sl-message' AND json_extract(body,'$.senderId')=? AND json_extract(body,'$.clientRequestId')=?")
      .bind(a.campaignId, a.id, d.clientRequestId).all<LegacyRecordRow>();
    if (saved.results.some(r => characterBody(r.body).hash !== hash)) throw new HttpError(409, "Diese Sendung wurde bereits mit anderem Inhalt gespeichert.");
    return json({ sent: saved.results.length, ids: saved.results.map(r => r.id) });
  } catch (e) { return failure(e, req); }
}
export async function PATCH(req: Request) {
  try {
    sameOrigin(req); const a = await actor(); const parsed = readSchema.safeParse(await input(req)); if (!parsed.success) throw new HttpError(400, "Nachricht auswählen.");
    const db = database(), now = new Date().toISOString();
    const row = await db.prepare("SELECT id FROM records WHERE id=? AND campaign_id=? AND owner_id=? AND json_extract(body,'$.context')='sl-message'").bind(parsed.data.id, a.campaignId, a.id).first();
    if (!row) throw new HttpError(404, "Nachricht nicht verfügbar.");
    await db.prepare("UPDATE records SET body=json_set(body,'$.readAt',?),version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND owner_id=? AND json_extract(body,'$.readAt') IS NULL")
      .bind(now, now, parsed.data.id, a.campaignId, a.id).run();
    return json({ read: true });
  } catch (e) { return failure(e, req); }
}
