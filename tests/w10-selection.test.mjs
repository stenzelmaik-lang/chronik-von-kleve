import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { v20AbilityNames } from '../domain/character-engine.ts';
import { HYBRID_DRAFT_PROFILE } from '../domain/w10-hybrid-draft.ts';
import { W10_ATTRIBUTE_KEYS, W10_ABILITY_KEYS, abilityEntry, attributeKey, adapterCoverage, deriveW10Preview } from '../domain/w10-selection.ts';
import { engineFixture } from './fixtures/engine-character.mjs';

const declared = (patch = {}) => ({ baseDifficulty: 6, ...patch });
const preview = (body, selection, d = declared()) => deriveW10Preview(body, selection, d, 9);
const rejects = (fn, code) => assert.throws(fn, error => error.code === code);

test('B01: adapter maps every stable ID to exactly one existing German sheet key', () => {
  assert.deepEqual(adapterCoverage(), { attributesComplete: true, abilitiesComplete: true });
  assert.deepEqual(new Set(Object.values(W10_ABILITY_KEYS)), new Set(v20AbilityNames));
  assert.equal(attributeKey('dexterity'), 'Geschick');
  assert.deepEqual(abilityEntry('larceny'), { key: 'Diebstahl', category: 'skill' });
  assert.deepEqual(abilityEntry('technology'), { key: 'Technologie', category: 'knowledge' });
  assert.deepEqual(abilityEntry('investigation'), { key: 'Nachforschungen', category: 'knowledge' });
  assert.deepEqual(abilityEntry('law'), { key: 'Gesetzeskenntnis', category: 'knowledge' });
  assert.deepEqual(abilityEntry('awareness'), { key: 'Magiegespür', category: 'talent' });
  for (const id of ['security', 'linguistics', 'Geschick', 'constructor', '__proto__', 'toString']) {
    assert.equal(attributeKey(id), undefined); assert.equal(abilityEntry(id), undefined);
  }
  assert.ok(Object.isFrozen(W10_ATTRIBUTE_KEYS) && Object.isFrozen(W10_ABILITY_KEYS));
});

test('B02: attribute + ability pool with provenance from the stored sheet', () => {
  const result = preview(engineFixture, { attributeId: 'dexterity', abilityId: 'firearms' });
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.pool, { base: 6, effective: 6 });
  assert.equal(result.characterVersion, 9);
  assert.deepEqual(result.provenance.map(p => [p.part, p.label, p.amount]), [['attribute', 'Geschick', 3], ['ability', 'Schusswaffen', 3], ['wounds', 'Gesund', 0]]);
  assert.deepEqual(result.difficulty, { base: 6, modifiers: [], effective: 6 });
  assert.equal(result.specialtyApplies, false);
  assert.equal(result.profile, HYBRID_DRAFT_PROFILE);
  assert.equal(result.profile.productionEnabled, false);
});

test('B03: pure attribute check is allowed and has no training modifier', () => {
  const result = preview(engineFixture, { attributeId: 'strength' });
  assert.deepEqual(result.pool, { base: 4, effective: 4 });
  assert.deepEqual(result.provenance.map(p => p.part), ['attribute', 'wounds']);
});

test('B04: V20 ability groups — talent free, skill +1 SG, knowledge blocked', () => {
  const talent = preview(engineFixture, { attributeId: 'charisma', abilityId: 'leadership' });
  assert.equal(talent.status, 'ready'); assert.deepEqual(talent.difficulty.modifiers, []);
  assert.match(talent.provenance[1].source, /kein Eintrag = 0/);
  const skill = preview(engineFixture, { attributeId: 'dexterity', abilityId: 'melee' });
  assert.deepEqual(skill.pool, { base: 3, effective: 3 });
  assert.equal(skill.difficulty.effective, 7);
  assert.deepEqual(skill.provenance.at(-1), { part: 'difficulty', id: 'untrained_skill', label: 'Fertigkeit ohne Wert', amount: 1, source: 'V20-Grundregel: ungelernte Fertigkeit +1 SG' });
  const knowledge = preview(engineFixture, { attributeId: 'intelligence', abilityId: 'medicine' });
  assert.equal(knowledge.status, 'blocked'); assert.equal(knowledge.code, 'UNTRAINED_KNOWLEDGE'); assert.match(knowledge.message, /Kenntnis ohne Wert/);
  assert.equal(knowledge.provenance.length, 3, 'Blocked previews still show where the values came from');
});

