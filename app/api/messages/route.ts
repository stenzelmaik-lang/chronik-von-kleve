import { z } from "zod";
import type { LegacyRecordRow } from "@/domain/legacy";
import { actor, database, HttpError, input, sameOrigin, json, failure, type Actor } from "@/server/access";
import { mailActionPatch, mailActionSchema, mailCopySchema, mailFolder, mailFolderSql, personalMessageSchema, type MailBox, type MailFolder } from "@/domain/personal-message";
import { richTextFileIds,richTextToPlainText,sanitizeRichTextInput } from "@/domain/location-rich-text";
import { validatePreparationMedia } from "@/server/preparation-media";
import { personalMessageFiles } from "@/server/personal-message-files";
import { preparationRecipients } from "@/server/preparation-recipients";
import { characterBody } from "@/server/character-engine-service";
export const dynamic = "force-dynamic";

const readSchema = z.object({ id: z.string().min(1).max(100) }).strict();
const MESSAGE = "campaign_id=? AND kind='notizen' AND json_extract(body,'$.context')='sl-message'";
function requireSender(a:Actor){if(a.status!=='active'||!['player','campaign_gm','campaign_owner'].includes(a.role))throw new HttpError(403,'Nur aktive Mitglieder der Spielrunde können privat schreiben.');}
const plain = (body: Record<string, unknown>) => { const text = String(body.text ?? ""); return body.format === "rich" ? richTextToPlainText(text) : text; };
function projection(row: LegacyRecordRow, box: MailBox) {
  const body = characterBody(row.body), attachments = Array.isArray(body.attachmentIds) ? body.attachmentIds.length : 0;
  return { id: row.id, box, folder: mailFolder(body, box), title: row.title, text: body.text, senderName: body.senderName, senderId: body.senderId, recipientId: row.owner_id, readAt: body.readAt, createdAt: row.created_at,
    snippet: plain(body).replace(/\s+/g, " ").trim().slice(0, 140), attachmentCount: attachments, ...(body.replyToId ? { replyToId: body.replyToId } : {}), ...(body.forwardOfId ? { forwardOfId: body.forwardOfId } : {}) };
}
async function digest(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(v => v.toString(16).padStart(2, "0")).join(""); }
async function names(db: D1Database, a: Actor, ids: string[]) {
  const unique = [...new Set(ids)].slice(0, 40); if (!unique.length) return new Map<string, string>();
  const rows = await db.prepare(`SELECT id,name FROM members WHERE campaign_id=? AND id IN (${unique.map(() => "?").join(",")})`).bind(a.campaignId, ...unique).all<{ id: string; name: string }>();
  return new Map(rows.results.map(r => [r.id, r.name]));
}
/** One sent letter is one row per recipient; the sender sees and handles it as a single mail. */
async function sentLetters(db: D1Database, a: Actor, folder: MailFolder, before: [string, string] | null, limit: number) {
  const rows = await db.prepare(`SELECT MIN(id) AS id,MAX(title) AS title,MIN(created_at) AS created_at,MAX(body) AS body,group_concat(owner_id) AS recipient_ids FROM records
    WHERE ${MESSAGE} AND json_extract(body,'$.senderId')=? AND ${mailFolderSql(folder, "out")} GROUP BY json_extract(body,'$.clientRequestId')
    ${before ? "HAVING (MIN(created_at)<? OR (MIN(created_at)=? AND MIN(id)<?))" : ""} ORDER BY MIN(created_at) DESC,MIN(id) DESC LIMIT ?`)
    .bind(a.campaignId, a.id, ...(before ? [before[0], before[0], before[1]] : []), limit).all<LegacyRecordRow & { recipient_ids: string }>();
  const lookup = await names(db, a, rows.results.flatMap(r => r.recipient_ids.split(",")));
  return rows.results.map(r => ({ ...projection(r, "out"), text: undefined, readAt: null, recipients: r.recipient_ids.split(",").map(id => ({ id, name: lookup.get(id) || "Empfänger" })) }));
}
async function receivedLetters(db: D1Database, a: Actor, folder: MailFolder, before: [string, string] | null, limit: number) {
  const rows = await db.prepare(`SELECT * FROM records WHERE ${MESSAGE} AND owner_id=? AND ${mailFolderSql(folder, "in")}${before ? " AND (created_at<? OR (created_at=? AND id<?))" : ""} ORDER BY created_at DESC,id DESC LIMIT ?`)
    .bind(a.campaignId, a.id, ...(before ? [before[0], before[0], before[1]] : []), limit).all<LegacyRecordRow>();
  return rows.results.map(r => ({ ...projection(r, "in"), text: undefined }));
}
/** A row the actor may handle in the given box; removed copies are gone for that person. */
async function ownCopy(db: D1Database, a: Actor, id: string, box: MailBox) {
  const row = await db.prepare(`SELECT * FROM records WHERE ${MESSAGE} AND id=? AND ${box === "out" ? "json_extract(body,'$.senderId')=?" : "owner_id=?"}`).bind(a.campaignId, id, a.id).first<LegacyRecordRow>();
  if (!row || !mailFolder(characterBody(row.body), box)) throw new HttpError(404, "Nachricht nicht verfügbar.");
  return row;
}

