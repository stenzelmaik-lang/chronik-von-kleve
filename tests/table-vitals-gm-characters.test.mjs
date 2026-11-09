import test from 'node:test';
import assert from 'node:assert/strict';
import {applyTableVitals,emptyTableVitals,tableCommandSchema,tableVitalsSchema} from '../domain/character-vitals.ts';

test('the SL can show or hide its own control characters at the table; older states stay valid', () => {
  const old=emptyTableVitals();
  assert.equal(tableVitalsSchema.safeParse(old).success,true,'a state without the setting is valid (default: hidden)');
  const cmd=tableCommandSchema.parse({op:'settings',hideGmCharacters:false});
  const shown=applyTableVitals(old,cmd,'SL','2026-11-09T00:00:00Z','x');
  assert.equal(shown.hideGmCharacters,false);
  assert.equal(tableVitalsSchema.safeParse(shown).success,true);
  assert.equal(applyTableVitals(shown,tableCommandSchema.parse({op:'settings',hideGmCharacters:true}),'SL','2026-11-09T00:00:00Z','y').hideGmCharacters,true);
  assert.equal(tableCommandSchema.safeParse({op:'settings',hideGmCharacters:'ja'}).success,false);
});
