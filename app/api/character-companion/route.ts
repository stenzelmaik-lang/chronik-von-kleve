import { z } from "zod";
import type { FileRow, LegacyRecordRow } from "@/domain/legacy";
import { isRichTextWithinLimit } from "@/domain/location-rich-text";
import {account} from '@/server/account-profile';
import {
  actor,
  canEdit,
  database,
  failure,
  HttpError,
  input,
  json,
  sameOrigin,
} from "@/server/access";

export const dynamic = "force-dynamic";

const id = z.string().min(1).max(100);
const visibility = z.enum(["private", "sl", "group"]);
const presentation = z.object({
  published: z.boolean(),
  tagline: z.string().trim().max(100),
  introduction: z.string().trim().max(1200),
  gallery: z.array(z.object({fileId:id,caption:z.string().trim().max(160)}).strict()).max(8)
    .refine(items=>new Set(items.map(item=>item.fileId)).size===items.length),
}).strict();

const schema = z.discriminatedUnion("action", [
  z.object({action:z.literal('presentation'),id,version:z.number().int().positive(),presentation}).strict(),
  z.object({action:z.literal('character.archive'),id,version:z.number().int().positive(),confirmed:z.literal(true)}).strict(),
  z.object({action:z.literal('character.restore'),id,version:z.number().int().positive(),confirmed:z.literal(true)}).strict(),
  z.object({
    action: z.literal("roleplay"),
    id,
    version: z.number().int().positive(),
    backgroundStory: z.string().max(90000),
    playGuide: z.string().max(90000),
  }),
  z.object({
    action: z.literal("media"),
    id,
    version: z.number().int().positive(),
    fileId: id,
    mediaType: z.enum(["portrait", "reference", "mood", "scene"]),
  }),
  z.object({
    action: z.literal("note.create"),
    characterId: id,
    title: z.string().trim().max(120).optional(),
    text: z.string().trim().min(1).max(90000),
    visibility: visibility.default("private"),
  }),
  z.object({
    action: z.literal("note.update"),
    characterId: id,
    noteId: id,
    version: z.number().int().positive(),
    title: z.string().trim().max(120).optional(),
    text: z.string().trim().min(1).max(90000),
    visibility: visibility.default("private"),
  }),
  z.object({
    action: z.literal("note.archive"),
    characterId: id,
    noteId: id,
    version: z.number().int().positive(),
  }),
]);

