import type {
  DiscoveryState,
  PlaceArea,
  PlaceModel,
  PlaceNote,
  PlaceProjection,
  PlaceRoom,
  PlaceVisibility,
  PreparedActionStatus,
  PreparedPlaceAction,
  ProjectedArea,
  ProjectionActorRole,
} from "./location-types";

export const ELECTRIC_TABERNA_ID = "place.electric-taberna";
export const ELECTRIC_TABERNA_LEGACY_ENTITY_ID =
  "legacy-1bf8cd98a7c87c2e018890b4";

const roomIds = {
  entrance: "room.electric-taberna.entrance-cloakroom",
  bar: "room.electric-taberna.bar-seating",
  dancefloor: "room.electric-taberna.dancefloor-console",
  toilets: "room.electric-taberna.toilets",
  talkRoom: "room.electric-taberna.talk-room",
  staffHall: "room.electric-taberna.staff-hall",
  office: "room.electric-taberna.office",
  courtyard: "room.electric-taberna.courtyard-delivery",
  drinks: "room.electric-taberna.drinks-storage",
  rest: "room.electric-taberna.rest-room",
  maintenance: "room.electric-taberna.maintenance-exit",
} as const;

export const electricTabernaLocation: PlaceModel = {
  id: ELECTRIC_TABERNA_ID,
  legacyEntityId: ELECTRIC_TABERNA_LEGACY_ENTITY_ID,
  title: "Electric Taberna",
  subtitle: "Neon & Schatten",
  district: "Innenstadt",
  address: "Kavarinerstraße 30, 47533 Kleve",
  image: "/images/edf112ec863d6cd02b1a.jpg",
  summary:
    "Violett-blaues Neon, kalter Kaffee, ein Hauch Ozon. Werkbanktische, Field-Recordings und eine kleine Bühne ziehen Studierende, Kuriere und Nachtgestalten an.",
  atmosphere:
    "Ein elektronischer Nachtknoten in der Innenstadt: oben lebendige Bar, darunter kontrollierte Schatten. Die Electric Taberna klingt heller als der Rest der Domäne und bleibt trotzdem ein Ort, an dem jedes Gespräch Gewicht bekommt.",
  discovery: "visited",
  worldState: "active",
  markers: ["watched", "highSecurity"],
  factionSignals: [
    { label: "Elysium / Camarilla", mode: "control", visibility: "gm" },
    {
      label: "Sterbliche Öffentlichkeit",
      mode: "observation",
      visibility: "group",
    },
  ],
  areas: [
    {
      id: "area.electric-taberna.public-guests",
      order: 1,
      title: "Öffentlicher Gästebereich",
      discovery: "visited",
      worldState: "active",
      markers: ["watched"],
      visibility: "group",
      rooms: [
        room(
          roomIds.entrance,
          1,
          "01 Eingang & Garderobe",
          "visited",
          "active",
          ["watched"],
          "group",
        ),
        room(
          roomIds.bar,
          2,
          "02 Tresen & Sitzbereich",
          "visited",
          "active",
          [],
          "group",
        ),
        room(
          roomIds.dancefloor,
          3,
          "03 Tanzfläche & Pult",
          "known",
          "changed",
          ["occupied"],
          "group",
        ),
        room(roomIds.toilets, 4, "04 Toiletten", "known", "active", [], "group"),
      ],
    },
    {
      id: "area.electric-taberna.staff-back",
      order: 2,
      title: "Personal-/Hinterbereich",
      discovery: "hidden",
      worldState: "inaccessible",
      markers: ["locked", "watched"],
      visibility: "gm",
      playerHint:
        "Hinter dem Gästebereich liegt offenbar eine nicht erschlossene Zone.",
      rooms: [
        room(roomIds.talkRoom, 5, "05 Gesprächsraum", "hidden", "active", []),
        room(roomIds.staffHall, 6, "06 Personalflur", "hidden", "active", [
          "locked",
        ]),
        room(roomIds.office, 7, "07 Büro", "hidden", "inaccessible", [
          "locked",
          "watched",
        ]),
        room(roomIds.courtyard, 8, "08 Hof & Anlieferung", "hidden", "active", [
          "watched",
        ]),
      ],
    },
    {
      id: "area.electric-taberna.cellar-service",
      order: 3,
      title: "Keller & Service",
      discovery: "hidden",
      worldState: "inaccessible",
      markers: ["locked", "unstable"],
      visibility: "gm",
      rooms: [
        room(roomIds.drinks, 9, "09 Getränkevorrat", "hidden", "active", []),
        room(roomIds.rest, 10, "10 Ruheraum", "hidden", "active", []),
        room(
          roomIds.maintenance,
          11,
          "11 Wartungsgang / äußerer Ausgang",
          "hidden",
          "inaccessible",
          ["locked"],
        ),
      ],
    },
  ],
  knownInformation: [
    note(
      "info.electric-taberna.public-signal",
      "Atmosphäre",
      "Neon, Field-Recordings und Werkbanktische prägen den sichtbaren Gästebereich.",
      "insight",
      true,
      "group",
      ELECTRIC_TABERNA_ID,
    ),
    note(
      "info.electric-taberna.address",
      "Adresse",
      "Kavarinerstraße 30 in der Klever Innenstadt.",
      "note",
      false,
      "group",
      ELECTRIC_TABERNA_ID,
    ),
    note(
      "info.electric-taberna.elysium",
      "SL-Vermerk",
      "Bestehende Quelle führt den Ort als Elysium/Camarilla-Kontext. Spielerfreigabe bleibt SL-Entscheidung.",
      "note",
      true,
      "gm",
      ELECTRIC_TABERNA_ID,
    ),
  ],
  activity: [
    {
      id: "activity.electric-taberna.visited",
      label: "Electric Taberna besucht",
      targetLabel: "Öffentlicher Gästebereich",
      targetId: "area.electric-taberna.public-guests",
      time: "Letzter Spielstand",
      visibility: "group",
    },
    {
      id: "activity.electric-taberna.note",
      label: "Notiz erstellt",
      targetLabel: "Electric Taberna",
      targetId: ELECTRIC_TABERNA_ID,
      time: "Vorbereitet",
      visibility: "private",
    },
    {
      id: "activity.electric-taberna.info",
      label: "Information erhalten",
      targetLabel: "Atmosphäre",
      targetId: "info.electric-taberna.public-signal",
      time: "Vorbereitet",
      visibility: "group",
    },
  ],
  preparedActions: [
    action(
      "action.electric-taberna.office-known.group",
      "Büro bekannt machen",
      "Gruppe",
      roomIds.office,
      "ready",
    ),
    action(
      "action.electric-taberna.cellar-visited.group",
      "Keller als besucht markieren",
      "Gruppe",
      "area.electric-taberna.cellar-service",
      "open",
    ),
    action(
      "action.electric-taberna.info.player",
      "Vorbereitete Information senden",
      "Spieler",
      "info.electric-taberna.public-signal",
      "ready",
    ),
    action(
      "action.electric-taberna.vision.player",
      "Vorbereitete Vision senden",
      "Spieler",
      "vision.electric-taberna.placeholder",
      "open",
    ),
  ],
  sourceLabel:
    "Bestehender Katalogeintrag legacy-1bf8cd98a7c87c2e018890b4 und Ortssystem-Spezifikation Phase 1.",
};

