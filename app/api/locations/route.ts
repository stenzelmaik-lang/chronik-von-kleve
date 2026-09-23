import { z } from "zod";

import { discoveryStates, worldStateIds } from "@/domain/location-types";
import { ELECTRIC_TABERNA_ID } from "@/domain/location-model";
import { loadPersistedLocation } from "@/server/location-repository";
import { actor, database, failure, gmOnly, HttpError, json } from "@/server/access";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  place: z.string().optional(),
  view: z.enum(["sl", "player"]).optional(),
  target: z.enum(["group", "player"]).optional(),
});

export async function GET(req: Request) {
  try {
    const a = await actor();
    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      place: url.searchParams.get("place") || undefined,
      view: url.searchParams.get("view") || undefined,
      target: url.searchParams.get("target") || undefined,
    });
    if (!parsed.success) throw new HttpError(400, "Ungültige Ortsanfrage.");
    const placeId = parsed.data.place || ELECTRIC_TABERNA_ID;
    if (placeId !== ELECTRIC_TABERNA_ID)
      throw new HttpError(404, "Ort nicht gefunden.");
    const requestedView = parsed.data.view || (a.gm ? "sl" : "player");
    if (requestedView === "sl" && !a.gm) gmOnly(a);
    const projection = await loadPersistedLocation(database(), a, placeId, requestedView, parsed.data.target || (a.gm ? "group" : "player"));
    if (!projection && !a.gm) throw new HttpError(404, "Ort nicht gefunden.");
    if (!projection)
      throw new HttpError(424, "Dieser Musterort wurde noch nicht in die Ortsdatenbank übernommen.");
    return json({
      projection,
      states: {
        discovery: discoveryStates,
        worldState: worldStateIds,
      },
      places: [
        {
          id: projection.location.id,
          title: projection.location.title,
          discovery: projection.location.discovery,
          worldState: projection.location.worldState,
        },
      ],
    });
  } catch (e) {
    return failure(e, req);
  }
}