export async function GET(req: Request) {
  try {
    const a = await actor(), db = database(), query = new URL(req.url).searchParams;
    if (query.has("recipients")) {
      requireSender(a);
      if(query.get('context')==='preparation')return json({recipients:await preparationRecipients(db,a)});
      const rows = await db.prepare("SELECT m.id,m.name,c.role FROM members m JOIN campaign_memberships c ON c.user_id=m.id WHERE c.campaign_id=? AND c.status='active' AND c.role IN ('player','campaign_owner','campaign_gm') AND m.status='active' ORDER BY m.name,m.id").bind(a.campaignId).all<{id:string;name:string;role:string}>();
      return json({ recipients: rows.results });
    }
    const requested = query.get("folder") || (query.get("sent") === "1" ? "sent" : "inbox");
    if (!["inbox", "sent", "archive", "trash"].includes(requested)) throw new HttpError(400, "Unbekannter Ordner.");
    const folder = requested as MailFolder, id = query.get("id"), box: MailBox = query.get("sent") === "1" || query.get("box") === "out" ? "out" : "in";
    if (box === "out" || folder === "sent") requireSender(a);
    const count = await db.prepare(`SELECT count(*) AS n FROM records WHERE ${MESSAGE} AND owner_id=? AND json_extract(body,'$.readAt') IS NULL AND ${mailFolderSql("inbox", "in")}`).bind(a.campaignId, a.id).first<{ n: number }>();
    if (id) {
      const row = await ownCopy(db, a, id, box), body = characterBody(row.body);
      const recipients = box === "out" ? await db.prepare(`SELECT owner_id FROM records WHERE ${MESSAGE} AND json_extract(body,'$.senderId')=? AND json_extract(body,'$.clientRequestId')=?`).bind(a.campaignId, a.id, String(body.clientRequestId)).all<{ owner_id: string }>() : null;
      const lookup = recipients ? await names(db, a, recipients.results.map(r => r.owner_id)) : null;
      return json({ messages: [{ ...projection(row, box), ...(body.format === "rich" ? { format: "rich" } : {}), attachments: await personalMessageFiles(db, a, body),
        ...(recipients ? { readAt: null, recipients: recipients.results.map(r => ({ id: r.owner_id, name: lookup!.get(r.owner_id) || "Empfänger" })) } : {}) }], unread: count?.n || 0, next: null });
    }
    const cursor = query.get("before");
    let before: [string, string] | null = null;
    if (cursor) { try { const parsed = JSON.parse(cursor); if (!Array.isArray(parsed) || parsed.length !== 2 || parsed.some(v => typeof v !== "string" || v.length > 100)) throw new Error(); before = [parsed[0], parsed[1]]; } catch { throw new HttpError(400, "Ungültige Archivposition."); } }
    if (folder === "inbox" || folder === "sent") {
      const messages = folder === "sent" ? await sentLetters(db, a, folder, before, 50) : await receivedLetters(db, a, folder, before, 50), last = messages.at(-1);
      return json({ messages, unread: count?.n || 0, next: messages.length === 50 && last ? JSON.stringify([last.createdAt, last.id]) : null });
    }
    // Archive and trash hold received and sent letters together, like a mail client.
    const canSend = a.status === "active" && ["player", "campaign_gm", "campaign_owner"].includes(a.role);
    const messages = [...await receivedLetters(db, a, folder, null, 200), ...(canSend ? await sentLetters(db, a, folder, null, 200) : [])]
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt) || y.id.localeCompare(x.id));
    return json({ messages, unread: count?.n || 0, next: null });
  } catch (e) { return failure(e, req); }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req); const a = await actor(); requireSender(a);
    const parsed = personalMessageSchema.safeParse(await input(req)); if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const d = parsed.data;
    if(d.format==='rich'&&!a.gm)throw new HttpError(403,"Formatierte Regiebotschaften kann nur die Spielleitung versenden.");
    const text=d.format==='rich'?sanitizeRichTextInput(d.text):d.text.trim();
    const attachmentIds=[...new Set([...(d.fileIds||[]),...(d.format==='rich'?richTextFileIds(text):[])])];
    if(attachmentIds.length>20)throw new HttpError(400,"Höchstens 20 Dateien je Botschaft.");
    // Attachments must be readable by the sender on their own account. A file that only
    // reached them through someone else's letter (e.g. an SL handout) cannot be passed on.
    if(attachmentIds.length||d.format==='rich')await validatePreparationMedia(database(),a,d.format==='rich'?[text]:[],attachmentIds.map(id=>({id,kind:"handout"})));
    const recipients = [...new Set(d.recipients)], db = database();
    const related = d.replyToId || d.forwardOfId;
    if (related && !await db.prepare(`SELECT id FROM records WHERE ${MESSAGE} AND id=? AND (owner_id=? OR json_extract(body,'$.senderId')=?)`).bind(a.campaignId, related, a.id, a.id).first()) throw new HttpError(404, "Ursprünglicher Brief nicht verfügbar.");
    const members = await db.prepare(`SELECT m.id FROM members m JOIN campaign_memberships c ON c.user_id=m.id WHERE c.campaign_id=? AND c.status='active' AND c.role IN ('player','campaign_owner','campaign_gm') AND m.status='active' AND m.id IN (${recipients.map(() => "?").join(",")})`).bind(a.campaignId, ...recipients).all<{id:string}>();
    if (members.results.length !== recipients.length) throw new HttpError(403, "Alle Empfänger müssen aktive Mitglieder dieser Kampagne sein.");
    const links = { ...(d.replyToId ? { replyToId: d.replyToId } : {}), ...(d.forwardOfId ? { forwardOfId: d.forwardOfId } : {}) };
    const files = attachmentIds.length || d.format === "rich" ? { attachmentIds } : {};
    const hash = await digest(JSON.stringify({ title: d.title, text, recipients: [...recipients].sort(),...(d.format==='rich'?{format:'rich'}:{}),...(attachmentIds.length||d.format==='rich'?{attachmentIds:[...attachmentIds].sort()}:{}),...links }));
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
      .bind(id, a.campaignId, recipient, d.title, JSON.stringify({ context: "sl-message", senderId: a.id, senderName: a.name, recipientId: recipient, text, ...(d.format==='rich'?{format:'rich'}:{}), ...files, ...links, readAt: null, clientRequestId: d.clientRequestId, hash }), now, now, a.campaignId, a.id, d.clientRequestId, hash)));
    const saved = await db.prepare("SELECT * FROM records WHERE campaign_id=? AND json_extract(body,'$.context')='sl-message' AND json_extract(body,'$.senderId')=? AND json_extract(body,'$.clientRequestId')=?")
      .bind(a.campaignId, a.id, d.clientRequestId).all<LegacyRecordRow>();
    if (saved.results.some(r => characterBody(r.body).hash !== hash)) throw new HttpError(409, "Diese Sendung wurde bereits mit anderem Inhalt gespeichert.");
    return json({ sent: saved.results.length, ids: saved.results.map(r => r.id) });
  } catch (e) { return failure(e, req); }
}
/** Keeps a letter as the person's own note in "Meine Notizen". Idempotent per letter and person. */
async function copyToNotes(db: D1Database, a: Actor, id: string, box: MailBox) {
  const row = await ownCopy(db, a, id, box), body = characterBody(row.body);
  const existing = await db.prepare("SELECT id FROM records WHERE campaign_id=? AND owner_id=? AND kind='notizen' AND json_valid(body) AND json_extract(body,'$.sourceMessageId')=?").bind(a.campaignId, a.id, row.id).first<{ id: string }>();
  if (existing) return { noteId: existing.id, existing: true };
  const attachments = (await personalMessageFiles(db, a, body)).map(({ id, name, mime }) => ({ id, name, mime }));
  const party = box === "in" ? `Brief von ${String(body.senderName || "Unbekannt")}` : `Brief an ${(await names(db, a, [row.owner_id])).get(row.owner_id) || "Empfänger"}`;
  const noteId = crypto.randomUUID(), now = new Date().toISOString();
  // Only the letter snapshot the reader already sees is copied, never gm_body or other copies.
  const note = { text: plain(body).slice(0, 90000), summary: `${party} · ${new Date(row.created_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}`, date: row.created_at.slice(0, 10), source: "Postfach", sourceMessageId: row.id, attachmentIds: attachments.map(f => f.id), attachments };
  await db.prepare("INSERT INTO records(id,campaign_id,owner_id,kind,visibility,title,body,gm_body,created_at,updated_at) VALUES (?,?,?,'notizen','private',?,?,'',?,?)")
    .bind(noteId, a.campaignId, a.id, row.title.slice(0, 200), JSON.stringify(note), now, now).run();
  return { noteId, existing: false };
}
export async function PATCH(req: Request) {
  try {
    sameOrigin(req); const a = await actor(), raw = await input(req), db = database(), now = new Date().toISOString();
    const copy = mailCopySchema.safeParse(raw);
    if (copy.success) { if (copy.data.box === "out") requireSender(a); return json(await copyToNotes(db, a, copy.data.id, copy.data.box)); }
    const legacy = readSchema.safeParse(raw), parsed = legacy.success ? { success: true as const, data: { action: "read" as const, box: "in" as const, ids: [legacy.data.id] } } : mailActionSchema.safeParse(raw);
    if (!parsed.success) throw new HttpError(400, "Nachricht auswählen.");
    const { action, box, ids } = parsed.data;
    if (box === "out") requireSender(a);
    const rows = await Promise.all([...new Set(ids)].map(id => ownCopy(db, a, id, box)));
    // A sent letter is handled as a whole: the sender's state applies to every recipient copy.
    const targets = box === "in" ? rows : [...new Map((await Promise.all(rows.map(r => db.prepare(`SELECT * FROM records WHERE ${MESSAGE} AND json_extract(body,'$.senderId')=? AND json_extract(body,'$.clientRequestId')=?`)
      .bind(a.campaignId, a.id, String(characterBody(r.body).clientRequestId)).all<LegacyRecordRow>()))).flatMap(r => r.results).map(r => [r.id, r])).values()];
    const updates = targets.map(row => { const result = mailActionPatch(characterBody(row.body), box, action, now); if ("error" in result) throw new HttpError(409, result.error); return { row, patch: Object.entries(result.patch) }; });
    const results = await db.batch(updates.map(({ row, patch }) => db.prepare(`UPDATE records SET body=json_set(body,${patch.map(([key]) => `'$.${key}',?`).join(",")}),version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND version=?`)
      .bind(...patch.map(([, value]) => value), now, row.id, a.campaignId, row.version)));
    if (results.some(r => !r.meta.changes)) throw new HttpError(409, "Ein Brief wurde inzwischen geändert. Bitte das Postfach neu laden.");
    return json({ ok: true, changed: rows.length, read: action === "read" });
  } catch (e) { return failure(e, req); }
}
