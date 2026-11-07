import test from 'node:test';
import assert from 'node:assert/strict';
import {ATTRIBUTES,CATEGORIES,FIGURE_TYPES,HEALTH_LEVELS,TIERS,effectivePool,nextLabel,resolveFigure,woundPenalty} from '../domain/standard-figures.ts';
import {emptyScene,sceneDocumentSchema} from '../domain/story-scene.ts';

test('library has exactly 30 types in 5 categories and 150 resolvable variants', () => {
  assert.equal(FIGURE_TYPES.length, 30);
  assert.equal(new Set(FIGURE_TYPES.map(t => t.id)).size, 30);
  for (const c of CATEGORIES) assert.equal(FIGURE_TYPES.filter(t => t.category === c.id).length, 6, c.id);
  assert.equal(TIERS.length, 5);
  let variants = 0;
  for (const t of FIGURE_TYPES) for (const tier of TIERS) {
    const v = resolveFigure(t.id, tier.id);
    assert.ok(v, `${t.id}/${tier.id}`);
    variants++;
    for (const k of ATTRIBUTES) assert.ok(v.attributes[k] >= 1 && v.attributes[k] <= 5, `${t.id}/${tier.id} ${k}`);
    for (const [k, n] of Object.entries(v.skills)) assert.ok(n >= 0 && n <= 5, `${t.id}/${tier.id} ${k}`);
    assert.ok(v.willpower >= 1 && v.willpower <= 10);
    assert.ok(v.actions.length >= 3 && v.actions.every(a => a.pool >= 1 && a.pool <= 10), `${t.id}/${tier.id} pools`);
    assert.equal(v.status, 'entwurf');
  }
  assert.equal(variants, 150);
});

test('tiers are ordered: a higher tier never lowers a trait of the same figure', () => {
  for (const t of FIGURE_TYPES) {
    let previous = resolveFigure(t.id, 'easy');
    for (const tier of TIERS.slice(1)) {
      const next = resolveFigure(t.id, tier.id);
      for (const k of ATTRIBUTES) assert.ok(next.attributes[k] >= previous.attributes[k], `${t.id} ${tier.id} ${k}`);
      for (const [k, n] of Object.entries(previous.skills)) assert.ok((next.skills[k] ?? 0) >= n, `${t.id} ${tier.id} ${k}`);
      previous = next;
    }
  }
});

test('small animals do not become super monsters: high tiers are encounters with unchanged single-figure values', () => {
  for (const id of ['animal_rat', 'animal_raven']) {
    const normal = resolveFigure(id, 'standard'), extreme = resolveFigure(id, 'extreme');
    assert.deepEqual(extreme.attributes, normal.attributes);
    assert.deepEqual(extreme.skills, normal.skills);
    assert.equal(extreme.encounter, true);
    assert.match(extreme.encounterHint, /Begegnungsstufe, nicht Einzelstärke/);
    assert.equal(normal.encounter, false);
  }
  assert.equal(resolveFigure('security_bouncer', 'extreme').encounter, false);
});

test('only fitting species carry blood; animals and civilians do not', () => {
  assert.equal(resolveFigure('civilian_passerby', 'standard').bloodMax, null);
  assert.equal(resolveFigure('animal_wolf', 'standard').bloodMax, null);
  assert.ok(resolveFigure('supernatural_vampire_young', 'standard').bloodMax > 0);
  assert.ok(resolveFigure('supernatural_ghoul_basic', 'standard').bloodMax > 0);
});

test('unknown type or tier does not resolve', () => {
  assert.equal(resolveFigure('nope', 'standard'), null);
  assert.equal(resolveFigure('security_bouncer', 'godlike'), null);
});

test('wound penalties follow the V20 health track and stop rolls when incapacitated', () => {
  assert.equal(HEALTH_LEVELS.length, 7);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(woundPenalty), [0, 0, 1, 1, 2, 2, 5, null]);
  assert.equal(effectivePool(5, 0), 5);
  assert.equal(effectivePool(5, 2), 4);
  assert.equal(effectivePool(5, 4), 3);
  assert.equal(effectivePool(5, 6), 0);
  assert.equal(effectivePool(5, 7), 0);
});

test('several figures of one type get distinct numbered labels', () => {
  const list = [];
  for (let i = 0; i < 3; i++) list.push({ label: nextLabel('Türsteher', list) });
  assert.deepEqual(list.map(x => x.label), ['Türsteher 1', 'Türsteher 2', 'Türsteher 3']);
});

test('scenes without prepared figures stay valid and carry the new field', () => {
  const old = { ...emptyScene() }; delete old.standardFigures;
  assert.deepEqual(sceneDocumentSchema.parse(old).standardFigures, []);
  const id = '0a3f0d6e-5b0a-4b6e-9d0a-6a5b6a9e8c11';
  assert.equal(sceneDocumentSchema.parse({ ...emptyScene(), standardFigures: [{ id, typeId: 'security_bouncer', tierId: 'hard', count: 2 }] }).standardFigures.length, 1);
  assert.throws(() => sceneDocumentSchema.parse({ ...emptyScene(), standardFigures: [{ id, typeId: 'security_bouncer', tierId: 'godlike', count: 2 }] }));
  assert.throws(() => sceneDocumentSchema.parse({ ...emptyScene(), standardFigures: [{ id, typeId: 'security_bouncer', tierId: 'hard', count: 11 }] }));
});


test('saved figure values drive pools and remain compatible with prepared scenes', async () => {
  const {figureTemplateSchema,resolveFigureTemplate}=await import('../domain/figure-templates.ts');
  const base=resolveFigure('security_bouncer','standard');
  const input={id:'90000000-0000-4000-8000-000000000001',name:'Eigener Wachmann',typeId:base.typeId,tierId:base.tierId,attributes:{...base.attributes,Geschick:4},skills:{...base.skills,Handgemenge:5},willpower:8,bloodMax:null};
  assert.equal(figureTemplateSchema.safeParse(input).success,true);
  const stats=resolveFigureTemplate({...input,version:2,updatedAt:'2026-11-04T00:00:00Z'});
  assert.equal(stats.actions.find(action=>action.label==='Zuschlagen').pool,9);
  assert.equal(stats.willpower,8);
  assert.notEqual(resolveFigure(base.typeId,base.tierId).actions.find(action=>action.label==='Zuschlagen').pool,9);
  assert.equal(figureTemplateSchema.safeParse({...input,attributes:{...input.attributes,Geschick:11}}).success,false);
  assert.equal(figureTemplateSchema.safeParse({...input,typeId:'missing'}).success,false);
  const prepared={id:'90000000-0000-4000-8000-000000000002',typeId:base.typeId,tierId:base.tierId,count:2,templateId:input.id};
  assert.equal(sceneDocumentSchema.parse({...emptyScene(),standardFigures:[prepared]}).standardFigures[0].templateId,input.id);
});
