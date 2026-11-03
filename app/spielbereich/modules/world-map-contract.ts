import type { DiscoveryState, PlaceGeography, ProjectedPlace } from "@/domain/location-types";

export type WorldHubPlace = Pick<
  ProjectedPlace,
  "id" | "title" | "subtitle" | "district" | "image" | "summary" | "discovery" | "worldState" | "mapRisk"
> & { geography: PlaceGeography };

export type WorldMapPlace = Pick<WorldHubPlace, "id" | "title" | "discovery" | "worldState" | "mapRisk">;

export type WorldMapMarker = WorldMapPlace & {
  coordinates: [longitude: number, latitude: number];
  precision: "exact" | "approximate" | "candidate";
  source: string;
  accuracyMeters?: number;
  editorDraft?: boolean;
};

export const mapDiscoveryLabels: Record<DiscoveryState, string> = {
  hidden: "Geheim",
  rumored: "Gerücht",
  known: "Bekannt · noch nicht besucht",
  visited: "Besucht",
  investigated: "Untersucht",
};

const isCoarseRumor=(place:WorldHubPlace)=>place.discovery==="rumored"&&place.geography.status==="approximate"&&place.geography.accuracyMeters>=50000;
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
  return places.filter((place) => place.id && place.title.trim() && (MAP_KNOWLEDGE.has(place.discovery)||isCoarseRumor(place)));
}

export function mapMarkersForPlaces(places: readonly WorldHubPlace[], includeUnrevealed = false): WorldMapMarker[] {
  return places.flatMap((place) => {
    if ((!includeUnrevealed && !MAP_KNOWLEDGE.has(place.discovery)&&!isCoarseRumor(place)) || place.geography.status === "unknown") return [];
    return [{
      id: place.id,
      title: place.title,
      discovery: place.discovery,
      worldState: place.worldState,
      ...(place.mapRisk?{mapRisk:place.mapRisk}:{}),
      coordinates: place.geography.coordinates,
      precision: place.geography.status,
      source: place.geography.source,
      ...(place.geography.status === "approximate" ? { accuracyMeters: place.geography.accuracyMeters } : {}),
    }];
  });
}
