import type { PlaceProjection, ProjectedPlace } from "@/domain/location-types";

export type WorldMapPlace = Pick<
  ProjectedPlace,
  "id" | "title" | "discovery" | "worldState"
>;

export type WorldMapMarker = WorldMapPlace & {
  coordinates: [longitude: number, latitude: number];
  coordinateSource: "prototype-test-coordinate";
};

const EXACT_KNOWLEDGE = new Set(["known", "visited", "investigated"]);

/**
 * Map candidates can only come from the player projection. Rumors and hidden
 * places may not have an exact player-known position, even if a fixture does.
 */
export function playerMapPlaces(
  projection: PlaceProjection | null | undefined,
): WorldMapPlace[] {
  if (!projection || projection.view !== "player") return [];
  const place = projection.location;
  if (
    !place.id ||
    !place.title.trim() ||
    !EXACT_KNOWLEDGE.has(place.discovery)
  ) {
    return [];
  }

  // Deliberately project only the fields required to create a map candidate.
  return [
    {
      id: place.id,
      title: place.title,
      discovery: place.discovery,
      worldState: place.worldState,
    },
  ];
}

export function mapMarkerFor(
  place: WorldMapPlace,
  marker: WorldMapMarker | null | undefined,
): WorldMapMarker | null {
  if (!marker || marker.id !== place.id || !EXACT_KNOWLEDGE.has(place.discovery)) {
    return null;
  }
  return marker;
}
