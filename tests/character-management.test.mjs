import test from 'node:test';
import assert from 'node:assert/strict';
import {adoptHistoricalCharacter,verifyHistoricalCharacter,appendCharacterXp,characterPermissions,characterFieldEqual,characterSheet,characterXpSummary,validateExistingSheet} from '../domain/character-management.ts';
import {applySlAdjustment,applyXpPurchase,creationDeviation,validateCharacterDraft,withCreationBaseValues,xpBalance,xpCost} from '../domain/character-engine.ts';
const original={clan:'Toreador',attributes:{Geschick:7},skills:{'Historische Fähigkeit':6},disciplines:[{name:'Auspex',value:3}],virtues:{Mut:4},willpower:5,willpowerTemporary:2,blood:3,bloodMax:11,unknownLegacy:{keep:true}};
const input={available:9,earned:null,spent:null,source:'Synthetic original sheet',reason:'Deliberate historical takeover',operationId:'opening'};
const adopt=()=>adoptHistoricalCharacter(structuredClone(original),input,'gm','2026-01-01');
test('Historical takeover preserves every existing value and does not confirm or grant a reward',()=>{const next=adopt();for(const [key,value] of Object.entries(original))assert.deepEqual(next[key],value);assert.equal(next.characterState,'review');assert.equal(next.xpLedger[0].kind,'historical');assert.equal(xpBalance(next),9);assert.equal(characterXpSummary(next).received,null);assert.equal(characterXpSummary(next).spent,null);assert.deepEqual(next.historicalSnapshot,characterSheet(original));assert.equal(next.creationSnapshot,undefined);});
test('Historical totals remain unknown after later rewards and spending',()=>{let body=adopt();body=appendCharacterXp(body,{id:'new',kind:'grant',amount:5,reason:'New award',createdAt:'now'});const result=applyXpPurchase(body,{category:'discipline',target:'Auspex',from:3,to:4,inClan:true});assert.equal(result.ok,false);assert.equal(characterXpSummary(body).grants,5);assert.equal(characterXpSummary(body).received,null);});
test('Known historical totals reconcile, with regular awards counted exactly once',()=>{let body=adoptHistoricalCharacter(original,{...input,earned:20,spent:11},'gm');body=appendCharacterXp(body,{id:'award',kind:'grant',amount:5,reason:'award',createdAt:'now'});assert.deepEqual([characterXpSummary(body).received,characterXpSummary(body).spent,xpBalance(body)],[25,11,14]);});
test('Invalid historical totals are refused',()=>{for(const patch of [{earned:20,spent:2},{available:-1},{available:1.5}])assert.throws(()=>adoptHistoricalCharacter(original,{...input,...patch},'gm'));});
test('Historical enrollment is explicit and cannot be repeated or overwrite an existing ledger',()=>{assert.throws(()=>adoptHistoricalCharacter(adopt(),input,'gm'));assert.throws(()=>adoptHistoricalCharacter({...original,xpLedger:[{id:'existing',kind:'grant',amount:2}]},input,'gm'));});
test('No new-character defaults are added to a historical body',()=>{const next={...adopt(),characterState:'draft'};assert.deepEqual(withCreationBaseValues(next),next);assert.equal(next.attributes.Körperkraft,undefined);});
test('Historical validation does not apply creation point caps or rename saved abilities',()=>{const next=adopt();assert.equal(validateCharacterDraft('chronik-von-kleve',next).ok,true);assert.equal(next.skills['Historische Fähigkeit'],6);assert.equal(validateCharacterDraft('chronik-von-kleve',{...next,attributes:{Geschick:11}}).ok,false);});
test('Confirmed permanent fields remain locked on the generic write path',()=>{const previous={...adopt(),characterState:'confirmed'};assert.equal(validateCharacterDraft('chronik-von-kleve',{...previous,attributes:{Geschick:2}},previous).ok,false);});
test('SL can correct values above five without spending XP or changing snapshots',()=>{const body=adopt();const result=applySlAdjustment(body,{category:'attribute',target:'Geschick',value:6},'gm','documented correction');assert.equal(result.ok,true);for(const key of ['xpLedger','historicalSnapshot','blood','willpowerTemporary'])assert.deepEqual(result.body[key],body[key]);});
test('Regular XP purchases retain their rule limit; SL corrections do not invent advancement rights',()=>{const body={...adopt(),xpLedger:[{id:'opening',kind:'historical',amount:500}]};assert.equal(applyXpPurchase(body,{category:'attribute',target:'Geschick',from:7,to:8}).ok,false);});
test('Ledger entry IDs prevent a duplicated reward after reloading',()=>{const entry={id:'same',kind:'grant',amount:5,reason:'award',createdAt:'now'},body=appendCharacterXp(adopt(),entry);assert.throws(()=>appendCharacterXp(body,entry));assert.equal(xpBalance(body),14);});
test('Counterbooking retains the original and cannot be repeated',()=>{let body=appendCharacterXp(adopt(),{id:'award',kind:'grant',amount:5,reason:'award',createdAt:'now'});body=appendCharacterXp(body,{id:'reverse',kind:'correction',amount:-5,referenceId:'award',reason:'wrong award',createdAt:'now'});assert.equal(body.xpLedger.length,3);assert.equal(xpBalance(body),9);assert.throws(()=>appendCharacterXp(body,{id:'again',kind:'correction',amount:-5,referenceId:'award',reason:'duplicate',createdAt:'now'}));});
test('A correction cannot overdraw the XP balance or falsely reverse a spend',()=>{const body=adopt();for(const entry of [{amount:-10},{amount:-2,referenceId:'missing'},{amount:0}])assert.throws(()=>appendCharacterXp(body,{id:'bad',kind:'correction',reason:'bad',createdAt:'now',...entry}));});
test('Editing and development permissions are independent with compatible defaults',()=>{assert.deepEqual(characterPermissions({}),{editing:false,development:'direct'});assert.deepEqual(characterPermissions({characterPermissions:{editing:true,development:'blocked'}}),{editing:true,development:'blocked'});});
test('Structural checks retain text lists and reject impossible resources and malformed ratings',()=>{assert.equal(validateExistingSheet({...original,backgrounds:'Historical notes'}),null);for(const patch of [{attributes:{Geschick:Infinity}},{skills:{Test:2.5}},{willpower:1},{bloodMax:2},{disciplines:[{name:'',value:1}]}])assert.ok(validateExistingSheet({...original,...patch}));});

