import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { prototypeMapMarker } from "../server/location-map-prototype.ts";
import { mapMarkerFor, playerMapPlaces } from "../app/spielbereich/modules/world-map-contract.ts";

function projection({ view = "player", discovery = "visited", id = "place.electric-taberna" } = {}) {
  return {
    view,
    location: {
      id,
      title: "Electric Taberna",
      discovery,
      worldState: "active",
      gmBody: "SECRET TEXT MUST NOT REACH THE MAP",
      address: "Kavarinerstraße 30, 47533 Kleve",
    },
  };
}

test("hidden and rumored locations never become player map candidates or receive coordinates", () => {
  for (const discovery of ["hidden", "rumored"]) {
    const source = projection({ discovery });
    assert.deepEqual(playerMapPlaces(source), []);
    assert.equal(prototypeMapMarker(source), null);
  }
});

test("a GM projection cannot create player map markers or coordinates", () => {
  const source = projection({ view: "sl" });
  assert.deepEqual(playerMapPlaces(source), []);
  assert.equal(prototypeMapMarker(source), null);
});

test("known player projection contains only safe map candidate fields", () => {
  const [place] = playerMapPlaces(projection());
  assert.deepEqual(place, {
    id: "place.electric-taberna",
    title: "Electric Taberna",
    discovery: "visited",
    worldState: "active",
  });
  assert.equal(Object.hasOwn(place, "gmBody"), false);
  assert.equal(Object.hasOwn(place, "address"), false);
  assert.equal(Object.hasOwn(place, "coordinates"), false);
});

test("prototype coordinate is returned only for the known Electric Taberna player projection", () => {
  const marker = prototypeMapMarker(projection());
  assert.deepEqual(marker, {
    id: "place.electric-taberna",
    coordinates: [6.13827, 51.78993],
    coordinateSource: "prototype-test-coordinate",
  });
  assert.equal(prototypeMapMarker(projection({ id: "place.unmapped" })), null);
  assert.equal(prototypeMapMarker(projection({ discovery: "rumored" })), null);
});

test("a marker must match the known projected location", () => {
  const [place] = playerMapPlaces(projection());
  assert.equal(mapMarkerFor(place, prototypeMapMarker(projection()))?.id, place.id);
  assert.equal(mapMarkerFor(place, { ...prototypeMapMarker(projection()), id: "place.other" }), null);
  assert.equal(mapMarkerFor({ ...place, discovery: "rumored" }, prototypeMapMarker(projection())), null);
});

test("MapLibre is split behind the world view and retains the schematic failure fallback", async () => {
  const [workspace, experience, styles, mapModule] = await Promise.all([
    readFile(new URL("../app/spielbereich/workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/spielbereich/modules/world-experience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/spielbereich/modules/world-experience.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/spielbereich/modules/world-maplibre.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(workspace, /worldExperienceActive = section === "schauplaetze" \|\| section === "weltkarte"/);
  assert.doesNotMatch(workspace, /maplibre-gl|world-maplibre/);
  assert.match(experience, /import\("\.\/world-maplibre"\)/);
  assert.match(experience, /new URLSearchParams\(window\.location\.search\)\.has\("ort"\)/);
  assert.match(mapModule, /https:\/\/tiles\.openfreemap\.org\/styles\/dark/);
  assert.match(styles, /data-map-state="error"\] \.mapLibreCanvas/);
  assert.match(styles, /\.mapImage\s*\{/);
});
