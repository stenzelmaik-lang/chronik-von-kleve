import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { mapMarkersForPlaces, playerMapPlaces, visibleWorldPlaces } from "../app/spielbereich/modules/world-map-contract.ts";
import { parseStoredLocationGeography, projectLocationGeography } from "../server/location-geography.ts";

const exact = (coordinates, visibility = "group") => ({
  status: "exact", visibility, coordinates,
  provenance: { source: "isolated test fixture", reviewedAt: "2026-09-25" },
});
function place(id, geography, discovery = "known") {
  return { id, title: `Place ${id}`, subtitle: "", district: "", image: "", summary: "released summary", discovery, worldState: "active", geography };
}

test("geodata validates latitude/longitude bounds, provenance and strict shape", () => {
  assert.equal(parseStoredLocationGeography(exact([6.1, 51.7])).status, "exact");
  assert.deepEqual(parseStoredLocationGeography(exact([181, 51.7])), { status: "unknown" });
  assert.deepEqual(parseStoredLocationGeography(exact([6.1, 91])), { status: "unknown" });
  assert.deepEqual(parseStoredLocationGeography(exact([Number.NaN, 51.7])), { status: "unknown" });
  assert.deepEqual(parseStoredLocationGeography({ ...exact([6.1, 51.7]), secretCoordinates: [6.2, 51.8] }), { status: "unknown" });
  assert.deepEqual(parseStoredLocationGeography({ status: "approximate", visibility: "group", coordinates: [6, 51], accuracyMeters: 0, provenance: { source: "map", reviewedAt: "2026-09-25" } }), { status: "unknown" });
});

test("approximate projection returns only its approximate point and accuracy", () => {
  const source = { status: "approximate", visibility: "group", coordinates: [6.1, 51.7], accuracyMeters: 1800, provenance: { source: "regional map", reviewedAt: "2026-09-25", reference: "https://example.invalid/map" } };
  const projected = projectLocationGeography(source, { gm: false, known: true, groupGrant: true, playerGrant: false, target: "group" });
  assert.deepEqual(projected, { status: "approximate", coordinates: [6.1, 51.7], accuracyMeters: 1800, source: "regional map", reviewedAt: "2026-09-25" });
  assert.equal("reference" in projected, false);
});

test("personal or GM geography does not leak through a group or another player's projection", () => {
  const personal = exact([6.1, 51.7], "player");
  assert.deepEqual(projectLocationGeography(personal, { gm: false, known: true, groupGrant: false, playerGrant: true, target: "group" }), { status: "unknown" });
  assert.deepEqual(projectLocationGeography(personal, { gm: false, known: true, groupGrant: false, playerGrant: false, target: "player" }), { status: "unknown" });
  assert.deepEqual(projectLocationGeography({ ...personal, visibility: "gm" }, { gm: false, known: true, groupGrant: true, playerGrant: false, target: "group" }), { status: "unknown" });
  assert.deepEqual(projectLocationGeography(exact([6.1, 51.7]), { gm: false, known: false, groupGrant: true, playerGrant: false, target: "group" }), { status: "unknown" });
});

test("tiles and markers are generated generically for multiple released places", () => {
  const places = [
    place("place.electric-taberna", { status: "unknown" }),
    place("place.synthetic-second", { status: "exact", coordinates: [6.2, 51.8], source: "isolated synthetic fixture", reviewedAt: "2026-09-25" }, "visited"),
    place("place.synthetic-third", { status: "approximate", coordinates: [6.3, 51.9], accuracyMeters: 2200, source: "isolated synthetic fixture", reviewedAt: "2026-09-25" }, "investigated"),
  ];
  assert.deepEqual(playerMapPlaces(places).map(item => item.id), places.map(item => item.id));
  assert.deepEqual(mapMarkersForPlaces(places).map(item => item.id), ["place.synthetic-second", "place.synthetic-third"]);
  assert.deepEqual(mapMarkersForPlaces(places).map(item => item.discovery), ["visited", "investigated"]);
  assert.deepEqual(mapMarkersForPlaces(places).map(item => item.coordinates), [[6.2, 51.8], [6.3, 51.9]]);
});

test("hidden and rumored places cannot produce player tiles or markers", () => {
  const places = [place("place.hidden", exact([6.1, 51.7]), "hidden"), place("place.rumored", exact([6.2, 51.8]), "rumored")];
  assert.deepEqual(visibleWorldPlaces(places), []);
  assert.deepEqual(playerMapPlaces(places), []);
  assert.deepEqual(mapMarkersForPlaces(places), []);
  assert.deepEqual(mapMarkersForPlaces(places, true).map(item => item.discovery), ["hidden", "rumored"]);
  assert.deepEqual(visibleWorldPlaces(places, true).map(item => item.id), ["place.hidden", "place.rumored"]);
});

test("MapLibre retains its regional start frame and manages a generic marker collection", async () => {
  const [workspace, experience, styles, mapModule, endpoint, repository] = await Promise.all([
    readFile(new URL("../app/spielbereich/workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/spielbereich/modules/world-experience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/spielbereich/modules/world-experience.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/spielbereich/modules/world-maplibre.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/locations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../server/location-repository.ts", import.meta.url), "utf8"),
  ]);
  assert.match(workspace, /worldExperienceActive = section === "schauplaetze" \|\| section === "weltkarte"/);
  assert.doesNotMatch(workspace, /maplibre-gl|world-maplibre/);
  assert.match(experience, /import\("\.\/world-maplibre"\)/);
  assert.match(experience, /visibleWorldPlaces\(mapHub, view === "sl"\)/);
  assert.match(experience, /return safeMapPlaces\.filter/);
  assert.match(experience, /mapMarkersForPlaces\(matchingMapPlaces, view === "sl"\)/);
  assert.match(experience, /useState<"player" \| "sl">\(a\.gm \? "sl" : "player"\)/);
  assert.doesNotMatch(experience, /place\.electric-taberna|prototype-test-coordinate|6\.13827/);
  assert.match(mapModule, /https:\/\/tiles\.openfreemap\.org\/styles\/dark/);
  assert.match(mapModule, /new Map<string/);
  assert.match(mapModule, /\[6\.03, 51\.65\]/);
  assert.match(mapModule, /\[6\.34, 51\.91\]/);
  assert.match(styles, /data-map-state="error"\] \.mapLibreCanvas/);
  assert.match(endpoint, /loadLocationHub/);
  assert.match(endpoint, /places: projections\.map\(summary\)/);
  assert.match(repository, /location_id IN \(\$\{placeholders\}\)/);
  assert.doesNotMatch(repository, /ELECTRIC_TABERNA_LEGACY_ENTITY_ID|Persistierte Electric-Taberna-Ortsdaten/);
});
