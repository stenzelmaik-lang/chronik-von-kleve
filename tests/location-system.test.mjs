import assert from "node:assert/strict";
import { test } from "node:test";

import {
  discoveryStates,
  preparedActionStatusIds,
  worldStateIds,
} from "../domain/location-types.ts";
import {
  ELECTRIC_TABERNA_ID,
  electricTabernaLocation,
  projectLocationForPlayer,
  projectLocationForSl,
} from "../domain/location-model.ts";

test("Electric Taberna keeps the permanent place ID and complete hierarchy", () => {
  assert.equal(electricTabernaLocation.id, ELECTRIC_TABERNA_ID);
  assert.equal(electricTabernaLocation.id, "place.electric-taberna");
  assert.equal(electricTabernaLocation.areas.length, 3);
  assert.equal(
    electricTabernaLocation.areas.reduce(
      (sum, area) => sum + area.rooms.length,
      0,
    ),
    11,
  );
});

test("Discovery and world-state vocabularies are complete", () => {
  assert.deepEqual([...discoveryStates], [
    "hidden",
    "rumored",
    "known",
    "visited",
    "investigated",
  ]);
  assert.deepEqual([...worldStateIds], [
    "active",
    "changed",
    "inaccessible",
    "destroyed",
    "abandoned",
  ]);
});

test("SL projection sees all areas, rooms and data-driven prepared actions", () => {
  const projection = projectLocationForSl();
  assert.equal(projection.view, "sl");
  assert.equal(projection.actualRole, "gm");
  assert.equal(projection.canSwitchToSl, true);
  assert.equal(projection.location.areas.length, 3);
  assert.equal(
    projection.location.areas.reduce((sum, area) => sum + area.rooms.length, 0),
    11,
  );
  assert.equal(projection.location.preparedActions?.length, 4);
  for (const action of projection.location.preparedActions ?? []) {
    assert.ok(preparedActionStatusIds.includes(action.status));
    assert.equal(action.visibility, "gm");
    assert.ok(action.targetId.length > 0);
  }
});

test("Player projection removes unreleased room names and GM metadata", () => {
  const projection = projectLocationForPlayer("player");
  const json = JSON.stringify(projection);
  assert.equal(projection.view, "player");
  assert.equal(projection.actualRole, "player");
  assert.equal(projection.canSwitchToSl, false);
  assert.equal(projection.location.areas.length, 2);
  assert.equal(
    projection.location.areas.reduce((sum, area) => sum + area.rooms.length, 0),
    4,
  );
  assert.ok(json.includes("Nicht erschlossener Bereich"));
  for (const secret of [
    "Personal-/Hinterbereich",
    "Keller & Service",
    "Gesprächsraum",
    "Personalflur",
    "Büro",
    "Hof & Anlieferung",
    "Getränkevorrat",
    "Ruheraum",
    "Wartungsgang",
    "room.electric-taberna.entrance-cloakroom",
    "room.electric-taberna.office",
    "area.electric-taberna.public-guests",
    "area.electric-taberna.cellar-service",
    "info.electric-taberna.public-signal",
    "legacy-1bf8cd98a7c87c2e018890b4",
    "Elysium / Camarilla",
  ]) {
    assert.equal(json.includes(secret), false, secret);
  }
});

test("Area images follow the same player discovery projection and disappear from redacted areas", () => {
  const known = electricTabernaLocation.areas[0];
  const hidden = electricTabernaLocation.areas[1];
  const fixture = {
    ...electricTabernaLocation,
    areas: [
      { ...known, image: "/api/cms/media?id=known&entityId=area-known&revisionId=revision-known" },
      { ...hidden, image: "/api/cms/media?id=secret&entityId=area-hidden&revisionId=revision-hidden", visibility: "gm", discovery: "hidden", playerHint: "Ein Umriss bleibt zurück.", rooms: [] },
    ],
  };
  const projection = projectLocationForPlayer("player", "group", fixture);
  const json = JSON.stringify(projection);
  assert.ok(projection.location.areas.some(area => area.image?.includes("id=known")));
  assert.ok(projection.location.areas.some(area => area.redacted));
  assert.equal(json.includes("id=secret"), false);
});

test("GM player preview changes only the projection, not the real role", () => {
  const projection = projectLocationForPlayer("gm", "group");
  assert.equal(projection.view, "player");
  assert.equal(projection.actualRole, "gm");
  assert.equal(projection.canSwitchToSl, true);
  assert.equal(projection.target, "group");
  assert.equal(
    JSON.stringify(projection).includes("Getränkevorrat"),
    false,
  );
});


test("Discovery only confirms or advances", async () => {
  const {canAdvanceDiscovery} = await import("../domain/location-discovery.ts");
  for (const [before,after] of [["hidden","known"],["known","visited"],["visited","visited"]])
    assert.equal(canAdvanceDiscovery(before,after),true);
  for (const [before,after] of [["investigated","visited"],["visited","known"],["known","rumored"],["rumored","hidden"],["investigated","hidden"]])
    assert.equal(canAdvanceDiscovery(before,after),false);
});

test("GM_SECRET and recovery are hard boundaries independent of grants", async () => {
  const {locationIsSecret} = await import("../domain/location-discovery.ts");
  assert.equal(locationIsSecret("GM_SECRET",{},{}),true);
  assert.equal(locationIsSecret("WORKING",{recoveryOnly:true},{}),true);
  assert.equal(locationIsSecret("WORKING",{}, {canonStatus:"GM_SECRET"}),true);
  assert.equal(locationIsSecret("WORKING",{}, {visibility:"gm"}),false);
});