function room(
  id: string,
  order: number,
  title: string,
  discovery: DiscoveryState,
  worldState: PlaceRoom["worldState"],
  markers: PlaceRoom["markers"],
  visibility: PlaceVisibility = "gm",
): PlaceRoom {
  return { id, order, title, discovery, worldState, markers, visibility };
}

function note(
  id: string,
  title: string,
  text: string,
  noteType: PlaceNote["noteType"],
  pinned: boolean,
  visibility: PlaceVisibility,
  targetId: string,
): PlaceNote {
  return { id, title, text, noteType, pinned, visibility, targetId };
}

function action(
  id: string,
  label: string,
  target: string,
  targetId: string,
  status: PreparedActionStatus,
): PreparedPlaceAction {
  return { id, label, target, status, targetId, visibility: "gm" };
}

export function projectLocationForSl(
  statusOverrides: Partial<Record<string, PreparedActionStatus>> = {},
  location: PlaceModel = electricTabernaLocation,
): PlaceProjection {
  return {
    view: "sl",
    actualRole: "gm",
    canSwitchToSl: true,
    target: "group",
    location: {
      ...location,
      areas: location.areas.map((area) => ({
        ...area,
        viewKey: area.id,
        rooms: area.rooms.map((placeRoom) => ({
          ...placeRoom,
          viewKey: placeRoom.id,
        })),
      })),
      knownInformation: location.knownInformation,
      activity: location.activity,
      preparedActions: location.preparedActions.map(
        (preparedAction) => ({
          ...preparedAction,
          status: statusOverrides[preparedAction.id] ?? preparedAction.status,
        }),
      ),
    },
  };
}

