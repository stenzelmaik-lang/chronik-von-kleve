export const discoveryStates = [
  "hidden",
  "rumored",
  "known",
  "visited",
  "investigated",
] as const;
export type DiscoveryState = (typeof discoveryStates)[number];

export const worldStateIds = [
  "active",
  "changed",
  "inaccessible",
  "destroyed",
  "abandoned",
] as const;
export type WorldStateId = (typeof worldStateIds)[number];

export const stateMarkerIds = [
  "dangerous",
  "locked",
  "occupied",
  "contaminated",
  "watched",
  "contested",
  "unstable",
  "highSecurity",
] as const;
export type StateMarkerId = (typeof stateMarkerIds)[number];

export const preparedActionStatusIds = ["ready", "triggered", "open"] as const;
export type PreparedActionStatus = (typeof preparedActionStatusIds)[number];

export type PlaceVisibility = "public" | "group" | "private" | "shared" | "gm";

export type PlaceGeography =
  | { status: "unknown" }
  | {
      status: "exact";
      coordinates: [longitude: number, latitude: number];
      source: string;
      reviewedAt: string;
    }
  | {
      status: "approximate";
      coordinates: [longitude: number, latitude: number];
      accuracyMeters: number;
      source: string;
      reviewedAt: string;
    };

export type FactionSignal = {
  label: string;
  mode: "control" | "observation";
  visibility: PlaceVisibility;
};

export type PlaceRoom = {
  id: string;
  order: number;
  title: string;
  discovery: DiscoveryState;
  worldState: WorldStateId;
  markers: StateMarkerId[];
  visibility: PlaceVisibility;
  short?: string;
};

export type PlaceArea = {
  id: string;
  order: number;
  title: string;
  discovery: DiscoveryState;
  worldState: WorldStateId;
  markers: StateMarkerId[];
  visibility: PlaceVisibility;
  playerHint?: string;
  rooms: PlaceRoom[];
};

export type PlaceNote = {
  id: string;
  title: string;
  text: string;
  noteType:
    | "note"
    | "suspicion"
    | "insight"
    | "question"
    | "task"
    | "memory"
    | "theory";
  pinned: boolean;
  visibility: PlaceVisibility;
  targetId: string;
};

export type PlaceActivity = {
  id: string;
  label: string;
  targetLabel: string;
  targetId: string;
  time: string;
  visibility: PlaceVisibility;
};

export type PreparedPlaceAction = {
  id: string;
  label: string;
  target: string;
  status: PreparedActionStatus;
  targetId: string;
  visibility: "gm";
};

export type PlaceModel = {
  id: string;
  legacyEntityId: string;
  title: string;
  subtitle: string;
  district: string;
  address: string;
  image: string;
  summary: string;
  atmosphere: string;
  geography?: PlaceGeography;
  discovery: DiscoveryState;
  worldState: WorldStateId;
  markers: StateMarkerId[];
  factionSignals: FactionSignal[];
  areas: PlaceArea[];
  knownInformation: PlaceNote[];
  activity: PlaceActivity[];
  preparedActions: PreparedPlaceAction[];
  sourceLabel: string;
};

export type ProjectionActorRole = "gm" | "player";
export type ProjectionView = "sl" | "player";

export type ProjectedRoom = Omit<PlaceRoom, "id" | "visibility"> & {
  viewKey: string;
};

export type ProjectedArea = Omit<PlaceArea, "id" | "visibility" | "rooms"> & {
  viewKey: string;
  rooms: ProjectedRoom[];
  redacted?: boolean;
};

export type ProjectedPlace = Omit<
  PlaceModel,
  "areas" | "knownInformation" | "activity" | "preparedActions"
> & {
  areas: ProjectedArea[];
  knownInformation: PlaceNote[];
  activity: PlaceActivity[];
  preparedActions?: PreparedPlaceAction[];
};

export type PlaceProjection = {
  view: ProjectionView;
  actualRole: ProjectionActorRole;
  canSwitchToSl: boolean;
  target: "group" | "player";
  location: ProjectedPlace;
};
