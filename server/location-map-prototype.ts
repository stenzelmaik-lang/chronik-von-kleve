const ELECTRIC_TABERNA_ID = "place.electric-taberna";

type MapSafeProjection = {
  view: string;
  location: { id: string; discovery: string };
};

const exactPlayerKnowledge = new Set(["known", "visited", "investigated"]);

/**
 * UI-only prototype position for the already player-known Electric Taberna.
 * It is not saved to the location model or database and must be reviewed when
 * the later location geo-domain work adds vetted coordinates and provenance.
 */
export function prototypeMapMarker(
  projection: MapSafeProjection | null | undefined,
) {
  const location = projection?.location;
  if (
    projection?.view !== "player" ||
    !location ||
    location.id !== ELECTRIC_TABERNA_ID ||
    !exactPlayerKnowledge.has(location.discovery)
  ) {
    return null;
  }

  return {
    id: location.id,
    coordinates: [6.13827, 51.78993] as [longitude: number, latitude: number],
    coordinateSource: "prototype-test-coordinate" as const,
  };
}
