import type { DiscoveryState, PlaceGeography, ProjectedPlace } from "@/domain/location-types";

export type WorldHubPlace = Pick<
  ProjectedPlace,
  "id" | "title" | "subtitle" | "district" | "image" | "summary" | "discovery" | "worldState"
> & { geography: PlaceGeography };

export type WorldMapPlace = Pick<WorldHubPlace, "id" | "title" | "discovery" | "worldState">;

export type WorldMapMarker = WorldMapPlace & {
  coordinates: [longitude: number, latitude: number];
  precision: "exact" | "approximate" | "candidate";
  source: string;
  accuracyMeters?: number;
  editorDraft?: boolean;
};

const MAP_KNOWLEDGE = new Set<DiscoveryState>(["known", "visited", "investigated"]);

/** The exact same released collection feeds player search, place tiles, previews,
 * and markers. GM view may include unrevealed projections because the server
 * has already authorized that view. */
export function visibleWorldPlaces(places: readonly WorldHubPlace[], gmView = false): WorldHubPlace[] {
  return gmView ? [...places] : playerMapPlaces(places);
}

/** The hub response is already server-projected; this function deliberately
 * copies only the safe tile fields and never adds information from detail data. */
export function playerMapPlaces(places: readonly WorldHubPlace[]): WorldHubPlace[] {
  return places.filter((place) => place.id && place.title.trim() && MAP_KNOWLEDGE.has(place.discovery));
}

export function mapMarkersForPlaces(places: readonly WorldHubPlace[], includeUnrevealed = false): WorldMapMarker[] {
  return places.flatMap((place) => {
    if ((!includeUnrevealed && !MAP_KNOWLEDGE.has(place.discovery)) || place.geography.status === "unknown") return [];
    return [{
      id: place.id,
      title: place.title,
      discovery: place.discovery,
      worldState: place.worldState,
      coordinates: place.geography.coordinates,
      precision: place.geography.status,
      source: place.geography.source,
      ...(place.geography.status === "approximate" ? { accuracyMeters: place.geography.accuracyMeters } : {}),
    }];
  });
}

/** Keep the map focused on the one place currently selected in the tile list. */
export function activeMapMarkersForPlace(
  places: readonly WorldHubPlace[],
  activePlaceId: string | null | undefined,
  includeUnrevealed = false,
): WorldMapMarker[] {
  if (!activePlaceId) return [];
  const activePlace = places.find((place) => place.id === activePlaceId);
  return activePlace ? mapMarkersForPlaces([activePlace], includeUnrevealed) : [];
}
