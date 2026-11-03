import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {locationCreationParent} from '../domain/location-creation.ts';

const root={id:'place.station',locationId:'place.station',parentId:null,level:'location',title:'Hauptbahnhof Kleve'};
const forecourt={id:'area.forecourt',locationId:root.id,parentId:root.id,level:'area',title:'Bahnhofsvorplatz'};
const hall={id:'area.hall',locationId:root.id,parentId:root.id,level:'area',title:'Empfangshalle'};
const room={id:'room.waiting',locationId:root.id,parentId:hall.id,level:'room',title:'Warteraum'};
const nodes=[root,forecourt,hall,room];

test('Main-place selection exposes its existing identity as the parent of a new area',()=>{
  assert.equal(locationCreationParent('area',nodes,root.id,root.id),root);
  assert.equal(locationCreationParent('room',nodes,root.id,root.id),null);
  assert.equal(locationCreationParent('location',nodes,root.id,root.id),null);
});

test('An existing area creates sibling areas under the main place and rooms under itself',()=>{
  assert.equal(locationCreationParent('area',nodes,root.id,forecourt.id),root);
  assert.equal(locationCreationParent('area',nodes,root.id,hall.id),root);
  assert.equal(locationCreationParent('room',nodes,root.id,hall.id),hall);
  assert.equal(locationCreationParent('room',nodes,root.id,forecourt.id),forecourt);
});

test('Room and information selection never turns an area into a main place or a room parent',()=>{
  const information={id:'information.note',locationId:root.id,parentId:root.id,level:'information',title:'Beobachtung'};
  for(const selected of [room,information]){
    assert.equal(locationCreationParent('area',[...nodes,information],root.id,selected.id),root);
    assert.equal(locationCreationParent('information',[...nodes,information],root.id,selected.id),selected.level==='information'?root:selected);
    assert.equal(locationCreationParent('room',[...nodes,information],root.id,selected.id),null);
  }
});

test('Missing, malformed or foreign targets cannot fall back to creating another main place',()=>{
  const foreign={...hall,id:'area.foreign',locationId:'place.other',parentId:'place.other'};
  assert.equal(locationCreationParent('area',[],root.id,root.id),null);
  assert.equal(locationCreationParent('area',[{...root,parentId:'area.wrong'}],root.id,root.id),null);
  assert.equal(locationCreationParent('area',[{...root,locationId:'place.other'}],root.id,root.id),null);
  assert.equal(locationCreationParent('area',nodes,'place.missing',hall.id),null);
  assert.equal(locationCreationParent('room',[...nodes,foreign],root.id,foreign.id),null);
  assert.equal(locationCreationParent('room',nodes,root.id,'area.missing'),null);
});

test('Resolving a parent leaves all existing node IDs, fields and ordering untouched',()=>{
  const snapshot=JSON.stringify(nodes);
  const frozen=Object.freeze(nodes.map(node=>Object.freeze({...node})));
  assert.equal(locationCreationParent('area',frozen,root.id,hall.id)?.id,root.id);
  assert.equal(locationCreationParent('room',frozen,root.id,hall.id)?.id,hall.id);
  assert.equal(JSON.stringify(nodes),snapshot);
  assert.equal(JSON.stringify(frozen),snapshot);
});

test('Directory actions show their actual target and creation uses that same stable parent',()=>{
  const ui=readFileSync(new URL('../app/spielbereich/modules/location-cms.tsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../app/spielbereich/modules/location-cms.module.css',import.meta.url),'utf8');
  assert.ok(ui.includes('Bereich hinzufügen<small>Unter {areaParent.title}'));
  assert.ok(ui.includes('Raum hinzufügen<small>Unter {roomParent.title}'));
  assert.ok(ui.includes('const parent=locationCreationParent(level,nodes,placeId,nodeId)'));
  assert.ok(ui.includes('if(level!=="location"&&!parent)return'));
  assert.ok(ui.includes('parentId:parent?.id??null'));
  assert.ok(ui.includes('Neue Erkenntnis'));
  assert.match(css,/\.directoryActions :global\(\.button\) \{[^}]*min-height: 44px/);
  assert.match(css,/\.childCreateAction > span \{[^}]*overflow-wrap: anywhere/);
  assert.ok(ui.includes('data-creating={Boolean(newNode)}'));
  assert.match(css,/\.directoryPanel\[data-creating="true"\] \{ height: auto; max-height: none/);
  assert.match(css,/\.directoryPanel\[data-creating="true"\] \.directoryScroll \{[^}]*min-height: 120px/);
});
