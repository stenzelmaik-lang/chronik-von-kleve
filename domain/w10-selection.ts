/** CP-RULES-W10-001, Phase B. LOCAL DRAFT ONLY.
 * Stable selection IDs -> existing German sheet keys, and a pure pool preview
 * derived from the authoritative character body. Stored keys are never renamed;
 * no values are written, no dice are rolled, no resources are spent.
 */
import { abilityGroups, attributeGroups } from './character-engine.ts';
import { readVitals } from './character-vitals.ts';
import { W10_ATTRIBUTE_KEYS, W10_ABILITY_KEYS } from './trait-ids.ts';
import { readSpecialties, SPECIALTY_MINIMUM_RATING, traitRating, type Specialty } from './character-specialties.ts';
import { HYBRID_DRAFT_PROFILE, prepareDraftRoll, W10RuleError } from './w10-hybrid-draft.ts';

export { W10_ATTRIBUTE_KEYS, W10_ABILITY_KEYS } from './trait-ids.ts';
export type W10AttributeId = keyof typeof W10_ATTRIBUTE_KEYS;
export type W10AbilityId = keyof typeof W10_ABILITY_KEYS;
type AbilityCategory = 'talent' | 'skill' | 'knowledge';

// The category is taken from the character engine, so the adapter cannot drift from the sheet.
const categoryOf = new Map<string, AbilityCategory>([
  ...abilityGroups.talents.map(key => [key, 'talent'] as const),
  ...abilityGroups.skills.map(key => [key, 'skill'] as const),
  ...abilityGroups.knowledges.map(key => [key, 'knowledge'] as const),
]);
const attributeKeys = new Set<string>(Object.values(attributeGroups).flat());

export function attributeKey(id: string): string | undefined {
  return Object.hasOwn(W10_ATTRIBUTE_KEYS, id) ? W10_ATTRIBUTE_KEYS[id as W10AttributeId] : undefined;
}
export function abilityEntry(id: string): { key: string; category: AbilityCategory } | undefined {
  if (!Object.hasOwn(W10_ABILITY_KEYS, id)) return undefined;
  const key = W10_ABILITY_KEYS[id as W10AbilityId], category = categoryOf.get(key);
  return category && { key, category };
}
/** Adapter self-check: every engine key is reachable exactly once. */
export function adapterCoverage() {
  const attributes = Object.values(W10_ATTRIBUTE_KEYS), abilities = Object.values(W10_ABILITY_KEYS);
  return {
    attributesComplete: attributes.length === attributeKeys.size && attributes.every(key => attributeKeys.has(key)),
    abilitiesComplete: abilities.length === categoryOf.size && new Set(abilities).size === abilities.length && abilities.every(key => categoryOf.has(key)),
  };
}

export type W10Selection = Readonly<{ attributeId: string; abilityId?: string; specialtyId?: string }>;
export type W10Declared = Readonly<{ baseDifficulty: number; requiredSuccesses?: number }>;
export type W10Provenance = Readonly<{
  part: 'attribute' | 'ability' | 'specialty' | 'wounds' | 'difficulty';
  id: string; label: string; amount: number; source: string;
}>;
/** Rules deliberately not evaluated in Phase B; listed so a preview never hides them. */
export type W10NotApplied = Readonly<{ id: string; label: string; reason: string }>;

const NOT_APPLIED: readonly W10NotApplied[] = Object.freeze([
  { id: 'specialty_fit', label: 'Passt die Spezialisierung zur Situation?', reason: 'Entscheidung R4: Bei einer SL-Probenaufforderung legt die SL die Spezialisierung fest, bei einem freien Wurf beansprucht sie der Spieler sichtbar markiert. Hält die SL sie danach für unpassend, werden dieselben Würfel ohne Doppelwertung neu ausgewertet und als SL-Korrektur protokolliert (Probenaufforderung und Korrektur folgen mit Phase D).' },
  { id: 'wound_exceptions', label: 'Ausnahmen vom Wundabzug', reason: 'Absorption, Schaden, Körperkraft-Schadenswürfe und das Aufheben von Wundabzügen werden erst nach Prüfung der V20-Primärquelle umgesetzt. Phase B leitet nur gewöhnliche Proben ab, bei denen der Wundabzug immer gilt.' },
  { id: 'hunger', label: 'Hungerwürfel', reason: 'Offene Entscheidung Blut → Hunger. Bestehende Blutpunkte werden nicht umgedeutet.' },
  { id: 'personal_stress', label: 'Persönlicher Stress', reason: 'Offene Entscheidung Stress 0–10 → 0–300. Bestehender Stress wird nicht umgedeutet.' },
  { id: 'group_stress', label: 'Gruppenstress', reason: 'Bleibt eine ausdrückliche SL-Aktion; kein Würfelmodifikator in Phase B.' },
  { id: 'willpower', label: 'Willenskraft', reason: 'Vorabansage, Rundensperre und Buchung erst mit Phase D.' },
].map(entry => Object.freeze(entry)));