test('B05/K3: SG above 10 is rejected before rolling, never capped, with full explanation', () => {
  const sel = { attributeId: 'dexterity', abilityId: 'melee' };
  const result = preview(engineFixture, sel, declared({ baseDifficulty: 10 }));
  assert.equal(result.status, 'blocked'); assert.equal(result.code, 'DIFFICULTY_ABOVE_10');
  assert.equal(result.pool, undefined, 'No pool, no dice, no costs for an invalid check');
  assert.deepEqual(result.difficulty, { base: 10, modifiers: [{ source: 'untrained_skill', amount: 1 }], sum: 11, allowed: { min: 2, max: 10 } });
  assert.match(result.message, /2 bis 10/); assert.match(result.message, /SL kann/);
  assert.deepEqual(result.provenance.at(-1), { part: 'difficulty', id: 'untrained_skill', label: 'Fertigkeit ohne Wert', amount: 1, source: 'V20-Grundregel: ungelernte Fertigkeit +1 SG' });
  // Exactly 10 stays valid.
  assert.equal(preview(engineFixture, sel, declared({ baseDifficulty: 9 })).difficulty.effective, 10);
  // A cap policy smuggled into the declaration does not reach the core as a cap.
  assert.equal(preview(engineFixture, sel, declared({ baseDifficulty: 10, difficultyOverflow: 'cap_at_10' })).code, 'DIFFICULTY_ABOVE_10');
});

test('K5: V20 wound penalties from the health track reduce the pool once, before special dice', () => {
  const sel = { attributeId: 'dexterity', abilityId: 'firearms' }; // 3 + 3 = 6
  const at = (levels, extra = {}) => preview({ ...engineFixture, health: { track: Array(levels).fill('lethal'), ...extra } }, sel);
  for (const [levels, label, penalty] of [[0, 'Gesund', 0], [1, 'Blaue Flecken', 0], [2, 'Verletzt', -1], [3, 'Schwer verletzt', -1],
    [4, 'Verwundet', -2], [5, 'Schwer verwundet', -2], [6, 'Verkrüppelt', -5]]) {
    const result = at(levels);
    assert.equal(result.status, 'ready', label);
    assert.deepEqual(result.pool, { base: 6 + penalty, effective: 6 + penalty }, label);
    assert.deepEqual(result.provenance.filter(p => p.part === 'wounds'), [{ part: 'wounds', id: 'wound_penalty', label, amount: penalty, source: `Gesundheitsleiste · ${label} (V20-Wundabzug)` }], 'Applied exactly once: ' + label);
  }
  assert.equal(at(7).code, 'INCAPACITATED');
  assert.equal(at(0, { status: 'torpor' }).code, 'INCAPACITATED');
  assert.equal(at(0, { status: 'final-death' }).code, 'INCAPACITATED');
  // Legacy sheets that only store the level name.
  assert.deepEqual(preview({ ...engineFixture, health: { current: 'Verwundet' } }, sel).pool, { base: 4, effective: 4 });
  // Penalty can empty the pool: blocked, no substitute die.
  const small = preview({ attributes: { Geschick: 2 }, health: { track: Array(6).fill('bashing') } }, { attributeId: 'dexterity' });
  assert.equal(small.code, 'NO_DICE'); assert.match(small.message, /kein Ersatzwürfel/);
  // Exceptions are not guessed: they are listed as not applied.
  assert.ok(at(2).notApplied.some(n => n.id === 'wound_exceptions'));
});

