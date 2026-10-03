import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { npcCardData } from '../app/spielbereich/modules/npc-card-data.ts';

test('NPC cards show only existing short facts, no inferred category or affiliation', () => {
  const entity = {title:'Mara Voss',canonStatus:'confirmed',playState:'historical',content:{alias:'Die Archivarin',clan:'Tremere',concept:'Chronistin',text:'Not a fact',gmNotes:'SECRET'}};
  const copy = structuredClone(entity);
  const card = npcCardData(entity);
  assert.equal(card.alias,'Die Archivarin');
  assert.equal(card.initials,'MV');
  assert.deepEqual(card.facts.map(f=>f.value),['Tremere','Chronistin','Bestätigt','Historisch']);
  assert.ok(card.facts.length<=5);
  assert.equal(JSON.stringify(card).includes('SECRET'),false);
  assert.deepEqual(entity,copy);
  assert.equal('category' in card,false);
});
test('Missing optional information stays absent; core and legacy statuses remain readable', () => {
  const card = npcCardData({title:'A',canonStatus:'draft',content:{alias:42,clan:null,concept:{}}});
  assert.equal(card.alias,'');
  assert.deepEqual(card.facts,[{label:'Kanon',value:'Entwurf'}]);
  assert.deepEqual(npcCardData({title:'X',canonStatus:'CANON',content:{}}).facts,[{label:'Kanon',value:'Kanon'}]);
});
test('Whole-card native button retains non-hover operation and responsive reduced-motion styles', () => {
  const panel = readFileSync(new URL('../app/spielbereich/modules/npc-panel.tsx',import.meta.url),'utf8');
  const css = readFileSync(new URL('../app/spielbereich/modules/npc-cards.module.css',import.meta.url),'utf8');
  assert.match(panel,/<button key=\{e.id\} className=\{cards.card\} aria-label=/);
  assert.match(panel,/onClick=\{\(\) => setSelected\(e.id\)\}/);
  assert.match(panel,/Akte öffnen/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/object-fit: contain/);
  assert.match(css,/prefers-reduced-motion: reduce/);
  assert.match(css,/max-width: 580px/);
  assert.doesNotMatch(css,/display:\s*none|visibility:\s*hidden/);
});
