import type { PlaceGeography } from "@/domain/location-types";

export type StoredLocationGeography =
  | { status: "unknown" }
  | {
      status: "exact";
      visibility: "public" | "group" | "player" | "gm";
      coordinates: [number, number];
      provenance: { source: string; reference?: string; reviewedAt: string };
    }
  | {
      status: "approximate";
      visibility: "public" | "group" | "player" | "gm";
      coordinates: [number, number];
      accuracyMeters: number;
      provenance: { source: string; reference?: string; reviewedAt: string };
    };

type GeoProvenance = { source: string; reference?: string; reviewedAt: string };
type GeoVisibility = "public" | "group" | "player" | "gm";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function validCoordinates(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 &&
    typeof value[0] === "number" && Number.isFinite(value[0]) && value[0] >= -180 && value[0] <= 180 &&
    typeof value[1] === "number" && Number.isFinite(value[1]) && value[1] >= -90 && value[1] <= 90;
}

function validProvenance(value: unknown): value is GeoProvenance {
  if (!isRecord(value) || typeof value.source !== "string" || !value.source.trim() || value.source.length > 160 ||
    typeof value.reviewedAt !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*Z)?$/.test(value.reviewedAt) || Number.isNaN(Date.parse(value.reviewedAt))) return false;
  if (value.reference !== undefined && (typeof value.reference !== "string" || value.reference.length > 500)) return false;
  return true;
}

/** Strictly reads the JSON extension stored in location_nodes.attributes. Invalid or
 * over-specified values are treated as unknown, so bad data cannot create a marker. */
export function parseStoredLocationGeography(value: unknown): StoredLocationGeography {
  if (!isRecord(value)) return { status: "unknown" };
  if (value.status === "unknown" && Object.keys(value).every((key) => key === "status")) return { status: "unknown" };
  const keys = value.status === "exact"
    ? ["status", "visibility", "coordinates", "provenance"]
    : ["status", "visibility", "coordinates", "accuracyMeters", "provenance"];
  if (!keys.every((key) => Object.hasOwn(value, key)) || Object.keys(value).some((key) => !keys.includes(key))) return { status: "unknown" };
  if (!["public", "group", "player", "gm"].includes(String(value.visibility)) || !validCoordinates(value.coordinates) || !validProvenance(value.provenance)) return { status: "unknown" };
  const provenance = {
    source: value.provenance.source.trim(),
    ...(value.provenance.reference ? { reference: value.provenance.reference } : {}),
    reviewedAt: value.provenance.reviewedAt,
  };
  if (value.status === "exact") return {
    status: "exact", visibility: value.visibility as GeoVisibility,
    coordinates: [...value.coordinates] as [number, number], provenance,
  };
  if (value.status === "approximate" && typeof value.accuracyMeters === "number" && Number.isFinite(value.accuracyMeters) && value.accuracyMeters >= 1 && value.accuracyMeters <= 1000000) return {
    status: "approximate", visibility: value.visibility as GeoVisibility,
    coordinates: [...value.coordinates] as [number, number], accuracyMeters: value.accuracyMeters, provenance,
  };
  return { status: "unknown" };
}

export function projectLocationGeography(
  stored: unknown,
  access: { gm: boolean; known: boolean; groupGrant: boolean; playerGrant: boolean; target: "group" | "player" },
): PlaceGeography {
  const geography = parseStoredLocationGeography(stored);
  if (geography.status === "unknown") return geography;
  const canSee = access.gm || (access.known && (geography.visibility === "public" ||
    (geography.visibility === "group" && access.groupGrant) ||
    (geography.visibility === "player" && access.target === "player" && access.playerGrant)));
  if (!canSee) return { status: "unknown" };
  const common = { coordinates: geography.coordinates, source: geography.provenance.source, reviewedAt: geography.provenance.reviewedAt };
  if (geography.status === "exact") return { status: "exact", ...common };
  return { status: "approximate", ...common, accuracyMeters: geography.accuracyMeters };
}

export function hasMapCoordinates(value: PlaceGeography | undefined): value is Extract<PlaceGeography, { status: "exact" | "approximate" }> {
  return value?.status === "exact" || value?.status === "approximate";
}
