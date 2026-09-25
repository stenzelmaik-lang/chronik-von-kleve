import { z } from "zod";

import { discoveryStates, worldStateIds, type PlaceProjection } from "@/domain/location-types";
import { loadLocationHub, loadPersistedLocation } from "@/server/location-repository";
import { hasMapCoordinates } from "@/server/location-geography";
import { actor, database, failure, gmOnly, HttpError, json } from "@/server/access";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  place: z.string().trim().min(1).max(160).optional(),
  view: z.enum(["sl", "player"]).optional(),
  target: z.enum(["group", "player"]).optional(),
});

function summary(projection: PlaceProjection) {
  const place = projection.location;
  return {
    id: place.id,
    title: place.title,
    subtitle: place.subtitle,
    district: place.district,
    image: place.image,
    summary: place.summary,
    discovery: place.discovery,
    worldState: place.worldState,
    geography: place.geography ?? { status: "unknown" as const },
  };
}

function mapMarker(projection: PlaceProjection) {
  const geography = projection.location.geography;
  if (projection.view !== "player" || !hasMapCoordinates(geography)) return undefined;
  return {
    id: projection.location.id,
    title: projection.location.title,
    discovery: projection.location.discovery,
    worldState: projection.location.worldState,
    coordinates: geography.coordinates,
    precision: geography.status,
    ...(geography.status === "approximate" ? { accuracyMeters: geography.accuracyMeters } : {}),
    source: geography.source,
  };
}

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
    const requestedView = parsed.data.view || (a.gm ? "sl" : "player");
    if (requestedView === "sl" && !a.gm) gmOnly(a);
    const target = parsed.data.target || (a.gm ? "group" : "player");
    const db = database();

    if (!parsed.data.place) {
      const projections = await loadLocationHub(db, a, requestedView, target);
      // This list is the only input used by the player cards, search and map.
      // Unknown locations are omitted entirely; no hidden-location count is returned.
      return json({ places: projections.map(summary), states: { discovery: discoveryStates, worldState: worldStateIds } });
    }

    const projection = await loadPersistedLocation(db, a, parsed.data.place, requestedView, target);
    if (!projection) throw new HttpError(404, "Ort nicht gefunden.");
    const marker = mapMarker(projection);
    return json({ projection, ...(marker ? { mapMarker: marker } : {}), places: [summary(projection)], states: { discovery: discoveryStates, worldState: worldStateIds } });
  } catch (e) {
    return failure(e, req);
  }
}
