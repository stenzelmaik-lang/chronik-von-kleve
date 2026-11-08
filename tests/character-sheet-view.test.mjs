import test from 'node:test';
import assert from 'node:assert/strict';
import {sheetView,SHEET_ATTRIBUTE_GROUPS,SHEET_ABILITY_GROUPS} from '../domain/character-sheet-view.ts';

const id='cab_12345678-aaaa';
const identity={name:'Dr. Helena Marquardt-Vogelsang von Kleve-Brienen zu Schenkenschanz',player:'Testspieler',chronicle:'Chronik von Kleve',clan:'Ventrue',generation:8,nature:'',demeanor:'Konformistin',concept:'Archivarin',sire:null};
const sheet={
  attributes:{Körperkraft:7,Geschick:0,Charisma:3,'Uralte Zähigkeit':2},
  abilities:{Aufmerksamkeit:3,Handgemenge:6,Etikette:0,'Heraldik (Altbestand)':2},
  specialties:[{id:'spec_1aaaaaaaaa',target:{kind:'ability',id:'brawl'},name:'Ringen'},{id:'spec_2aaaaaaaaa',target:{kind:'customAbility',id},name:'Goldprägung'},{id:'spec_3aaaaaaaaa',target:{kind:'attribute',id:'strength'},name:'Heben',active:false}],
  customAbilities:[{id,name:'Buchbinderei',value:3,category:'Fertigkeit'},{id:'cab_87654321-bbbb',name:'Kanzleisprache',value:2,category:'Kenntnis',active:false},{name:'Alte Freie Zeile',value:1}],
  disciplines:[{name:'Beherrschung',value:6},{name:'Präsenz',value:0},{name:'Seelenstärke'}],
  paths:[{name:'Pfad des Blutes',value:2,primary:true}],
  backgrounds:'Ressourcen 4 (Freitext aus dem Altbestand)',
  virtues:{Überzeugung:3,Mut:2},
  humanity:6,humanityPath:'',willpower:{permanent:7,temporary:3},
  health:{track:['lethal','bashing']},blood:{current:6,max:15,perRound:3},
  merits:[{name:'Eidetisches Gedächtnis',cost:2}],flaws:[{name:'Albträume'}],clanWeakness:'',
};
const v=sheetView(identity,sheet,{freeXp:4,totalXp:12});
const find=(groups,name)=>groups.flatMap(g=>g.rows).find(r=>r.name===name);

test('groups and order follow the German V20 paper sheet', () => {
  assert.deepEqual(v.attributes.map(g=>g.title),['Körperlich','Gesellschaftlich','Geistig']);
  assert.deepEqual(v.abilities.map(g=>g.title),['Talente','Fertigkeiten','Kenntnisse']);
  assert.deepEqual(v.attributes[0].rows.map(r=>r.name),['Körperkraft','Geschick','Widerstandsfähigkeit']);
  assert.equal(SHEET_ABILITY_GROUPS.every(([, ,names])=>names.length===10),true);
  assert.equal(SHEET_ATTRIBUTE_GROUPS.length,3);
});

test('value 0 stays a visible zero, a missing value is "not recorded", never 0', () => {
  const zero=find(v.attributes,'Geschick'),missing=find(v.attributes,'Widerstandsfähigkeit');
  assert.deepEqual([zero.value,zero.slots,zero.label],[0,5,'Geschick: 0']);
  assert.deepEqual([missing.value,missing.slots,missing.label],[null,5,'Widerstandsfähigkeit: nicht erfasst']);
  assert.equal(find(v.abilities,'Etikette').value,0);
  assert.equal(find(v.abilities,'Ausdruck').value,null);
  assert.equal(v.header.find(([k])=>k==='Wesen')[1],'–','empty header fields show a dash');
  assert.equal(v.header.find(([k])=>k==='Erzeuger')[1],'–');
});

test('values above five keep all their dots', () => {
  assert.deepEqual([find(v.attributes,'Körperkraft').value,find(v.attributes,'Körperkraft').slots],[7,7]);
  assert.deepEqual([find(v.abilities,'Handgemenge').value,find(v.abilities,'Handgemenge').slots],[6,6]);
  assert.equal(v.disciplines[0].slots,6);
});

test('specialties sit on their row with scope, status and minimum rating, as the previous view showed', () => {
  assert.deepEqual(find(v.abilities,'Handgemenge').specialties,['Ringen'],'rating 6 applies, no remark');
  assert.deepEqual(find(v.attributes,'Körperkraft').specialties,['Heben (deaktiviert)'],'a deactivated specialty stays visible with its status');
  assert.deepEqual(find(v.abilities,'Buchbinderei').specialties,['Goldprägung (wirkt erst ab 4 Punkten)'],'own ability rated 3');
  const scoped=sheetView({}, {abilities:{Etikette:4},specialties:[{id:'spec_4aaaaaaaaa',target:{kind:'ability',id:'etiquette'},name:'Elysium',scope:'nur Hof'}]});
  assert.deepEqual(find(scoped.abilities,'Etikette').specialties,['Elysium – nur Hof']);
});

test('own abilities stand in their group; inactive ones are left out; rows without a group are unassigned', () => {
  const skills=v.abilities.find(g=>g.title==='Fertigkeiten').rows;
  assert.equal(skills.at(-1).name,'Buchbinderei');
  assert.equal(skills.at(-1).own,true);
  assert.ok(!v.abilities.flatMap(g=>g.rows).some(r=>r.name==='Kanzleisprache'),'inactive own ability');
  assert.deepEqual(v.unassigned.map(r=>r.name),['Uralte Zähigkeit','Heraldik (Altbestand)','Alte Freie Zeile']);
});

test('lists, virtues, resources and health read like the sheet', () => {
  assert.deepEqual(v.disciplines.map(d=>[d.name,d.value]),[['Beherrschung',6],['Präsenz',0],['Seelenstärke',null]]);
  assert.equal(v.backgrounds,'Ressourcen 4 (Freitext aus dem Altbestand)','free text stays free text');
  assert.equal(v.paths[0].note,'Primärpfad');
  assert.deepEqual(v.virtues.map(r=>[r.name,r.value]),[['Überzeugung',3],['Selbstbeherrschung/Instinkt',null],['Mut',2]]);
  assert.deepEqual(v.merits,[{name:'Eidetisches Gedächtnis',cost:2}]);
  assert.deepEqual(v.flaws,[{name:'Albträume',cost:null}]);
  assert.deepEqual(v.humanity,{name:'Menschlichkeit',value:6});
  assert.deepEqual(v.willpower,{permanent:7,temporary:3});
  assert.deepEqual(v.blood,{current:6,max:15,perTurn:3});
  assert.equal(v.health.levels.length,7);
  assert.deepEqual(v.health.levels.slice(0,3).map(l=>l.mark),['X','/','']);
  assert.equal(v.health.levels[1].penalty,'-1');
  assert.equal(v.health.level,'Verletzt');
  assert.deepEqual(v.experience,{free:4,total:12});
});

test('very long names are kept whole; an empty sheet produces dashes, not zeros', () => {
  assert.equal(v.header[0][1],identity.name);
  const empty=sheetView({},{},{});
  assert.ok(empty.attributes.every(g=>g.rows.every(r=>r.value===null&&r.slots===5)));
  assert.deepEqual([empty.willpower.permanent,empty.blood.max,empty.humanity.value,empty.experience.free],[null,null,null,null]);
  assert.deepEqual(empty.virtues.map(r=>r.name),['Gewissen/Überzeugung','Selbstbeherrschung/Instinkt','Mut']);
  assert.deepEqual(empty.unassigned,[]);
});
