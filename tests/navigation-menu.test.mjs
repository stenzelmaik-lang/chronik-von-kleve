import test from 'node:test';
import assert from 'node:assert/strict';
import {menuSections,navGroups,sections} from '../app/spielbereich/modules/navigation.ts';

const ids=groups=>groups.flatMap(g=>g.items.map(i=>i.id));

test('players see four groups without the Spielleitung, and no hidden areas', () => {
  const menu=menuSections(false,false);
  assert.deepEqual(menu.map(g=>g.group),['Mein Abend','Mein Charakter','Meine Seiten','Die Welt']);
  for(const id of ['vorbereitung','cms','ortscms','wuerfel','weltkarte'])assert.ok(!ids(menu).includes(id),id+' is not in the player menu');
  for(const id of ['dashboard','sitzung','termine','rueckblick','charaktere','inventar','gefallen','wirtschaft','notizen','galerie','chronik','schauplaetze','nscs','archiv','regelwerk','neuigkeiten','haendler'])assert.ok(ids(menu).includes(id),id+' is in the player menu');
});

test('the SL gets the Spielleitung group; place editing needs the CMS right', () => {
  assert.deepEqual(ids(menuSections(true,false)).filter(id=>['vorbereitung','cms','ortscms'].includes(id)),['vorbereitung','cms']);
  assert.deepEqual(ids(menuSections(true,true)).filter(id=>['vorbereitung','cms','ortscms'].includes(id)),['vorbereitung','cms','ortscms']);
  assert.deepEqual(ids(menuSections(false,true)).filter(id=>['vorbereitung','cms','ortscms'].includes(id)),['ortscms'],'an editor sees only the place editing');
});

test('names follow the glossary and every area has exactly one entry', () => {
  const name=id=>sections.find(s=>s.id===id).name;
  assert.equal(name('dashboard'),'Spielerzentrale');assert.equal(name('sitzung'),'Spieltisch');assert.equal(name('schauplaetze'),'Orte');assert.equal(name('archiv'),'Überlieferungen');assert.equal(name('galerie'),'Galerie');
  assert.equal(new Set(sections.map(s=>s.id)).size,sections.length);
  assert.ok(sections.every(s=>s.mainNav===false||navGroups.includes(s.group)),'every menu entry has a known group');
  assert.ok(!sections.some(s=>/Bilder & Dateien|Schauplätze|Chronik erkunden/.test(s.name)),'retired names are gone');
});