test("Legacy field comparison ignores JSON property order, not actual changes",()=>{assert.equal(characterFieldEqual([{name:"Custom",category:"Talent",value:3}],[{name:"Custom",value:3,category:"Talent"}]),true);assert.equal(characterFieldEqual({value:3},{value:4}),false);});

test('Chronicle XP prices use current willpower, not freebie price; unpriced backgrounds stay blocked',()=>{assert.deepEqual(xpCost({category:'willpower',from:5,to:6}),{ok:true,cost:5});assert.deepEqual(xpCost({category:'virtue',from:3,to:4}),{ok:true,cost:6});assert.equal(xpCost({category:'background',from:2,to:3}).ok,false);});
test('Paid virtue advancement does not automatically raise humanity or willpower',()=>{const body={virtues:{Mut:3},humanity:6,willpower:3,xpLedger:[{id:'a',kind:'grant',amount:10}]};const result=applyXpPurchase(body,{category:'virtue',target:'Mut',from:3,to:4});assert.equal(result.ok,true);assert.equal(result.body.virtues.Mut,4);assert.equal(result.body.willpower,3);assert.equal(result.body.humanity,6);assert.equal(xpBalance(result.body),4);});

test('Historical snapshot validation requires immutable engine version one',()=>{const body=adopt();for(const version of [undefined,null,2])assert.equal(validateCharacterDraft('chronik-von-kleve',{...body,engineVersion:version}).ok,false);});

