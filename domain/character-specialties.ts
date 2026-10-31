/** Structured V20 specialties on the existing character sheet (owner decision 31.10.2026, K4).
 * A specialty belongs to exactly one attribute or ability via its stable trait ID. Sheets without
 * the field keep their values; nothing is invented. A required field of study (e.g. Handwerk,
 * Technologie) is free text elsewhere and never grants the mechanical double-ten rule. */
import { W10_ABILITY_KEYS, W10_ATTRIBUTE_KEYS } from './trait-ids.ts';
import { customAbilityById, isCustomAbilityId } from './custom-abilities.ts';
import { HYBRID_DRAFT_PROFILE } from './w10-hybrid-draft.ts';

/** Owner decision 31.10.2026: specialties and the new own-ability fields may be visible before release,
 * but must be marked as preparation without any active hybrid dice effect. Empty once the profile is released. */
export function hybridPreparationNote(): string {
  return HYBRID_DRAFT_PROFILE.productionEnabled ? '' : 'Vorbereitung für das Hybrid-Würfelsystem: wird gespeichert und angezeigt, hat aber noch keine Würfelwirkung.';
}

export type SpecialtyTargetKind = 'attribute' | 'ability' | 'customAbility';
export type Specialty = { id: string; target: { kind: SpecialtyTargetKind; id: string }; name: string; scope?: string; active?: boolean };
/** V20 S. 96: a trait of 4 or more justifies a specialty. */
export const SPECIALTY_MINIMUM_RATING = 4;
const ID = /^spec_[A-Za-z0-9-]{8,64}$/;

export function newSpecialtyId() { return 'spec_' + globalThis.crypto.randomUUID(); }
/** Display label of the target; own abilities resolve through the sheet by their stable ID (K6). */
export function specialtyTargetKey(target: Specialty['target'], body?: Record<string, unknown>): string | undefined {
  if (target.kind === 'customAbility') return body ? customAbilityById(body, target.id)?.name : undefined;
  const map: Record<string, string> = target.kind === 'attribute' ? W10_ATTRIBUTE_KEYS : W10_ABILITY_KEYS;
  return Object.hasOwn(map, target.id) ? map[target.id] : undefined;
}
function knownTarget(kind: unknown, id: unknown, body?: Record<string, unknown>) {
  if (typeof id !== 'string') return false;
  if (kind === 'customAbility') return isCustomAbilityId(id) && (!body || !!customAbilityById(body, id));
  return (kind === 'attribute' || kind === 'ability') && !!specialtyTargetKey({ kind, id });
}
const normalize = (name: string) => name.trim().toLocaleLowerCase('de').replace(/\s+/g, ' ');

/** Structural rules only, so unrelated edits never fail because a trait later dropped below 4.
 * With the sheet given, a specialty must point at an existing own ability (no dangling reference). */
export function validateSpecialties(value: unknown, body?: Record<string, unknown>): string | null {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length > 100) return 'Ungültige Spezialisierungen.';
  const ids = new Set<string>(), active = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'Ungültige Spezialisierung.';
    const row = raw as Record<string, unknown>, target = row.target as Record<string, unknown> | undefined;
    if (typeof row.id !== 'string' || !ID.test(row.id) || ids.has(row.id)) return 'Jede Spezialisierung braucht eine eindeutige ID.';
    ids.add(row.id);
    if (!target || typeof target !== 'object' || !knownTarget(target.kind, target.id, body)) return 'Spezialisierung ohne gültige Eigenschaft oder Fähigkeit.';
    if (typeof row.name !== 'string' || !row.name.trim() || row.name.length > 120) return 'Spezialisierungen brauchen einen Namen (höchstens 120 Zeichen).';
    if (row.scope !== undefined && (typeof row.scope !== 'string' || row.scope.length > 500)) return 'Geltungsbereich der Spezialisierung zu lang.';
    if (row.active !== undefined && typeof row.active !== 'boolean') return 'Ungültiger Status einer Spezialisierung.';
    if (Object.keys(row).some(key => !['id', 'target', 'name', 'scope', 'active'].includes(key)) || Object.keys(target).some(key => key !== 'kind' && key !== 'id')) return 'Unbekannte Angaben in einer Spezialisierung.';
    if (row.active !== false) {
      const key = target.kind + ':' + target.id + ':' + normalize(row.name);
      if (active.has(key)) return `Spezialisierung „${row.name.trim()}“ ist doppelt eingetragen.`;
      active.add(key);
    }
  }
  return null;
}

/** Valid, typed entries; anything malformed is skipped rather than guessed. */
export function readSpecialties(body: Record<string, unknown>): Specialty[] {
  if (validateSpecialties(body.specialties, body) !== null || !Array.isArray(body.specialties)) return [];
  return body.specialties as Specialty[];
}

export function traitRating(body: Record<string, unknown>, target: Specialty['target']): number | null {
  if (target.kind === 'customAbility') {
    const own = customAbilityById(body, target.id);
    return own && own.active !== false && Number.isSafeInteger(own.value) ? own.value : null;
  }
  const key = specialtyTargetKey(target);
  const values = body[target.kind === 'attribute' ? 'attributes' : 'skills'];
  if (!key || !values || typeof values !== 'object' || Array.isArray(values)) return target.kind === 'ability' && key ? 0 : null;
  const value = (values as Record<string, unknown>)[key];
  if (value === undefined) return target.kind === 'ability' ? 0 : null;
  return Number.isSafeInteger(value) ? value as number : null;
}

/** Applies on save to entries that are new or changed (by ID), not to untouched old entries. */
export function specialtyRatingError(next: Record<string, unknown>, previous: Record<string, unknown>): string | null {
  const before = new Map(readSpecialties(previous).map(s => [s.id, JSON.stringify(s)]));
  for (const specialty of readSpecialties(next)) {
    if (specialty.active === false || before.get(specialty.id) === JSON.stringify(specialty)) continue;
    const rating = traitRating(next, specialty.target) ?? 0;
    if (rating < SPECIALTY_MINIMUM_RATING) {
      return `Spezialisierung „${specialty.name.trim()}“: ${specialtyTargetKey(specialty.target, next)} braucht mindestens ${SPECIALTY_MINIMUM_RATING} Punkte (V20).`;
    }
  }
  return null;
}
