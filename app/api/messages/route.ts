import { z } from "zod";
import type { LegacyRecordRow } from "@/domain/legacy";
import { actor, database, gmOnly, HttpError, input, sameOrigin, json, failure } from "@/server/access";
import { characterBody } from "@/server/character-engine-service";
export const dynamic = "force-dynamic";
const sendSchema = z.object({ clientRequestId: z.string().uuid(), recipients: z.array(z.string().min(1).max(100)).min(1).max(20), title: z.string().trim().min(1).max(160), text: z.string().trim().min(1).max(20000) }).strict();
const readSchema = z.object({ id: z.string().min(1).max(100) }).strict();
function projection(row: LegacyRecordRow) {
  const body = characterBody(row.body);
  return { id: row.id, title: row.title, text: body.text, senderName: body.senderName, recipientId: row.owner_id, readAt: body.readAt, createdAt: row.created_at };
}
async function digest(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(v => v.toString(16).padStart(2, "0")).join(""); }

export async function GET(req: Request) {
  try {
    const a = await actor(), db = database(), query = new URL(req.url).searchParams;
    if (query.has("recipients")) {
      gmOnly(a);
      const rows = await db.prepare("SELECT m.id,m.name FROM members m JOIN campaign_memberships c ON c.user_id=m.id WHERE c.campaign_id=? AND c.status='active' AND m.status='active' ORDER BY m.name,m.id").bind(a.campaignId).all<{id:string;name:string}>();
      return json({ recipients: rows.results });
    }
    const sent = query.get("sent") === "1"; if (sent) gmOnly(a);
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
    return json({ messages: archive.results.map(r => { const projected = projection(r); return id ? projected : { ...projected, text: undefined }; }), unread: count?.n || 0, next: !id && archive.results.length === 50 && last ? JSON.stringify([last.created_at, last.id]) : null });
  } catch (e) { return failure(e, req); }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req); const a = await actor(); gmOnly(a);
    const parsed = sendSchema.safeParse(await input(req)); if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const d = parsed.data, recipients = [...new Set(d.recipients)], db = database();
    const members = await db.prepare(`SELECT m.id FROM members m JOIN campaign_memberships c ON c.user_id=m.id WHERE c.campaign_id=? AND c.status='active' AND m.status='active' AND m.id IN (${recipients.map(() => "?").join(",")})`).bind(a.campaignId, ...recipients).all<{id:string}>();
    if (members.results.length !== recipients.length) throw new HttpError(403, "Alle Empfänger müssen aktive Mitglieder dieser Kampagne sein.");
    const hash = await digest(JSON.stringify({ title: d.title, text: d.text, recipients: [...recipients].sort() }));
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
      .bind(id, a.campaignId, recipient, d.title, JSON.stringify({ context: "sl-message", senderId: a.id, senderName: a.name, recipientId: recipient, text: d.text, readAt: null, clientRequestId: d.clientRequestId, hash }), now, now, a.campaignId, a.id, d.clientRequestId, hash)));
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
