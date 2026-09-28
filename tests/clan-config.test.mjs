import assert from "node:assert/strict";
import { test } from "node:test";

import {
  availableClanForCampaign,
  clansForCampaign,
  validateCharacterClanSelection,
} from "../domain/clan-config.ts";

const campaignId = "chronik-von-kleve";

test("Kleve exposes exactly the approved clans and locks the remaining classic V20 catalogue", () => {
  const clans = clansForCampaign(campaignId);
  assert.deepEqual(
    clans.filter((clan) => clan.availability === "available").map((clan) => clan.label),
    ["Brujah", "Gangrel", "Malkavianer", "Nosferatu", "Toreador", "Tremere", "Ventrue"],
  );
  assert.equal(clans.find((clan) => clan.label === "Lasombra")?.availability, "locked");
  assert.equal(clans.some((clan) => clan.label === "Caitiff"), false);
});

test("Each approved clan resolves to the single central discipline catalogue", () => {
  assert.deepEqual(availableClanForCampaign(campaignId, "Brujah")?.disciplines, [
    "Präsenz", "Potenz", "Schnelligkeit",
  ]);
  assert.deepEqual(availableClanForCampaign(campaignId, "Tremere")?.disciplines, [
    "Auspex", "Beherrschung", "Thaumaturgie",
  ]);
});

test("New and changed selections accept only approved clan disciplines", () => {
  assert.deepEqual(
    validateCharacterClanSelection({
      campaignId,
      clan: "Tremere",
      disciplines: [{ name: "Auspex", value: 1 }, { name: "Thaumaturgie", value: 1 }],
    }),
    { ok: true },
  );
  assert.equal(
    validateCharacterClanSelection({
      campaignId,
      clan: "Lasombra",
      disciplines: [{ name: "Beherrschung", value: 1 }],
    }).ok,
    false,
  );
  assert.equal(
    validateCharacterClanSelection({
      campaignId,
      clan: "Tremere",
      disciplines: [{ name: "Potenz", value: 1 }],
    }).ok,
    false,
  );
  assert.equal(
    validateCharacterClanSelection({
      campaignId,
      clan: "Tremere",
      disciplines: [{ name: "Auspex", value: 1 }, { name: "Auspex", value: 2 }],
    }).ok,
    false,
  );
});

test("Unchanged legacy clan values remain preserved without opening new choices", () => {
  const legacy = validateCharacterClanSelection({
    campaignId,
    clan: "Legacy-Clan",
    disciplines: [{ name: "Legacy-Disziplin", value: 2 }],
    previousClan: "Legacy-Clan",
    previousDisciplines: [{ name: "Legacy-Disziplin", value: 2 }],
  });
  assert.deepEqual(legacy, { ok: true, legacyUnchanged: true });
  assert.equal(
    validateCharacterClanSelection({
      campaignId,
      clan: "Legacy-Clan",
      disciplines: [{ name: "Andere Legacy-Disziplin", value: 2 }],
      previousClan: "Legacy-Clan",
      previousDisciplines: [{ name: "Legacy-Disziplin", value: 2 }],
    }).ok,
    false,
  );
});

test("A legacy character without a clan remains editable until its historical disciplines change", () => {
  assert.deepEqual(
    validateCharacterClanSelection({
      campaignId,
      clan: "",
      disciplines: [{ name: "Historische Disziplin", value: 2 }],
      previousClan: "",
      previousDisciplines: [{ name: "Historische Disziplin", value: 2 }],
    }),
    { ok: true, legacyUnchanged: true },
  );
  assert.equal(
    validateCharacterClanSelection({
      campaignId,
      clan: "",
      disciplines: [{ name: "Andere historische Disziplin", value: 2 }],
      previousClan: "",
      previousDisciplines: [{ name: "Historische Disziplin", value: 2 }],
    }).ok,
    false,
  );
});
