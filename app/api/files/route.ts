import type { FileRow } from "@/domain/legacy";
import { env } from "cloudflare:workers";
import {canReadNPCFile} from '@/server/npc-file-access';
import {canReadPersonalMessageFile} from '@/server/personal-message-files';
import {LIVE_MEDIA_TYPES,validMediaBytes} from '@/domain/media-upload';
import {
  actor,
  database,
  canRead,
  json,
  failure,
  HttpError,
  sameOrigin,
  input,
} from "@/server/access";
import {fileUsages} from '@/server/file-usage';
export const dynamic = "force-dynamic";
const types = LIVE_MEDIA_TYPES;
/** Files the actor may manage: own files, or shared SL/group files for the GM. Never other players' private files. */
const manageable = "SELECT id,owner_id,visibility FROM files WHERE id=? AND campaign_id=? AND (owner_id=? OR (?=1 AND visibility IN ('sl','group')))";
/** Small preview of an image, made by the browser of someone who may manage the file and stored next to the original. */
const thumbKey = (key: string) => key + ".thumb";
const thumbMax = 256 * 1024;
async function saveThumb(req: Request, id: string) {
  const a = await actor();
  const db = database();
  const own = await db.prepare(manageable).bind(id, a.campaignId, a.id, a.gm ? 1 : 0).first();
  const f = own && await db.prepare("SELECT key,mime FROM files WHERE id=? AND campaign_id=?").bind(id, a.campaignId).first<{ key: string; mime: string }>();
  if (!f || !f.mime.startsWith("image/")) throw new HttpError(404, "Eigene Bilddatei nicht gefunden.");
  if (Number(req.headers.get("content-length") || 0) > thumbMax) throw new HttpError(413, "Vorschaubild zu groß.");
  const bytes = new Uint8Array(await req.arrayBuffer());
  const webp = bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!webp || bytes.length > thumbMax) throw new HttpError(400, "Vorschaubild muss ein WebP bis 256 KB sein.");
  if (!env.BUCKET) throw new HttpError(503, "Dateispeicher nicht erreichbar.");
  await env.BUCKET.put(thumbKey(f.key), bytes, { httpMetadata: { contentType: "image/webp" } });
  return json({ ok: true });
}
export async function GET(req: Request) {
  try {
    const a = await actor();
    const params = new URL(req.url).searchParams;
    const id = params.get("id");
    const db = database();
    const usage = params.get("usage");
    if (usage) {
      const own = await db.prepare(manageable).bind(usage, a.campaignId, a.id, a.gm ? 1 : 0).first();
      if (!own) throw new HttpError(404, "Eigene Datei nicht gefunden.");
      return json(await fileUsages(db, a, usage));
    }
    if (!id) {
      const r = await db
        .prepare(
          "SELECT id,owner_id,visibility,name,mime,size,created_at FROM files WHERE campaign_id=? AND (owner_id=? OR visibility=? OR (visibility=? AND ?=1)) ORDER BY created_at DESC",
        )
        .bind(a.campaignId, a.id, "group", "sl", a.gm ? 1 : 0)
        .all();
      return json({ files: r.results });
    }
    const f = await db
      .prepare("SELECT * FROM files WHERE id=? AND campaign_id=?")
      .bind(id, a.campaignId)
      .first<FileRow>();
    if (!f || (!canRead(a, f) && !(f.visibility==='sl' && await canReadNPCFile(db,a,id)) && !(await canReadPersonalMessageFile(db,a,id)))) throw new HttpError(404, "Datei nicht gefunden.");
    if (!env.BUCKET)
      throw new HttpError(503, "Dateispeicher nicht erreichbar.");
    // File ids never change content. The browser may keep a copy but must ask again every time (no-cache), so the
    // access check above still runs on each use; an unchanged file costs only a 304 instead of the whole image.
    const thumbnail = params.get("size") === "thumb" && f.mime.startsWith("image/") && await env.BUCKET.head(thumbKey(f.key));
    const etag = `"${f.id}:${thumbnail ? "t" : "o"}"`;
    const headers: Record<string, string> = {
      "Content-Type": thumbnail ? "image/webp" : f.mime,
      "Content-Disposition": `${f.mime === "application/pdf" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "Cache-Control": "private, no-cache",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    };
    if (params.get("size") === "thumb" && !thumbnail) headers["X-CVK-Thumb"] = "missing";
    if (req.headers.get("If-None-Match") === etag) return new Response(null, { status: 304, headers });
    const obj = await env.BUCKET.get(thumbnail ? thumbKey(f.key) : f.key);
    if (!obj) throw new HttpError(404, "Datei nicht gefunden.");
    return new Response(obj.body, { headers });
  } catch (e) {
    return failure(e, req);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const thumbFor = new URL(req.url).searchParams.get("thumb");
    if (thumbFor) return await saveThumb(req, thumbFor);
    const a = await actor();
    if (Number(req.headers.get("content-length") || 0) > 11 * 1024 * 1024)
      throw new HttpError(413, "Bitte maximal 10 MB hochladen.");
    if(!req.body)throw new HttpError(400,'Datei fehlt.');
    const reader=req.body.getReader(),chunks:Uint8Array<ArrayBuffer>[]=[];let total=0;
    try{while(true){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>11*1024*1024){await reader.cancel();throw new HttpError(413,'Bitte maximal 10 MB hochladen.');}chunks.push(part.value.slice());}}finally{reader.releaseLock();}
    const form=await new Request(req.url,{method:'POST',headers:req.headers,body:new Blob(chunks)}).formData();
    const file = form.get("file");
    const visibility = String(form.get("visibility") || "private");
    if (
      !(file instanceof File) ||
      !types.includes(file.type) ||
      file.size === 0 ||
      file.size > 10 * 1024 * 1024
    )
      throw new HttpError(
        400,
        "Erlaubt sind Bilder, PDF, MP3/OGG/WAV/M4A und MP4/WebM bis 10 MB.",
      );
    if (!["private", "sl", "group"].includes(visibility))
      throw new HttpError(400, "Ungültige Sichtbarkeit.");
    if (visibility === "sl" && !a.gm)
      throw new HttpError(403, "SL-Dateien können nur von der Spielleitung angelegt werden.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const valid=validMediaBytes(file.type,bytes);
    if (!valid)
      throw new HttpError(
        400,
        "Dateiinhalt und Dateityp stimmen nicht überein.",
      );
    if (!env.BUCKET)
      throw new HttpError(503, "Dateispeicher nicht erreichbar.");
    const id = crypto.randomUUID(),
      key = `users/${a.id}/${id}`;
    await env.BUCKET.put(key, bytes, {
      httpMetadata: { contentType: file.type },
    });
    try {
      await database()
        .prepare(
          "INSERT INTO files(id,campaign_id,owner_id,visibility,name,mime,size,key,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          a.campaignId,
          a.id,
          visibility,
          file.name.slice(0, 200),
          file.type,
          file.size,
          key,
          new Date().toISOString(),
        )
        .run();
    } catch (e) {
      await env.BUCKET.delete(key);
      throw e;
    }
    return json({ id });
  } catch (e) {
    return failure(e, req);
  }
}
/** Change who may see a file. Players choose private/group for their own files; the GM may also mark files SL-internal. */
export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    const d = await input(req);
    const id = String(d.id || ""), visibility = String(d.visibility || "");
    if (!["private", "sl", "group"].includes(visibility)) throw new HttpError(400, "Ungültige Sichtbarkeit.");
    if (visibility === "sl" && !a.gm) throw new HttpError(403, "SL-Dateien können nur von der Spielleitung angelegt werden.");
    const db = database();
    const file = await db.prepare(manageable).bind(id, a.campaignId, a.id, a.gm ? 1 : 0).first<{ owner_id: string }>();
    if (!file) throw new HttpError(404, "Eigene Datei nicht gefunden.");
    // Another player's shared file must never become private to the GM.
    if (visibility === "private" && file.owner_id !== a.id) throw new HttpError(403, "Nur die eigene Datei kann privat gestellt werden.");
    await db.prepare("UPDATE files SET visibility=? WHERE id=? AND campaign_id=?").bind(visibility, id, a.campaignId).run();
    return json({ ok: true, visibility });
  } catch (e) {
    return failure(e, req);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    const d = await input(req);
    if (!env.BUCKET)
      throw new HttpError(503, "Dateispeicher nicht erreichbar.");
    const db=database();
    const removed=await db.prepare(`DELETE FROM files WHERE id=? AND campaign_id=? AND (owner_id=? OR (?=1 AND visibility IN ('sl','group')))
      AND NOT EXISTS (SELECT 1 FROM auth_profiles p WHERE p.avatar_file_id=files.id)
      AND NOT EXISTS (SELECT 1 FROM entity_revision_media m WHERE m.campaign_id=files.campaign_id AND m.file_id=files.id)
      AND NOT EXISTS (SELECT 1 FROM records i WHERE i.campaign_id=files.campaign_id AND i.kind='inventar' AND json_valid(i.body) AND json_extract(i.body,'$.imageFileId')=files.id)
      AND NOT EXISTS (SELECT 1 FROM entities e WHERE e.campaign_id=files.campaign_id AND (instr(e.content,files.id)>0 OR instr(e.gm_body,files.id)>0))
      AND NOT EXISTS (SELECT 1 FROM records r WHERE r.campaign_id=files.campaign_id AND instr(r.body,files.id)>0)
      RETURNING key`).bind(String(d.id),a.campaignId,a.id,a.gm?1:0).first<{key:string}>();
    // The world_events log (e.g. every scene save) is history, not a current use; it no longer blocks deletion.
    if(!removed){
      const existing=await db.prepare(manageable).bind(String(d.id),a.campaignId,a.id,a.gm?1:0).first();
      if(!existing)throw new HttpError(404,"Eigene Datei nicht gefunden.");
      const {usages}=await fileUsages(db,a,String(d.id));
      throw new HttpError(409,"Diese Datei wird noch verwendet: "+(usages.map(u=>u.title?u.label+' „'+u.title+'“':u.label).join(', ')||'in gespeicherten Inhalten')+". Entferne sie dort zuerst.");
    }
    // Remove the D1 locator first. If R2 is temporarily unavailable the object
    // is an inaccessible orphan, never a still-referenced public object.
    try{await env.BUCKET.delete([removed.key,thumbKey(removed.key)]);}catch(error){console.error("Unreachable R2 orphan after safe file metadata removal",error);}
    return json({ ok: true });
  } catch (e) {
    return failure(e, req);
  }
}