function parseBody(row: Pick<LegacyRecordRow, "body">): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(row.body || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function loadCharacter(db: D1Database, actorId: string, campaignId: string, characterId: string, allowArchived=false) {
  const character = await db
    .prepare("SELECT * FROM records WHERE id=? AND campaign_id=? AND kind='charaktere'")
    .bind(characterId, campaignId)
    .first<LegacyRecordRow>();
  if (!character) throw new HttpError(404, "Charakter nicht gefunden.");
  const entity = await db
    .prepare("SELECT canon_status FROM entities WHERE id=? AND campaign_id=?")
    .bind(characterId, campaignId)
    .first<{ canon_status: string }>();
  const body = parseBody(character);
  if (entity?.canon_status === "GM_SECRET" || body.recoveryOnly === true)
    throw new HttpError(404, "Charakter nicht gefunden.");
  if (character.owner_id !== actorId)
    throw new HttpError(403, "Nur der Besitzer bearbeitet diese Companion-Daten.");
  if(!allowArchived&&(body.archived===true||body.lifecycleStatus==='ARCHIVED'))throw new HttpError(409,'Archivierte Charaktere zuerst wiederherstellen.');
  return { character, body };
}

async function updateCharacterBody(
  db: D1Database,
  character: LegacyRecordRow,
  expectedVersion: number,
  body: Record<string, unknown>,
  selection?: {userId:string;path:string},
) {
  const now = new Date().toISOString();
  const statement = db
    .prepare(
      "UPDATE records SET body=?,version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND version=?",
    )
    .bind(
      JSON.stringify(body),
      now,
      character.id,
      character.campaign_id,
      expectedVersion,
    );
  const result=selection?(await db.batch([statement,db.prepare('UPDATE auth_profiles SET preferences=json_remove(preferences,?) WHERE user_id=? AND json_extract(preferences,?)=? AND changes()=1').bind(selection.path,selection.userId,selection.path,character.id)]))[0]:await statement.run();
  if (!result.meta.changes)
    throw new HttpError(409, "Konflikt: Charakter wurde inzwischen geändert.");
  return { version: expectedVersion + 1 };
}

async function loadOwnedImage(db: D1Database, campaignId: string, actorId: string, fileId: string) {
  const file = await db
    .prepare("SELECT * FROM files WHERE id=? AND campaign_id=?")
    .bind(fileId, campaignId)
    .first<FileRow>();
  if (!file || file.owner_id !== actorId)
    throw new HttpError(404, "Eigene Bilddatei nicht gefunden.");
  if (!file.mime.startsWith("image/"))
    throw new HttpError(400, "Nur Bilddateien können als Charakterbild verwendet werden.");
  return file;
}

async function loadEditableNote(
  db: D1Database,
  actorId: string,
  campaignId: string,
  characterId: string,
  noteId: string,
) {
  const note = await db
    .prepare("SELECT * FROM records WHERE id=? AND campaign_id=? AND kind='notizen'")
    .bind(noteId, campaignId)
    .first<LegacyRecordRow>();
  if (!note || note.owner_id !== actorId)
    throw new HttpError(404, "Eigene Notiz nicht gefunden.");
  const body = parseBody(note);
  if (body.characterId !== characterId)
    throw new HttpError(404, "Eigene Notiz nicht gefunden.");
  return { note, body };
}

export async function GET(req: Request) {
  try {
    const a=await actor();
    const characterId=id.safeParse(new URL(req.url).searchParams.get('id'));
    if(!characterId.success)throw new HttpError(400,'Charakter-ID fehlt.');
    const {character,body}=await loadCharacter(database(),a.id,a.campaignId,characterId.data);
    return json({version:character.version,presentation:presentation.safeParse(body.presentation).data??null});
  } catch(e){return failure(e,req);}
}

export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    const a = await actor();
    const parsed = schema.safeParse(await input(req));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const db = database();
    const data = parsed.data;
    if(data.action==='character.archive'||data.action==='character.restore'){
      const {character,body}=await loadCharacter(db,a.id,a.campaignId,data.id,true);
      try{const original:unknown=JSON.parse(character.body);if(!original||typeof original!=='object'||Array.isArray(original))throw Error();}catch{throw new HttpError(409,'Der ursprüngliche Charakterdatensatz ist ungültig und bleibt unverändert.');}
      const archive=data.action==='character.archive';
      body.archived=archive;
      if(archive){body.archivedAt=new Date().toISOString();body.archivedBy=a.id;}
      else if(body.lifecycleStatus==='ARCHIVED')body.lifecycleStatus='ACTIVE';
      const user=await account(req);
      return json(await updateCharacterBody(db,character,data.version,body,archive?{userId:user.id,path:'$.activeCharacters.'+JSON.stringify(a.campaignId)}:undefined));
    }
    if (data.action === "roleplay" && (!isRichTextWithinLimit(data.backgroundStory,30000) || !isRichTextWithinLimit(data.playGuide,30000)))
      throw new HttpError(400,"Der formatierte Text ist zu lang.");
    if ((data.action === "note.create" || data.action === "note.update") && !isRichTextWithinLimit(data.text,30000))
      throw new HttpError(400,"Das Dokument ist zu lang.");
    if (data.action === "roleplay") {
      const { character, body } = await loadCharacter(db, a.id, a.campaignId, data.id);
      if (!canEdit(a, character)) throw new HttpError(403, "Charakter nicht editierbar.");
      body.text = data.backgroundStory;
      body.playGuide = data.playGuide;
      return json(await updateCharacterBody(db, character, data.version, body));
    }
    if(data.action==='presentation'){
      const {character,body}=await loadCharacter(db,a.id,a.campaignId,data.id);
      try{
        const original:unknown=JSON.parse(character.body);
        if(!original||typeof original!=='object'||Array.isArray(original))throw Error();
      }catch{throw new HttpError(409,'Der ursprüngliche Charakterdatensatz ist ungültig und bleibt unverändert.');}
      if(!canEdit(a,character))throw new HttpError(403,'Charakter nicht editierbar.');
      const files=await Promise.all(data.presentation.gallery.map(item=>loadOwnedImage(db,a.campaignId,a.id,item.fileId)));
      if(files.some(file=>!['image/jpeg','image/png','image/webp'].includes(file.mime)))
        throw new HttpError(400,'Bitte JPG, PNG oder WebP auswählen.');
      body.presentation=data.presentation;
      return json(await updateCharacterBody(db,character,data.version,body));
    }
    if (data.action === "media") {
      const { character, body } = await loadCharacter(db, a.id, a.campaignId, data.id);
      if (!canEdit(a, character)) throw new HttpError(403, "Charakter nicht editierbar.");
      const file = await loadOwnedImage(db, a.campaignId, a.id, data.fileId);
      const src = `/api/files?id=${file.id}`;
      const existing = Array.isArray(body.characterMedia)
        ? (body.characterMedia as Record<string, unknown>[])
        : [];
      const media = existing.filter((item) =>
        data.mediaType === "portrait"
          ? item.type !== "portrait" && item.fileId !== file.id
          : item.fileId !== file.id,
      );
      media.unshift({
        fileId: file.id,
        type: data.mediaType,
        ref: src,
        name: file.name,
        mime: file.mime,
      });
      body.characterMedia = media.slice(0, 8);
      if (data.mediaType === "portrait") body.image = src;
      return json(await updateCharacterBody(db, character, data.version, body));
    }
    if (data.action === "note.create") {
      const { character, body: characterBody } = await loadCharacter(
        db,
        a.id,
        a.campaignId,
        data.characterId,
      );
      if (character.owner_id !== a.id)
        throw new HttpError(403, "Nur der Besitzer erstellt Character-Notizen.");
      const now = new Date().toISOString();
      const noteId = crypto.randomUUID();
      const title = data.title?.trim() || "Charakternotiz";
      await db
        .prepare(
          "INSERT INTO records(id,owner_id,kind,visibility,title,body,gm_body,created_at,updated_at,campaign_id) VALUES(?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          noteId,
          a.id,
          "notizen",
          data.visibility,
          title,
          JSON.stringify({
            characterId: character.id,
            text: data.text,
            context: "character-companion",
            archived: false,
            testData: characterBody.testData === true,
          }),
          "",
          now,
          now,
          a.campaignId,
        )
        .run();
      return json({ id: noteId, version: 1 });
    }
    if (data.action === "note.update") {
      await loadCharacter(db, a.id, a.campaignId, data.characterId);
      const { note, body } = await loadEditableNote(
        db,
        a.id,
        a.campaignId,
        data.characterId,
        data.noteId,
      );
      body.text = data.text;
      body.archived = false;
      const result = await db
        .prepare(
          "UPDATE records SET title=?,visibility=?,body=?,version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND version=?",
        )
        .bind(
          data.title?.trim() || "Charakternotiz",
          data.visibility,
          JSON.stringify(body),
          new Date().toISOString(),
          note.id,
          a.campaignId,
          data.version,
        )
        .run();
      if (!result.meta.changes)
        throw new HttpError(409, "Konflikt: Notiz wurde inzwischen geändert.");
      return json({ id: note.id, version: note.version + 1 });
    }
    await loadCharacter(db, a.id, a.campaignId, data.characterId);
    const { note, body } = await loadEditableNote(
      db,
      a.id,
      a.campaignId,
      data.characterId,
      data.noteId,
    );
    body.archived = true;
    body.archivedAt = new Date().toISOString();
    const result = await db
      .prepare(
        "UPDATE records SET body=?,version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND version=?",
      )
      .bind(JSON.stringify(body), body.archivedAt, note.id, a.campaignId, data.version)
      .run();
    if (!result.meta.changes)
      throw new HttpError(409, "Konflikt: Notiz wurde inzwischen geändert.");
    return json({ ok: true });
  } catch (error) {
    return failure(error, req);
  }
}
