import test from 'node:test';
import assert from 'node:assert/strict';
import {sheetNumber,dotSlots,dotLabel} from '../domain/sheet-values.ts';

test('sheet values keep missing values missing and real zeros visible', () => {
  for (const missing of [undefined,null,'','  ','drei',Number.NaN,Infinity,{}]) assert.equal(sheetNumber(missing),null,String(missing));
  assert.equal(sheetNumber(0),0);
  assert.equal(sheetNumber('0'),0);
  assert.equal(sheetNumber('3'),3);
  assert.equal(sheetNumber(' 4 '),4);
  assert.equal(sheetNumber(7.9),7);
});

test('dot rows show at least five dots and grow for values above five', () => {
  assert.equal(dotSlots(null),5);
  assert.equal(dotSlots(0),5);
  assert.equal(dotSlots(3),5);
  assert.equal(dotSlots(7),7);
  assert.equal(dotSlots(8,10),10);
});

test('screen reader labels name missing values instead of reading zero', () => {
  assert.equal(dotLabel('Stärke',null),'Stärke: nicht erfasst');
  assert.equal(dotLabel('Stärke',0),'Stärke: 0');
  assert.equal(dotLabel('Blut',4,13),'Blut: 4 von 13');
  assert.equal(dotLabel('Blut',4,null),'Blut: 4');
});
