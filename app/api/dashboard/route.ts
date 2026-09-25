import type { LegacyRecordRow, Entry } from "@/domain/legacy";
import { actor, database, json, failure, canRead, HttpError } from "@/server/access";
import { loadEntitiesForIds, grantsFor, projectEntity } from "@/server/entities";

export const dynamic = "force-dynamic";
const kinds = ["charaktere", "termine", "wirtschaft", "gefallen", "notizen", "sitzungen", "neuigkeiten"];

function dateOf(entry: Entry) {
  const body = entry.body as Record<string, unknown>;
  const value = body.date || body.datetime || body.start;
  const date = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(date) ? date : null;
}

export async function GET(req: Request) {
  try {
    const a = await actor();
    const url = new URL(req.url);
    const requestedCharacterId = url.searchParams.get("characterId");
    const db = database();
    const [rows, grants] = await Promise.all([
      db.prepare(`SELECT * FROM records WHERE campaign_id=? AND kind IN (${kinds.map(() => "?").join(",")}) ORDER BY updated_at DESC`)
        .bind(a.campaignId, ...kinds)
        .all<LegacyRecordRow>(),
      grantsFor(db, a),
    ]);

    // Only hydrate entities that can contribute to this dashboard response.
    const eligibleRows = rows.results.filter((row) =>
      canRead(a, row) && (a.gm || row.kind !== "charaktere" || row.owner_id === a.id),
    );
    const entities = await loadEntitiesForIds(db, a.campaignId, eligibleRows.map((row) => row.id));
    const index = new Map(entities.map((entity) => [entity.id, entity]));
    const records = eligibleRows.flatMap((row) => {
      const entity = index.get(row.id);
      if (!entity) return [];
      const safe = projectEntity(a, entity, grants);
      if (!safe) return [];
      return [{
        id: row.id,
        owner_id: row.owner_id,
        kind: row.kind,
        title: row.title,
        visibility: row.visibility,
        body: safe.content,
        version: row.version,
        updated_at: row.updated_at,
        canEdit: false,
      } satisfies Entry];
    });
    const by = (kind: string) => records.filter((record) => record.kind === kind);
    const characters = by("charaktere");
    const characterChoices = characters.map((character) => ({
      id: character.id!,
      name: character.title,
      clan: typeof character.body.clan === "string" ? character.body.clan : "",
      concept: typeof character.body.concept === "string" ? character.body.concept : "",
    }));
    let selectedCharacter: Entry | null = null;
    if (requestedCharacterId) {
      selectedCharacter = characters.find((character) => character.id === requestedCharacterId) ?? null;
      if (!selectedCharacter) throw new HttpError(404, "Der ausgewählte Charakter ist nicht verfügbar.");
    } else if (characters.length === 1) {
      selectedCharacter = characters[0];
    }

    const sessions = by("sitzungen").sort((left, right) =>
      (dateOf(right) ?? Date.parse(right.updated_at || "")) - (dateOf(left) ?? Date.parse(left.updated_at || "")),
    );
    const now = Date.now();
    const upcoming = by("termine")
      .filter((record) => { const date = dateOf(record); return date !== null && date > now; })
      .sort((left, right) => (dateOf(left) || 0) - (dateOf(right) || 0))[0] || null;

    return json({
      character: selectedCharacter,
      characters: characterChoices,
      characterCount: characters.length,
      nextSession: upcoming,
      lastSession: sessions[0] || null,
      economy: by("wirtschaft")[0] || null,
      favors: by("gefallen")[0] || null,
      notes: by("notizen").slice(0, 5),
      message: by("neuigkeiten")[0] || null,
    });
  } catch (error) {
    return failure(error, req);
  }
}
