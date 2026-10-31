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
  assert.deepEqual(result.provenance.map(p => [p.part, p.label, p.amount]), [['attribute', 'Geschick', 3], ['ability', 'Schusswaffen', 3]]);
  assert.deepEqual(result.difficulty, { base: 6, modifiers: [], effective: 6, uncapped: 6, capped: false });
  assert.equal(result.specialtyApplies, false);
  assert.equal(result.profile, HYBRID_DRAFT_PROFILE);
  assert.equal(result.profile.productionEnabled, false);
});

test('B03: pure attribute check is allowed and has no training modifier', () => {
  const result = preview(engineFixture, { attributeId: 'strength' });
  assert.deepEqual(result.pool, { base: 4, effective: 4 });
  assert.deepEqual(result.provenance.map(p => p.part), ['attribute']);
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
  assert.equal(knowledge.status, 'blocked'); assert.equal(knowledge.code, 'UNTRAINED_KNOWLEDGE');
  assert.equal(knowledge.provenance.length, 2, 'Blocked previews still show where the values came from');
});

test('B05: SG overflow needs an explicit policy and stays visible when capped', () => {
  const sel = { attributeId: 'dexterity', abilityId: 'melee' };
  assert.equal(preview(engineFixture, sel, declared({ baseDifficulty: 10 })).code, 'DIFFICULTY_OVERFLOW_REQUIRES_POLICY');
  const capped = preview(engineFixture, sel, declared({ baseDifficulty: 10, difficultyOverflow: 'cap_at_10' }));
  assert.deepEqual({ ...capped.difficulty, modifiers: undefined }, { base: 10, effective: 10, uncapped: 11, capped: true, modifiers: undefined });
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
  assert.deepEqual(result.notApplied.map(n => n.id), ['specialty', 'wounds', 'hunger', 'personal_stress', 'group_stress', 'willpower']);
  // Existing runtime values (blood, willpower, health) are on the sheet but never enter the Phase-B pool.
  assert.equal(preview({ ...body, blood: 0, willpowerTemporary: 0, health: { current: 'Verkrüppelt' } }, { attributeId: 'dexterity', abilityId: 'stealth' }).pool.base, 6);
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