test("Independently known historical totals remain known without inventing the missing side",()=>{const body=adoptHistoricalCharacter(original,{...input,earned:20,spent:null},"gm");assert.equal(characterXpSummary(body).received,20);assert.equal(characterXpSummary(body).spent,null);assert.equal(xpBalance(body),9);});

test('Review of an older confirmed origin preserves every existing XP entry without a second opening',()=>{const ledger=[{id:'old',kind:'grant',amount:20,reason:'old'},{id:'purchase',kind:'spend',amount:5,reason:'old spend'}];const body={...original,engineVersion:1,characterState:'confirmed',xpLedger:ledger};const verified=verifyHistoricalCharacter(body,{...input,available:15},'gm');assert.deepEqual(verified.xpLedger,ledger);assert.equal(verified.historicalXp,undefined);assert.equal(verified.characterState,'review');assert.equal(xpBalance(verified),15);assert.equal(characterXpSummary(verified).received,null);assert.throws(()=>verifyHistoricalCharacter(verified,{...input,available:15},'gm'));assert.throws(()=>verifyHistoricalCharacter(body,{...input,available:99},'gm'));});

test("Existing alternative virtues remain correctable without changing the moral path",()=>{const body={virtues:{Überzeugung:3,Instinkt:2,Mut:4},humanity:5,humanityPath:"Synthetic path"};const result=applySlAdjustment(body,{category:"virtue",target:"Überzeugung",value:4},"gm","Historical correction");assert.equal(result.ok,true);assert.equal(result.body.virtues.Überzeugung,4);assert.equal(result.body.humanity,5);assert.equal(result.body.humanityPath,"Synthetic path");});

