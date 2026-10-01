import {test} from 'node:test';
import assert from 'node:assert/strict';
import {engineFixture} from './fixtures/engine-character.mjs';
import {creationGuidance,creationRatingQuote,creationChangeQuote,xpOptionHint} from '../domain/character-guidance.ts';
import {commandCharacterSummary} from '../domain/character-live.ts';
import {freebieTotal,validateCharacterDraft} from '../domain/character-engine.ts';
const campaign='chronik-von-kleve';

test('live guidance distinguishes a saveable incomplete draft from a review-ready sheet',()=>{
 const draft={...engineFixture,attributes:{},skills:{},virtues:{}};
 const g=creationGuidance(campaign,draft);
 assert.equal(g.saveable,true);assert.equal(g.reviewReady,false);
 assert.deepEqual(g.missing.filter(m=>['Körperlich','Sozial','Mental'].includes(m.label)).map(m=>m.remaining),[7,5,3]);
 assert.equal(creationGuidance(campaign,engineFixture).reviewReady,true);
});
test('presentation follows swapped engine priorities and excludes the free base dots',()=>{
 const body={...engineFixture,attributes:{},creationAllocations:{...engineFixture.creationAllocations,attributes:{physical:3,social:7,mental:5}}};
 const g=creationGuidance(campaign,body);
 assert.deepEqual(Object.values(g.budget.attributes).map(l=>l.remaining),[3,7,5]);
 assert.equal(g.budget.attributes.physical.spent,0);
});
test('price preview uses the same engine as persistence and refunds extra dots',()=>{
 const value=engineFixture.attributes.Geschick;
 const quote=creationRatingQuote(campaign,engineFixture,'attributes','Geschick',value+1);
 assert.equal(quote.cost,5);assert.equal(quote.allowed,true);
 const changed={...engineFixture,attributes:{...engineFixture.attributes,Geschick:value+1}};
 assert.equal(freebieTotal(changed)-freebieTotal(engineFixture),quote.cost);
 assert.equal(creationRatingQuote(campaign,changed,'attributes','Geschick',value).cost,-5);
});
test('over-budget clicks and Nosferatu appearance explain their server rule',()=>{
 const spent={...engineFixture,freebiePurchases:[{category:'humanity',points:5},{category:'willpower',points:5}]};
 const q=creationRatingQuote(campaign,spent,'attributes','Geschick',engineFixture.attributes.Geschick+1);
 assert.equal(q.allowed,false);assert.match(q.label,/Budget|budget/);
 const nosferatu={...engineFixture,clan:'Nosferatu',disciplines:[{name:'Animalismus',value:3}],attributes:{...engineFixture.attributes,Erscheinungsbild:0}};
 assert.match(creationRatingQuote(campaign,nosferatu,'attributes','Erscheinungsbild',1).label,/Nosferatu/);
});
test('unapproved exceptions block review while zero-rated entries remain saveable',()=>{
 const body={...engineFixture,disciplines:[...engineFixture.disciplines,{name:'Potenz',value:0,source:'foreign',slApproved:false}]};
 const g=creationGuidance(campaign,body);
 assert.equal(g.saveable,true);assert.equal(g.reviewReady,false);assert.match(g.reviewReason,/SL-Ausnahme/);
 assert.equal(g.reviewReady,validateCharacterDraft(campaign,{...body,characterState:'review'}).ok);
});
test('legacy guidance does not enroll, reinterpret or mutate historical values',()=>{
 const body={clan:'Legacy',attributes:{Geschick:0},xp:97};const before=JSON.stringify(body);
 const g=creationGuidance(campaign,body);
 assert.equal(g.saveable,true);assert.equal(g.reviewReady,false);assert.equal(g.missing.length,0);assert.equal(JSON.stringify(body),before);
});
test('discipline and background input previews quote the existing automatic Freebie calculation',()=>{
 const discipline={...engineFixture,disciplines:engineFixture.disciplines.map((d,i)=>i===0?{...d,value:d.value+1}:d)};
 const background={...engineFixture,backgrounds:engineFixture.backgrounds.map((b,i)=>i===0?{...b,value:b.value+1}:b)};
 assert.equal(creationChangeQuote(campaign,engineFixture,discipline).cost,7);
 assert.equal(creationChangeQuote(campaign,engineFixture,background).cost,1);
 assert.equal(creationChangeQuote(campaign,engineFixture,{...background,backgrounds:[{name:'Kontakte',value:6}]}).allowed,false);
});
test('normal points and the ability cap still use a zero or paid engine quote, not a UI price table',()=>{
 const empty={...engineFixture,attributes:{},skills:{}};
 assert.equal(creationRatingQuote(campaign,empty,'attributes','Geschick',2).cost,0);
 assert.equal(creationRatingQuote(campaign,empty,'skills','Aufmerksamkeit',3).cost,0);
 assert.equal(creationRatingQuote(campaign,empty,'skills','Aufmerksamkeit',4).cost,2);
});
test('locked XP choice explains insufficient funds and never suggests a negative balance',()=>{
 assert.equal(xpOptionHint({available:false,cost:12,hint:''},3),'12 XP nötig · 3 verfügbar · es fehlen 9 XP.');
 assert.equal(xpOptionHint({available:false,cost:0,hint:'SL-Ausnahme nötig'},10),'SL-Ausnahme nötig');
 assert.match(xpOptionHint({available:true,cost:4,hint:''},10),/danach 6/);
});
test('command summary is a strict whitelist of fresh record metadata',()=>{
 const row={id:'a',title:'Synthetic',owner_id:'player-a',version:3,body:JSON.stringify({engineVersion:1,characterState:'review',characterRequests:[{status:'pending',reason:'SECRET'},null,{status:'rejected'}],text:'PRIVATE_STORY',gmNotes:'SECRET_GM',xpLedger:[]})};
 const summary=commandCharacterSummary(row);
 assert.deepEqual(summary,{id:'a',title:'Synthetic',ownerId:'player-a',state:'review',pendingRequests:1,version:3});
 assert.doesNotMatch(JSON.stringify(summary),/SECRET|PRIVATE_STORY|xpLedger/);
 assert.equal(commandCharacterSummary({...row,body:JSON.stringify({...JSON.parse(row.body),characterState:'confirmed',characterRequests:[]})}).state,'confirmed');
});
test('secret, recovery and malformed rows never enter the attention queue',()=>{
 const row={id:'a',title:'Synthetic',owner_id:'a',version:1};
 for(const body of ['[]','null','not json',JSON.stringify({canonStatus:'GM_SECRET'}),JSON.stringify({recoveryOnly:true})])assert.equal(commandCharacterSummary({...row,body}),null);
});
