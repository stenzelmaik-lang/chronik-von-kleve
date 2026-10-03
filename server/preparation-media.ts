import type { Actor } from "@/domain/types";
import { canRead, HttpError } from "@/server/access";
import { richTextFileIds } from "@/domain/location-rich-text";
export async function validatePreparationMedia(
  db: D1Database,
  a: Actor,
  texts: string[],
  explicit: { id: string; kind: string }[] = [],
) {
  const requested = [
    ...texts.flatMap((t) =>
      richTextFileIds(t).map((id) => ({ id, kind: "image" })),
    ),
    ...explicit,
  ];
  for (const { id, kind } of requested) {
    const f = await db
      .prepare(
        "SELECT owner_id,visibility,mime FROM files WHERE id=? AND campaign_id=?",
      )
      .bind(id, a.campaignId)
      .first<{
        owner_id: string;
        visibility: "private" | "sl" | "group";
        mime: string;
      }>();
    if (!f || !canRead(a, f))
      throw new HttpError(404, "Eine Mediendatei ist nicht verfügbar.");
    if (
      ["image", "audio", "video"].includes(kind) &&
      !f.mime.startsWith(kind + "/")
    )
      throw new HttpError(400, "Diese Datei passt nicht zum Elementtyp.");
  }
}
