import test from 'node:test';
import assert from 'node:assert/strict';
import {preparationPlaces} from '../app/spielbereich/modules/preparation-catalog.ts';
test('preparation breadcrumbs reuse original IDs and keep equal room names distinguishable',()=>{
  const source=[{id:'place',title:'Testort',level:'location'},{id:'area',title:'Bereich',parent_id:'place',level:'area'},{id:'room-a',title:'Zimmer',parent_id:'area',level:'room'},{id:'room-b',title:'Zimmer',parent_id:'place',level:'room'}];
  const original=structuredClone(source),choices=preparationPlaces(source);
  assert.deepEqual(source,original);
  assert.equal(choices[2].summary,'Raum › Testort › Bereich › Zimmer');
  assert.notEqual(choices[2].summary,choices[3].summary);
  assert.deepEqual(choices.map(p=>p.id),source.map(p=>p.id));
});
test('missing ancestors and cycles do not invent provenance or loop',()=>{
  const choices=preparationPlaces([{id:'a',title:'A',parent_id:'b'},{id:'b',title:'B',parent_id:'a'},{id:'c',title:'C',parent_id:'missing'}]);
  assert.equal(choices[0].summary,'B › A');assert.equal(choices[2].summary,'C');
});