test('Creation deviation compares a played sheet with the V20 frame without blocking or pricing it',()=>{
  const played={clan:'Toreador',attributes:{Körperkraft:3,Geschick:5,Widerstandsfähigkeit:2,Charisma:3,Manipulation:3,Erscheinungsbild:3,Wahrnehmung:2,Intelligenz:3,Geistesschärfe:2},skills:{Sportlichkeit:3,Ausdruck:2,Ausflüchte:2,Aufmerksamkeit:1,Einschüchtern:1,Empathie:1,Führungsqualitäten:1,Magiegespür:1,Szenekenntnis:1},disciplines:[{name:'Auspex',value:1},{name:'Schnelligkeit',value:2},{name:'Präsenz',value:1}],virtues:{Gewissen:3,Selbstbeherrschung:3,Mut:4}};
  const result=creationDeviation(played);
  const line=key=>result.lines.find(row=>row.key===key);
  assert.deepEqual([line('attributes:Körperliche Attribute').spent,line('attributes:Körperliche Attribute').limit],[7,7]);
  assert.deepEqual([line('attributes:Gesellschaftliche Attribute').spent,line('attributes:Gesellschaftliche Attribute').over],[6,1]);
  assert.equal(line('disciplines').over,1);
  assert.equal(line('virtues').over,0);
  assert.equal(result.over,result.lines.reduce((n,row)=>n+row.over,0));
  assert.equal(creationDeviation({}).over,0);
  const nosferatu=creationDeviation({clan:'Nosferatu',attributes:{Erscheinungsbild:0}});
  assert.equal(nosferatu.lines.find(row=>row.key==='attributes:Gesellschaftliche Attribute').spent,0);
});
test('V20 new Discipline costs 10 XP, is appended once and only from the catalogue',()=>{
  assert.deepEqual(xpCost({category:'discipline',from:0,to:1,inClan:true}),{ok:true,cost:10});
  assert.deepEqual(xpCost({category:'discipline',from:0,to:1,inClan:false}),{ok:true,cost:10});
  assert.equal(xpCost({category:'background',from:0,to:1}).ok,false);
  const body={clan:'Toreador',disciplines:[{name:'Auspex',value:1}],xpLedger:[{id:'h',kind:'historical',amount:12,reason:'x',createdAt:'now'}]};
  const learned=applyXpPurchase(body,{category:'discipline',target:'Präsenz',from:0,to:1,inClan:true});
  assert.equal(learned.ok,true);assert.equal(learned.cost,10);assert.deepEqual(learned.body.disciplines[1],{name:'Präsenz',value:1,source:'clan'});assert.equal(xpBalance(learned.body),2);
  assert.equal(applyXpPurchase(learned.body,{category:'discipline',target:'Präsenz',from:0,to:1,inClan:true}).ok,false);
  assert.equal(applyXpPurchase(body,{category:'discipline',target:'Erfundene Kraft',from:0,to:1,inClan:false}).ok,false);
  assert.equal(applyXpPurchase({...body,disciplines:'Auspex 1 (Freitext)'},{category:'discipline',target:'Präsenz',from:0,to:1,inClan:true}).ok,false);
  assert.equal(applyXpPurchase({...body,xpLedger:[{id:'h',kind:'historical',amount:9,reason:'x',createdAt:'now'}]},{category:'discipline',target:'Präsenz',from:0,to:1,inClan:true}).ok,false);
});
test('Celerity is not offered twice under two German names',()=>{
  const toreador={clan:'Toreador',disciplines:[{name:'Schnelligkeit',value:1}],xpLedger:[{id:'h',kind:'historical',amount:20,reason:'x',createdAt:'now'}]};
  assert.equal(applyXpPurchase(toreador,{category:'discipline',target:'Geschwindigkeit',from:0,to:1,inClan:false}).ok,false);
});
test('V20 Caitiff pay current rating ×6 for every Discipline, derived from the sheet',()=>{
  const caitiff={clan:'Caitiff',disciplines:[{name:'Potenz',value:2}],xpLedger:[{id:'h',kind:'historical',amount:20,reason:'x',createdAt:'now'}]};
  const result=applyXpPurchase(caitiff,{category:'discipline',target:'Potenz',from:2,to:3,inClan:false,caitiff:false});
  assert.equal(result.ok,true);assert.equal(result.cost,12);
  assert.equal(applyXpPurchase({...caitiff,clan:'Toreador'},{category:'discipline',target:'Potenz',from:2,to:3,inClan:false,caitiff:true}).cost,14);
});
test('V20 Paths: new Path 7, secondary ×4 up to the primary, primary rises with its Discipline',()=>{
  const tremere={clan:'Tremere',disciplines:[{name:'Thaumaturgie',value:3}],paths:[{name:'Pfad des Blutes',value:3,primary:true},{name:'Lure of Flames',value:1,primary:false}],xpLedger:[{id:'h',kind:'historical',amount:60,reason:'x',createdAt:'now'}]};
  assert.deepEqual(xpCost({category:'path',from:0,to:1}),{ok:true,cost:7});assert.deepEqual(xpCost({category:'path',from:2,to:3}),{ok:true,cost:8});
  const secondary=applyXpPurchase(tremere,{category:'path',target:'Lure of Flames',from:1,to:2});assert.equal(secondary.ok,true);assert.equal(secondary.cost,4);
  assert.equal(applyXpPurchase({...tremere,paths:[tremere.paths[0],{name:'Lure of Flames',value:3,primary:false}]},{category:'path',target:'Lure of Flames',from:3,to:4}).ok,false);
  assert.equal(applyXpPurchase(tremere,{category:'path',target:'Pfad des Blutes',from:3,to:4}).ok,false);
  const learned=applyXpPurchase(tremere,{category:'path',target:'Neuer Pfad',from:0,to:1});assert.equal(learned.ok,true);assert.equal(learned.cost,7);assert.deepEqual(learned.body.paths[2],{name:'Neuer Pfad',value:1,primary:false});
  const raised=applyXpPurchase(tremere,{category:'discipline',target:'Thaumaturgie',from:3,to:4,inClan:true});assert.equal(raised.ok,true);assert.equal(raised.body.paths[0].value,4);assert.equal(raised.body.paths[1].value,1);
  assert.equal(applyXpPurchase({clan:'Toreador',disciplines:[{name:'Auspex',value:2}],xpLedger:tremere.xpLedger},{category:'path',target:'Irgendein Pfad',from:0,to:1}).ok,false);
});