type Body = Record<string, unknown>;
function record(value: unknown): Body {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Body : {};
}
function blocked(code: string, provenance: W10Provenance[], extra: Record<string, unknown> = {}) {
  return Object.freeze({ status: 'blocked' as const, code, ...extra, provenance: Object.freeze(provenance), notApplied: NOT_APPLIED });
}
const BLOCK_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  DIFFICULTY_ABOVE_10: 'V20 erlaubt nur Schwierigkeiten von 2 bis 10. Mit allen Modifikatoren liegt diese Probe darüber und ist so ungültig. Die SL kann die Probe oder die Umstände ändern; es wird nicht gewürfelt.',
  INCAPACITATED: 'Der Charakter ist außer Gefecht oder nicht handlungsfähig. Es wird nicht gewürfelt.',
  NO_DICE: 'Nach allen Abzügen bleibt kein Würfel übrig. Es wird kein Ersatzwürfel gestellt.',
  SPECIALTY_NOT_FOUND: 'Diese Spezialisierung steht nicht im Bogen dieses Charakters.',
  SPECIALTY_INACTIVE: 'Diese Spezialisierung ist deaktiviert.',
  SPECIALTY_NOT_FOR_TRAIT: 'Diese Spezialisierung gehört zu keinem der gewählten Werte.',
  SPECIALTY_TRAIT_BELOW_4: 'Der zugehörige Wert liegt unter 4. Die Spezialisierung bleibt gespeichert, wirkt aber nicht (V20).',
});

const DIFFICULTY_SOURCES: Readonly<Record<string, { label: string; source: string }>> = Object.freeze({
  untrained_skill: { label: 'Fertigkeit ohne Wert', source: 'V20-Grundregel: ungelernte Fertigkeit +1 SG' },
  personal_stress: { label: 'Persönlicher Stress', source: 'ChroniPlay-Hausregelentwurf (nicht aktiv in Phase B)' },
});
function difficultyProvenance(modifier: { source: string; amount: number }): W10Provenance {
  const known = DIFFICULTY_SOURCES[modifier.source] ?? { label: modifier.source, source: 'Regelkern' };
  return Object.freeze({ part: 'difficulty', id: modifier.source, label: known.label, amount: modifier.amount, source: known.source });
}

/** Unknown IDs throw (request error). Rule-level refusals return `status: 'blocked'` with provenance. */
/** Why a stored specialty would or would not apply to this selection; null means it applies. */
function specialtyBlock(body: Body, specialty: Specialty, selection: W10Selection): string | null {
  if (specialty.active === false) return 'SPECIALTY_INACTIVE';
  const chosen = specialty.target.kind === 'attribute' ? selection.attributeId : selection.abilityId;
  if (specialty.target.id !== chosen) return 'SPECIALTY_NOT_FOR_TRAIT';
  return (traitRating(body, specialty.target) ?? 0) < SPECIALTY_MINIMUM_RATING ? 'SPECIALTY_TRAIT_BELOW_4' : null;
}

