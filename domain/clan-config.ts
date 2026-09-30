// This is deliberately local to the campaign configuration: the foundation
// must also be consumable by the lightweight Node domain tests without a
// runtime import of the wider application type module.
const KLEVE_CAMPAIGN_ID = "chronik-von-kleve";

export type ClanAvailability = "available" | "locked";

export type ClanDefinition = {
  id: string;
  label: string;
  disciplines: readonly string[];
  availability: ClanAvailability;
};

type CharacterDiscipline = { name?: unknown; value?: unknown; source?: unknown; slApproved?: unknown };

const classicV20Clans = [
  { id: "assamiten", label: "Assamiten", disciplines: ["Auspex", "Geschwindigkeit", "Verdunkelung"] },
  { id: "brujah", label: "Brujah", disciplines: ["Präsenz", "Potenz", "Schnelligkeit"] },
  { id: "gangrel", label: "Gangrel", disciplines: ["Animalismus", "Seelenstärke", "Gestaltwandel"] },
  { id: "giovanni", label: "Giovanni", disciplines: ["Nekromantie", "Potenz", "Seelenstärke"] },
  { id: "juenger-des-set", label: "Jünger des Set", disciplines: ["Präsenz", "Schlangengestalt", "Verdunkelung"] },
  { id: "lasombra", label: "Lasombra", disciplines: ["Beherrschung", "Potenz", "Schattenbeherrschung"] },
  { id: "malkavianer", label: "Malkavianer", disciplines: ["Auspex", "Demenz", "Verdunkelung"] },
  { id: "nosferatu", label: "Nosferatu", disciplines: ["Animalismus", "Verdunkelung", "Potenz"] },
  { id: "ravnos", label: "Ravnos", disciplines: ["Animalismus", "Illusion", "Seelenstärke"] },
  { id: "toreador", label: "Toreador", disciplines: ["Auspex", "Schnelligkeit", "Präsenz"] },
  { id: "tremere", label: "Tremere", disciplines: ["Auspex", "Beherrschung", "Thaumaturgie"] },
  { id: "tzimisce", label: "Tzimisce", disciplines: ["Animalismus", "Auspex", "Fleischformen"] },
  { id: "ventrue", label: "Ventrue", disciplines: ["Beherrschung", "Seelenstärke", "Präsenz"] },
] as const;

const kleveAvailableClanIds = new Set([
  "brujah",
  "gangrel",
  "malkavianer",
  "nosferatu",
  "toreador",
  "tremere",
  "ventrue",
]);

function normalized(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

/**
 * Central campaign overlay. A later campaign only needs its own allow-list; the
 * classic V20 catalogue remains one shared source for UI and server validation.
 */
export function clansForCampaign(campaignId: string): readonly ClanDefinition[] {
  const available = campaignId === KLEVE_CAMPAIGN_ID ? kleveAvailableClanIds : new Set<string>();
  return classicV20Clans.map((clan) => ({
    ...clan,
    disciplines: [...clan.disciplines],
    availability: available.has(clan.id) ? "available" : "locked",
  }));
}

export function clanForCampaign(campaignId: string, label: unknown) {
  const selected = normalized(label).toLocaleLowerCase("de-DE");
  return clansForCampaign(campaignId).find(
    (clan) => clan.label.toLocaleLowerCase("de-DE") === selected,
  );
}

export function availableClanForCampaign(campaignId: string, label: unknown) {
  const clan = clanForCampaign(campaignId, label);
  return clan?.availability === "available" ? clan : null;
}

export type ClanSelectionValidation = { ok: true; legacyUnchanged?: boolean } | { ok: false; error: string };

/**
 * Validates the Character V1 clan and the currently selected clan disciplines.
 * Unchanged legacy values remain readable and editable with unrelated fields,
 * but no new or changed selection may bypass the campaign catalogue.
 */
export function validateCharacterClanSelection(input: {
  campaignId: string;
  clan: unknown;
  disciplines: unknown;
  previousClan?: unknown;
  previousDisciplines?: unknown;
  allowPending?: boolean;
}): ClanSelectionValidation {
  const clanName = normalized(input.clan);
  const previousClan = normalized(input.previousClan);
  const clanChanged = clanName !== previousClan;
  const disciplinesChanged = !sameJson(input.disciplines, input.previousDisciplines);

  if (!clanName) {
    // Older characters can legitimately have no clan selection while still
    // carrying historical discipline text. Preserve that exact state so an
    // unrelated edit cannot silently turn into a data-loss migration.
    if (!clanChanged && !disciplinesChanged)
      return { ok: true, legacyUnchanged: true };
    if (Array.isArray(input.disciplines) && input.disciplines.length > 0)
      return { ok: false, error: "Wähle zuerst einen freigegebenen Clan für die Disziplinen." };
    if (typeof input.disciplines === "string" && input.disciplines.trim())
      return { ok: false, error: "Wähle zuerst einen freigegebenen Clan für die Disziplinen." };
    return { ok: true };
  }

  const configuredClan = clanForCampaign(input.campaignId, clanName);
  if (!configuredClan || configuredClan.availability !== "available") {
    if (!clanChanged && !disciplinesChanged)
      return { ok: true, legacyUnchanged: true };
    return {
      ok: false,
      error: configuredClan
        ? `${configuredClan.label} ist in dieser Chronik derzeit gesperrt.`
        : "Dieser Clan ist in dieser Chronik nicht freigegeben.",
    };
  }

  if (!Array.isArray(input.disciplines)) {
    if (!clanChanged && !disciplinesChanged)
      return { ok: true, legacyUnchanged: true };
    return { ok: false, error: "Disziplinen müssen über die Clan-Auswahl gepflegt werden." };
  }

  const names = input.disciplines.map((discipline) => normalized((discipline as CharacterDiscipline).name));
  if (names.some((name) => !name))
    return { ok: false, error: "Jede ausgewählte Disziplin benötigt einen Namen." };
  if (new Set(names).size !== names.length)
    return { ok: false, error: "Eine Disziplin kann nur einmal ausgewählt werden." };

  const unsupportedIndex = names.findIndex((name, index) => {
    if (configuredClan.disciplines.includes(name)) return false;
    const row = (input.disciplines as unknown[])[index] as CharacterDiscipline;
    return row.source !== "foreign" || !(row.slApproved === true || (input.allowPending && row.value === 0));
  });
  if (unsupportedIndex >= 0) {
    const unsupported = names[unsupportedIndex];
    return { ok: false, error: `${unsupported} benötigt eine dokumentierte SL-Ausnahme.` };
  }
  return { ok: true };
}
