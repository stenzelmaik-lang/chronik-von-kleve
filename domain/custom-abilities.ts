/** Own abilities (`customAbilities`) with a stable ID (owner decision 31.10.2026, K6).
 * Only entries that carry an `id` are selectable for dice. Existing entries without an ID stay
 * exactly as stored (including free text) until an approved inventory and migration exists. */
import { W10_ABILITY_KEYS } from './trait-ids.ts';

/** The sheet already stores these German category labels on custom rows; no new vocabulary. */
export const CUSTOM_ABILITY_CATEGORIES = Object.freeze({ Talent: 'talent', Fertigkeit: 'skill', Kenntnis: 'knowledge' } as const);
export type CustomAbilityCategory = keyof typeof CUSTOM_ABILITY_CATEGORIES;
export type CustomAbility = { id: string; name: string; value: number; category: CustomAbilityCategory; active?: boolean };
export const CUSTOM_ABILITY_PREFIX = 'custom:';
const ID = /^cab_[A-Za-z0-9-]{8,64}$/;
const ALLOWED_KEYS = ['id', 'name', 'value', 'category', 'active'];

export function newCustomAbilityId() { return 'cab_' + globalThis.crypto.randomUUID(); }
export function isCustomAbilityId(id: unknown): id is string { return typeof id === 'string' && ID.test(id); }
export const normalizeAbilityName = (name: string) => name.trim().toLocaleLowerCase('de').replace(/\s+/g, ' ');
const standardNames = new Set(Object.values(W10_ABILITY_KEYS).map(normalizeAbilityName));

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row)) : [];
}

/** Rules only for entries with an ID; rows without an ID keep the existing legacy validation. */
export function validateCustomAbilityIds(value: unknown): string | null {
  const list = rows(value), ids = new Set<string>(), activeNames = new Map<string, number>();
  for (const row of list) if (!Object.hasOwn(row, 'id') && typeof row.name === 'string') activeNames.set(normalizeAbilityName(row.name), (activeNames.get(normalizeAbilityName(row.name)) ?? 0) + 1);
  for (const row of list) {
    if (!Object.hasOwn(row, 'id')) continue;
    if (!isCustomAbilityId(row.id) || ids.has(row.id)) return 'Jede eigene Fähigkeit braucht eine eindeutige ID.';
    ids.add(row.id);
    if (typeof row.category !== 'string' || !Object.hasOwn(CUSTOM_ABILITY_CATEGORIES, row.category)) return `Eigene Fähigkeit „${String(row.name ?? '')}“: Kategorie Talent, Fertigkeit oder Kenntnis wählen.`;
    if (row.active !== undefined && typeof row.active !== 'boolean') return 'Ungültiger Status einer eigenen Fähigkeit.';
    if (Object.keys(row).some(key => !ALLOWED_KEYS.includes(key))) return 'Unbekannte Angaben in einer eigenen Fähigkeit.';
    if (row.active === false || typeof row.name !== 'string') continue;
    const name = normalizeAbilityName(row.name);
    if (standardNames.has(name)) return `„${row.name.trim()}“ ist bereits eine V20-Standardfähigkeit.`;
    if (activeNames.has(name)) return `„${row.name.trim()}“ ist als eigene Fähigkeit doppelt oder verwechselbar eingetragen.`;
    activeNames.set(name, 1);
  }
  return null;
}

/** Entries with a valid ID; malformed lists yield nothing rather than a guess. */
export function readCustomAbilities(body: Record<string, unknown>): CustomAbility[] {
  if (validateCustomAbilityIds(body.customAbilities) !== null) return [];
  return rows(body.customAbilities).filter(row => Object.hasOwn(row, 'id')) as unknown as CustomAbility[];
}
/** Rows without an ID (or historical free text): visible, never selectable, never altered. */
export function customAbilitiesWithoutId(body: Record<string, unknown>): number {
  if (typeof body.customAbilities === 'string') return body.customAbilities.trim() ? 1 : 0;
  return rows(body.customAbilities).filter(row => !Object.hasOwn(row, 'id')).length;
}
export function customAbilityById(body: Record<string, unknown>, id: string) {
  return readCustomAbilities(body).find(row => row.id === id);
}