test('B06: incomplete or invalid sheets block instead of inventing values', () => {
  const without = { ...engineFixture, attributes: { ...engineFixture.attributes } }; delete without.attributes.Geschick;
  assert.equal(preview(without, { attributeId: 'dexterity' }).code, 'ATTRIBUTE_NOT_ON_SHEET');
  assert.equal(preview({}, { attributeId: 'dexterity' }).code, 'ATTRIBUTE_NOT_ON_SHEET');
  for (const bad of [-1, 2.5, '3', null, 1e300]) {
    assert.equal(preview({ attributes: { Geschick: bad } }, { attributeId: 'dexterity' }).code, 'SHEET_VALUE_INVALID');
    assert.equal(preview({ attributes: { Geschick: 2 }, skills: { Nahkampf: bad } }, { attributeId: 'dexterity', abilityId: 'melee' }).code, 'SHEET_VALUE_INVALID');
  }
  assert.equal(preview({ attributes: { Erscheinungsbild: 0 } }, { attributeId: 'appearance' }).code, 'NO_DICE');
});

test('B07: unknown IDs are request errors, not silent zero pools', () => {
  rejects(() => preview(engineFixture, { attributeId: 'Geschick' }), 'UNKNOWN_ATTRIBUTE_ID');
  rejects(() => preview(engineFixture, { attributeId: 'dexterity', abilityId: 'security' }), 'UNKNOWN_ABILITY_ID');
  rejects(() => preview(engineFixture, { attributeId: 'dexterity', abilityId: '__proto__' }), 'UNKNOWN_ABILITY_ID');
});

test('B08: preview never mutates the sheet and lists every rule it did not apply', () => {
  const body = structuredClone(engineFixture), before = JSON.stringify(body);
  const result = preview(body, { attributeId: 'dexterity', abilityId: 'stealth' });
  assert.equal(JSON.stringify(body), before);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.provenance) && Object.isFrozen(result.notApplied));
  assert.deepEqual(result.notApplied.map(n => n.id), ['specialty_fit', 'wound_exceptions', 'hunger', 'personal_stress', 'group_stress', 'willpower']);
  // Blood and willpower are on the sheet but never enter the Phase-B pool.
  assert.equal(preview({ ...body, blood: 0, willpowerTemporary: 0 }, { attributeId: 'dexterity', abilityId: 'stealth' }).pool.base, 6);
});