export type W10PreviewOptions = Readonly<{ claimedBy?: 'player' | 'gm' }>;
export function deriveW10Preview(body: Body, selection: W10Selection, declared: W10Declared, characterVersion: number, options: W10PreviewOptions = {}) {
  const attrKey = attributeKey(selection.attributeId);
  if (!attrKey) throw new W10RuleError('UNKNOWN_ATTRIBUTE_ID');
  const ability = selection.abilityId === undefined ? undefined : abilityEntry(selection.abilityId);
  if (selection.abilityId !== undefined && !ability) throw new W10RuleError('UNKNOWN_ABILITY_ID');
  const provenance: W10Provenance[] = [];
  const attributes = record(body.attributes);
  // Missing attributes are not invented as 0 or 1; an incomplete sheet blocks the check.
  if (!Object.hasOwn(attributes, attrKey)) return blocked('ATTRIBUTE_NOT_ON_SHEET', provenance);
  const attrValue = attributes[attrKey];
  if (!Number.isSafeInteger(attrValue) || (attrValue as number) < 0) return blocked('SHEET_VALUE_INVALID', provenance);
  provenance.push(Object.freeze({ part: 'attribute', id: selection.attributeId, label: attrKey, amount: attrValue as number, source: `Charakterbogen · Attribute · ${attrKey}` }));
  let abilityValue = 0;
  if (ability) {
    const skills = record(body.skills);
    // Same convention as the character engine: an ability without an entry has no dots.
    const raw = Object.hasOwn(skills, ability.key) ? skills[ability.key] : 0;
    if (!Number.isSafeInteger(raw) || (raw as number) < 0) return blocked('SHEET_VALUE_INVALID', provenance);
    abilityValue = raw as number;
    provenance.push(Object.freeze({ part: 'ability', id: selection.abilityId!, label: ability.key, amount: abilityValue,
      source: `Charakterbogen · Fähigkeiten · ${ability.key}${Object.hasOwn(skills, ability.key) ? '' : ' (kein Eintrag = 0)'}` }));
  }
  // Specialties: only stored, active entries of the selected traits with a rating of 4+ (K4).
  const stored = readSpecialties(body);
  const candidates = Object.freeze(stored.filter(s => (s.target.kind === 'attribute' && s.target.id === selection.attributeId) ||
    (s.target.kind === 'ability' && s.target.id === selection.abilityId)).map(s => {
    const reason = specialtyBlock(body, s, selection);
    return Object.freeze({ id: s.id, name: s.name, ...(s.scope ? { scope: s.scope } : {}), target: s.target.kind, applicable: reason === null, ...(reason ? { reason } : {}) });
  }));
  let specialty: Specialty | undefined;
  if (selection.specialtyId !== undefined) {
    specialty = stored.find(s => s.id === selection.specialtyId);
    const code = specialty ? specialtyBlock(body, specialty, selection) : 'SPECIALTY_NOT_FOUND';
    if (code) return blocked(code, provenance, { message: BLOCK_MESSAGES[code], specialties: candidates });
    provenance.push(Object.freeze({ part: 'specialty', id: specialty!.id, label: specialty!.name, amount: 0,
      source: `Charakterbogen · Spezialisierung (${specialty!.target.kind === 'attribute' ? attrKey : ability!.key}) · jede 10 zählt doppelt · ${options.claimedBy === 'gm' ? 'von der SL gesetzt' : 'vom Spieler beansprucht'}` }));
  }
  // V20 wound penalty from the existing health track, applied once to the pool before any special dice
  // are assigned. Only ordinary checks are derived here, so no wound exception can apply yet.
  const health = readVitals(body).health;
  if (health.status !== 'active' || health.penalty === null) {
    return blocked('INCAPACITATED', provenance, { message: BLOCK_MESSAGES.INCAPACITATED, health: Object.freeze({ level: health.level, status: health.status }) });
  }
  provenance.push(Object.freeze({ part: 'wounds', id: 'wound_penalty', label: health.level, amount: health.penalty,
    source: `Gesundheitsleiste · ${health.level} (V20-Wundabzug)` }));
  const pool = (attrValue as number) + abilityValue + health.penalty;
  if (pool < 1) return blocked('NO_DICE', provenance, { message: BLOCK_MESSAGES.NO_DICE });
  let prepared;
  try {
    prepared = prepareDraftRoll({ rollId: 'preview', characterVersion, kind: 'ordinary', pool, specialtyApplies: !!specialty,
      difficulty: declared.baseDifficulty, requiredSuccesses: declared.requiredSuccesses,
      ...(ability ? { training: { category: ability.category, rating: abilityValue } } : {}) });
  } catch (error) {
    if (error instanceof W10RuleError) {
      if (error.code === 'DIFFICULTY_ABOVE_10') {
        const detail = error.detail as { base: number; modifiers: readonly { source: string; amount: number }[]; sum: number };
        return blocked(error.code, [...provenance, ...detail.modifiers.map(difficultyProvenance)], { message: BLOCK_MESSAGES.DIFFICULTY_ABOVE_10,
          difficulty: Object.freeze({ base: detail.base, modifiers: detail.modifiers, sum: detail.sum, allowed: Object.freeze({ min: 2, max: 10 }) }) });
      }
      return blocked(error.code, provenance);
    }
    throw error;
  }
  provenance.push(...prepared.difficulty.modifiers.map(difficultyProvenance));
  return Object.freeze({
    status: 'ready' as const,
    profile: HYBRID_DRAFT_PROFILE,
    characterVersion,
    selection: Object.freeze({ attributeId: selection.attributeId, ...(ability ? { abilityId: selection.abilityId, category: ability.category } : {}) }),
    pool: Object.freeze({ base: pool, effective: prepared.pool.effective }),
    difficulty: prepared.difficulty,
    requiredSuccesses: declared.requiredSuccesses ?? 1,
    specialtyApplies: !!specialty,
    ...(specialty ? { specialty: Object.freeze({ id: specialty.id, name: specialty.name, claimedBy: options.claimedBy ?? 'player' }) } : {}),
    specialties: candidates,
    provenance: Object.freeze(provenance),
    notApplied: NOT_APPLIED,
  });
}