export function projectLocationForPlayer(
  actualRole: ProjectionActorRole,
  target: "group" | "player" = "group",
  location: PlaceModel = electricTabernaLocation,
): PlaceProjection {
  return {
    view: "player",
    actualRole,
    canSwitchToSl: actualRole === "gm",
    target,
    location: {
      ...location,
      legacyEntityId: "",
      markers: location.markers.filter(
        (marker) => marker !== "highSecurity",
      ),
      factionSignals: location.factionSignals.filter(
        (signal) => signal.visibility !== "gm",
      ),
      areas: location.areas.flatMap(projectAreaForPlayer),
      knownInformation: location.knownInformation
        .filter((item) => item.visibility !== "gm")
        .map((item, index) => ({
          ...item,
          id: `info-${index + 1}`,
          targetId: publicTargetKey(item.targetId, location),
        })),
      activity: location.activity
        .filter((item) => item.visibility !== "gm")
        .map((item, index) => ({
          ...item,
          id: `activity-${index + 1}`,
          targetId: publicTargetKey(item.targetId, location),
        })),
      preparedActions: undefined,
      sourceLabel: "Freigegebene Ortsprojektion.",
    },
  };
}

function projectAreaForPlayer(area: PlaceArea): ProjectedArea[] {
  if (area.visibility !== "gm" && area.discovery !== "hidden") {
    return [
      {
        order: area.order,
        title: area.title,
        discovery: area.discovery,
        worldState: area.worldState,
        markers: area.markers,
        playerHint: area.playerHint,
        viewKey: `area-${area.order}`,
        rooms: area.rooms.filter((placeRoom) => placeRoom.discovery !== "hidden" && placeRoom.visibility !== "gm").map((placeRoom) => ({
          order: placeRoom.order,
          title: placeRoom.title,
          discovery: placeRoom.discovery,
          worldState: placeRoom.worldState,
          markers: placeRoom.markers,
          short: placeRoom.short,
          viewKey: `room-${placeRoom.order}`,
        })),
      },
    ];
  }
  const releasedRooms = area.rooms.filter(room => room.discovery !== "hidden" && room.visibility !== "gm");
  if (!area.playerHint && !releasedRooms.length) return [];
  return [
    {
      order: area.order,
      title: "Nicht erschlossener Bereich",
      discovery: "rumored",
      worldState: "inaccessible",
      markers: ["locked"],
      playerHint: area.playerHint,
      rooms: releasedRooms.map(room => ({
        order: room.order, title: room.title, discovery: room.discovery,
        worldState: room.worldState, markers: room.markers, short: room.short,
        viewKey: `room-${room.order}`,
      })),
      viewKey: `area-redacted-${area.order}`,
      redacted: true,
    },
  ];
}

function publicTargetKey(targetId: string, location: PlaceModel) {
  if (targetId === location.id) return location.id;
  for (const area of location.areas) {
    if (targetId === area.id) return `area-${area.order}`;
    if (area.rooms.some((item) => item.id === targetId)) return `room-${area.order}`;
  }
  return "linked-object";
}