test('B09: the draft route stays behind an explicit local binding; production config does not set it', () => {
  const server = readFileSync(new URL('../server/w10-preview.ts', import.meta.url), 'utf8');
  assert.match(server, /W10_HYBRID_PREVIEW === "local-only" && vars\.AUTH_ACCESS_ENVIRONMENT === "local-test"/);
  for (const file of ['../wrangler.jsonc', '../wrangler.toml', '../wrangler.json']) {
    let text; try { text = readFileSync(new URL(file, import.meta.url), 'utf8'); } catch { continue; }
    assert.doesNotMatch(text, /W10_HYBRID_PREVIEW/);
  }
  const route = readFileSync(new URL('../app/api/w10-preview/route.ts', import.meta.url), 'utf8');
  assert.match(route, /if \(!w10PreviewEnabled\(\)\) throw new HttpError\(404/);
  assert.equal((route.match(/\.strict\(\)/g) || []).length, 3, 'request, selection and declared are strict');
});

// K4: structured specialties (owner decision 31.10.2026).
const { validateSpecialties, specialtyRatingError, readSpecialties, newSpecialtyId } = await import('../domain/character-specialties.ts');
const { validateExistingSheet, characterSheetFields } = await import('../domain/character-management.ts');
const { resolveDraftRoll } = await import('../domain/w10-hybrid-draft.ts');
const spec = (patch = {}) => ({ id: 'spec_00000000-aaaa', target: { kind: 'ability', id: 'firearms' }, name: 'Pistolen', ...patch });
const strong = { ...engineFixture, attributes: { ...engineFixture.attributes, Geschick: 4 }, skills: { ...engineFixture.skills, Schusswaffen: 4 } };

test('K4-1: specialty field is part of the sheet and validated structurally', () => {
  assert.ok(characterSheetFields.includes('specialties'));
  assert.equal(validateSpecialties(undefined), null);
  assert.equal(validateSpecialties([spec(), spec({ id: 'spec_11111111-bbbb', target: { kind: 'attribute', id: 'dexterity' }, name: 'Schnelle Reflexe', scope: 'Ausweichen', active: false })]), null);
  assert.match(newSpecialtyId(), /^spec_[0-9a-f-]{36}$/);
  for (const bad of [[spec({ id: 'x' })], [spec(), spec()], [spec({ target: { kind: 'ability', id: 'security' } })], [spec({ target: { kind: 'virtue', id: 'courage' } })],
    [spec({ name: ' ' })], [spec({ active: 'yes' })], [spec({ extra: 1 })], [spec({ target: { kind: 'ability', id: 'firearms', key: 'Schusswaffen' } })],
    [spec(), spec({ id: 'spec_22222222-cccc', name: '  pistolen ' })], 'Pistolen', {}]) assert.notEqual(validateSpecialties(bad), null, JSON.stringify(bad));
  // Same name inactive twice is allowed (history kept), and different traits may share a name.
  assert.equal(validateSpecialties([spec(), spec({ id: 'spec_22222222-cccc', active: false })]), null);
  assert.notEqual(validateExistingSheet({ ...engineFixture, specialties: [spec({ id: 'kaputt' })] }), null);
  assert.equal(validateExistingSheet({ ...engineFixture, specialties: [spec()] }), null, 'Rating is not part of structural validation');
  assert.deepEqual(readSpecialties({ specialties: [spec({ id: 'kaputt' })] }), [], 'Malformed lists are never guessed');
});

test('K4-2: new or changed specialties need a rating of 4; untouched old entries never block edits', () => {
  assert.match(specialtyRatingError({ ...engineFixture, specialties: [spec()] }, engineFixture), /Schusswaffen braucht mindestens 4 Punkte/);
  assert.equal(specialtyRatingError({ ...strong, specialties: [spec()] }, strong), null);
  assert.equal(specialtyRatingError({ ...engineFixture, specialties: [spec({ active: false })] }, engineFixture), null, 'Inactive entries may stay');
  // Trait dropped below 4 later: the stored specialty survives unrelated edits.
  const before = { ...strong, specialties: [spec()] }, after = { ...before, skills: { ...strong.skills, Schusswaffen: 3 }, concept: 'neu' };
  assert.equal(specialtyRatingError(after, before), null);
  assert.match(specialtyRatingError({ ...after, specialties: [spec({ name: 'Revolver' })] }, before), /mindestens 4/, 'Renaming counts as a change');
});

test('K4-3: preview applies a specialty only to the matching selected trait with rating 4+', () => {
  const body = { ...strong, specialties: [spec(), spec({ id: 'spec_33333333-dddd', target: { kind: 'attribute', id: 'dexterity' }, name: 'Fingerfertig' }),
    spec({ id: 'spec_44444444-eeee', target: { kind: 'ability', id: 'melee' }, name: 'Säbel' }), spec({ id: 'spec_55555555-ffff', name: 'Alt', active: false })] };
  const sel = (specialtyId) => ({ attributeId: 'dexterity', abilityId: 'firearms', ...(specialtyId ? { specialtyId } : {}) });
  const plain = preview(body, sel());
  assert.equal(plain.specialtyApplies, false);
  assert.deepEqual(plain.specialties.map(s => [s.name, s.applicable, s.reason]), [['Pistolen', true, undefined], ['Fingerfertig', true, undefined], ['Alt', false, 'SPECIALTY_INACTIVE']]);
  const used = deriveW10Preview(body, sel('spec_00000000-aaaa'), declared(), 9, { claimedBy: 'player' });
  assert.equal(used.specialtyApplies, true);
  assert.deepEqual(used.specialty, { id: 'spec_00000000-aaaa', name: 'Pistolen', claimedBy: 'player' });
  assert.match(used.provenance.find(p => p.part === 'specialty').source, /jede 10 zählt doppelt · vom Spieler beansprucht/);
  assert.match(deriveW10Preview(body, sel('spec_33333333-dddd'), declared(), 9, { claimedBy: 'gm' }).provenance.find(p => p.part === 'specialty').source, /von der SL gesetzt/);
  assert.equal(preview(body, sel('spec_44444444-eeee')).code, 'SPECIALTY_NOT_FOR_TRAIT');
  assert.equal(preview(body, sel('spec_55555555-ffff')).code, 'SPECIALTY_INACTIVE');
  assert.equal(preview(body, sel('spec_99999999-0000')).code, 'SPECIALTY_NOT_FOUND');
  const weak = { ...body, skills: { ...strong.skills, Schusswaffen: 3 } };
  assert.equal(preview(weak, sel('spec_00000000-aaaa')).code, 'SPECIALTY_TRAIT_BELOW_4');
  assert.equal(preview(weak, sel('spec_00000000-aaaa')).message.includes('bleibt gespeichert'), true);
  // Sheets without the field keep working unchanged.
  assert.equal(preview(engineFixture, sel()).specialties.length, 0);
});

test('K4-4: an applied specialty doubles only rolled tens; ones cancel afterwards (V20)', () => {
  const used = preview({ ...strong, specialties: [spec()] }, { attributeId: 'dexterity', abilityId: 'firearms', specialtyId: 'spec_00000000-aaaa' });
  const roll = faces => resolveDraftRoll({ rollId: 'k4', characterVersion: 9, kind: 'ordinary', pool: faces.length, difficulty: used.difficulty.effective,
    specialtyApplies: used.specialtyApplies }, faces).evaluation;
  const base = [10, 1, 2, 3, 4, 5, 6, 7];
  assert.deepEqual([roll(base).rawSuccesses, roll(base).netRolledSuccesses, roll(base).outcome], [4, 3, 'success'], '10 counts twice, 6 and 7 once, one 1 cancels');
  const noTen = [1, 6, 2, 3, 4, 5, 2, 3];
  assert.deepEqual([roll(noTen).rawSuccesses, roll(noTen).outcome], [1, 'failure'], 'No ten, no bonus');
});

// K6: own abilities with a stable ID (owner decision 31.10.2026).
const { validateCustomAbilityIds, readCustomAbilities, customAbilitiesWithoutId, newCustomAbilityId } = await import('../domain/custom-abilities.ts');
const own = (patch = {}) => ({ id: 'cab_00000000-aaaa', name: 'Falknerei', value: 3, category: 'Fertigkeit', ...patch });
const legacyRows = [{ name: 'Talent', category: 'Talent', value: 2 }, { name: 'Alte Notiz', value: 1 }];

test('K6-1: IDs, category and confusion protection apply to entries with an ID only', () => {
  assert.match(newCustomAbilityId(), /^cab_[0-9a-f-]{36}$/);
  assert.equal(validateCustomAbilityIds([...legacyRows, own()]), null);
  assert.equal(validateCustomAbilityIds('Historischer Freitext'), null, 'Free text stays untouched');
  assert.equal(validateCustomAbilityIds([{ name: 'Doppelt', value: 1 }, { name: 'Doppelt', value: 2 }]), null, 'Legacy duplicates are not judged');
  for (const [bad, pattern] of [[[own({ id: 'cab_x' })], /eindeutige ID/], [[own(), own()], /eindeutige ID/], [[own({ category: 'talent' })], /Kategorie/],
    [[own({ category: undefined })], /Kategorie/], [[own({ active: 'nein' })], /Status/], [[own({ extra: 1 })], /Unbekannte/],
    [[own({ name: ' nahkampf ' })], /V20-Standardfähigkeit/], [[...legacyRows, own({ name: 'alte  notiz' })], /verwechselbar/],
    [[own(), own({ id: 'cab_11111111-bbbb', name: 'FALKNEREI' })], /verwechselbar/]]) assert.match(validateCustomAbilityIds(bad), pattern, JSON.stringify(bad));
  assert.equal(validateCustomAbilityIds([own(), own({ id: 'cab_11111111-bbbb', active: false })]), null, 'A deactivated twin may stay for history');
  assert.match(validateExistingSheet({ ...engineFixture, customAbilities: [own({ name: 'Nahkampf' })] }), /Standardfähigkeit/);
});

test('K6-2: entries without an ID stay visible, unchanged and not selectable', () => {
  const body = { ...engineFixture, customAbilities: [...legacyRows, own()] }, before = JSON.stringify(body);
  assert.deepEqual(readCustomAbilities(body).map(c => c.id), ['cab_00000000-aaaa']);
  assert.equal(customAbilitiesWithoutId(body), 2);
  assert.equal(customAbilitiesWithoutId({ customAbilities: 'Freitext' }), 1);
  assert.equal(preview(body, { attributeId: 'wits' }).customAbilitiesWithoutId, 2);
  assert.equal(JSON.stringify(body), before);
  rejects(() => preview(body, { attributeId: 'wits', abilityId: 'custom:Alte Notiz' }), 'UNKNOWN_ABILITY_ID');
});

test('K6-3: own abilities are selectable by ID and follow the V20 group rules', () => {
  const body = { ...engineFixture, customAbilities: [own(), own({ id: 'cab_22222222-cccc', name: 'Heraldik', value: 0, category: 'Kenntnis' }),
    own({ id: 'cab_33333333-dddd', name: 'Gassenwissen', value: 0, category: 'Talent' }), own({ id: 'cab_44444444-eeee', name: 'Kutschenlenken', value: 0, category: 'Fertigkeit' }),
    own({ id: 'cab_55555555-ffff', name: 'Alt', value: 5, active: false })] };
  const pick = id => preview(body, { attributeId: 'wits', abilityId: 'custom:' + id });
  const ready = pick('cab_00000000-aaaa');
  assert.deepEqual(ready.pool, { base: 5, effective: 5 }, 'Geistesschärfe 2 + Falknerei 3');
  assert.deepEqual(ready.selection, { attributeId: 'wits', abilityId: 'custom:cab_00000000-aaaa', category: 'skill' });
  assert.equal(ready.provenance[1].source, 'Charakterbogen · Eigene Fähigkeit (Fertigkeit) · Falknerei');
  assert.equal(pick('cab_22222222-cccc').code, 'UNTRAINED_KNOWLEDGE');
  assert.deepEqual(pick('cab_33333333-dddd').difficulty.modifiers, []);
  assert.equal(pick('cab_44444444-eeee').difficulty.effective, 7);
  assert.equal(pick('cab_55555555-ffff').code, 'CUSTOM_ABILITY_INACTIVE');
  assert.equal(pick('cab_99999999-0000').code, 'CUSTOM_ABILITY_NOT_FOUND');
  rejects(() => preview(body, { attributeId: 'wits', abilityId: 'custom:kaputt' }), 'UNKNOWN_ABILITY_ID');
  // Renaming keeps the ID and therefore the selection.
  const renamed = { ...body, customAbilities: body.customAbilities.map(c => c.id === 'cab_00000000-aaaa' ? { ...c, name: 'Beizjagd' } : c) };
  assert.equal(preview(renamed, { attributeId: 'wits', abilityId: 'custom:cab_00000000-aaaa' }).provenance[1].label, 'Beizjagd');
  // An invalid list is never guessed: no own ability becomes selectable.
  assert.equal(preview({ ...body, customAbilities: [own(), own()] }, { attributeId: 'wits', abilityId: 'custom:cab_00000000-aaaa' }).code, 'CUSTOM_ABILITY_NOT_FOUND');
});

test('K6-4: specialties can target own abilities by ID; dangling references are refused', () => {
  const ownSpec = spec({ id: 'spec_66666666-aaaa', target: { kind: 'customAbility', id: 'cab_00000000-aaaa' }, name: 'Habichte' });
  const body = { ...engineFixture, customAbilities: [own({ value: 4 })], specialties: [ownSpec] };
  assert.equal(validateExistingSheet(body), null);
  assert.match(validateExistingSheet({ ...body, customAbilities: [] }), /gültige Eigenschaft oder Fähigkeit/, 'Removing the ability needs the specialty handled first');
  const used = preview(body, { attributeId: 'wits', abilityId: 'custom:cab_00000000-aaaa', specialtyId: 'spec_66666666-aaaa' });
  assert.equal(used.specialtyApplies, true);
  assert.match(used.provenance.find(p => p.part === 'specialty').source, /Spezialisierung \(Falknerei\)/);
  assert.equal(specialtyRatingError({ ...body, customAbilities: [own({ value: 3 })] }, { ...engineFixture, customAbilities: [own({ value: 3 })] }).includes('Falknerei braucht mindestens 4'), true);
  const inactive = { ...body, customAbilities: [own({ value: 4, active: false })] };
  assert.equal(preview(inactive, { attributeId: 'wits', abilityId: 'custom:cab_00000000-aaaa', specialtyId: 'spec_66666666-aaaa' }).code, 'CUSTOM_ABILITY_INACTIVE');
});

// K1 (Phase-B part) with R1/R1b: new personal stress is read-only and visible; the legacy value has no effect.
const { readPersonalStress, legacyManualStress } = await import('../domain/personal-stress.ts');

test('K1-1: new personal stress 0–300 starts at 0 as "not recorded" and is never written', () => {
  const body = structuredClone(engineFixture), before = JSON.stringify(body);
  assert.deepEqual(readPersonalStress(body), { units: 0, points: 0, progress: 0, maximum: 300, recorded: false });
  assert.equal(JSON.stringify(body), before, 'Nothing initialised on the sheet');
  assert.deepEqual(readPersonalStress({ personalStressUnits: 150 }), { units: 150, points: 1, progress: 50, maximum: 300, recorded: true });
  assert.deepEqual(readPersonalStress({ personalStressUnits: 300 }), { units: 300, points: 3, progress: 0, maximum: 300, recorded: true });
  for (const bad of [-1, 301, 2.5, '100']) assert.deepEqual(readPersonalStress({ personalStressUnits: bad }), { units: 0, points: 0, progress: 0, maximum: 300, recorded: false, invalid: true });
});

test('K1-2: neither the new value nor the legacy manual value changes pool or difficulty in Phase B', () => {
  const sel = { attributeId: 'dexterity', abilityId: 'firearms' };
  const calm = deriveW10Preview(engineFixture, sel, declared(), 9);
  const stressed = deriveW10Preview({ ...engineFixture, personalStressUnits: 300 }, sel, declared(), 9, { legacyManualStress: 10 });
  assert.deepEqual([stressed.pool, stressed.difficulty], [calm.pool, calm.difficulty]);
  assert.equal(stressed.provenance.some(p => p.id === 'personal_stress'), false);
  assert.deepEqual(stressed.stress, { personal: { units: 300, points: 3, progress: 0, maximum: 300, recorded: true }, legacyManual: { value: 10, maximum: 10, effect: 'none' }, appliedToRoll: false });
  assert.equal(calm.stress.legacyManual, null);
  assert.equal(legacyManualStress('7'), null);
  assert.match(calm.notApplied.find(n => n.id === 'personal_stress').reason, /alte manuelle Wert \(0–10\) wirkt nie/);
});

test('K1-3: the new field is server-owned: not a sheet field and protected in the generic editor', () => {
  assert.equal(characterSheetFields.includes('personalStressUnits'), false, 'edit_sheet cannot patch it');
  const route = readFileSync(new URL('../app/api/records/route.ts', import.meta.url), 'utf8');
  assert.match(route, /protectedKeys = \[[^\]]*"personalStressUnits"\]/);
});

test('Release decision: specialties and own-ability fields are marked as preparation while the profile is unreleased', async () => {
  const { hybridPreparationNote } = await import('../domain/character-specialties.ts');
  assert.equal(HYBRID_DRAFT_PROFILE.productionEnabled, false);
  assert.match(hybridPreparationNote(), /Vorbereitung .* noch keine Würfelwirkung/);
  const editor = readFileSync(new URL('../app/spielbereich/modules/character-sheet-editor.tsx', import.meta.url), 'utf8');
  const detail = readFileSync(new URL('../app/spielbereich/modules/character-detail.tsx', import.meta.url), 'utf8');
  assert.equal((editor.match(/data-hybrid-preparation/g) || []).length, 2, 'Specialties and own-ability block in the editor');
  assert.equal((detail.match(/data-hybrid-preparation/g) || []).length, 1, 'Specialties in the sheet view');
});
