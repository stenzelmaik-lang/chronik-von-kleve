import assert from 'node:assert/strict';
import {test} from 'node:test';
import {engineFixture} from './fixtures/engine-character.mjs';
import {applyXpPurchase,creationBudgetSummary,derivedV20Values,editCreationRating,editDerivedCreationRating,freebieTotal,validateCharacterDraft,withCreationBaseValues,xpBalance,xpCost} from '../domain/character-engine.ts';
import {projectEntity} from '../server/entities.ts';

test('complete synthetic creation can be reviewed; missing groups remain saveable only as draft',()=>{
 assert.equal(validateCharacterDraft('chronik-von-kleve',{...engineFixture,characterState:'review'}).ok,true);
 assert.equal(validateCharacterDraft('chronik-von-kleve',{...engineFixture,attributes:{Geschick:2},characterState:'review'}).ok,false);
 assert.equal(validateCharacterDraft('chronik-von-kleve',{...engineFixture,attributes:{Geschick:2}}).ok,true);
});

test('free starting dots persist even when the creation step was never opened; legacy values stay intact',()=>{
 const draft=withCreationBaseValues({engineVersion:1,characterState:'draft',clan:'Nosferatu',attributes:{Geschick:3}});
 assert.equal(draft.attributes['Körperkraft'],1);assert.equal(draft.attributes['Erscheinungsbild'],0);assert.equal(draft.attributes.Geschick,3);
 assert.deepEqual(draft.virtues,{Gewissen:1,Selbstbeherrschung:1,Mut:1});assert.equal(draft.humanity,2);assert.equal(draft.willpower,1);
 assert.equal(creationBudgetSummary(draft).virtues.spent,0);assert.equal(freebieTotal(draft),0);
 const legacy={attributes:{Geschick:0},virtues:{Mut:0}};assert.equal(withCreationBaseValues(legacy),legacy);
 const confirmed={...legacy,engineVersion:1,characterState:'confirmed'};assert.equal(withCreationBaseValues(confirmed),confirmed);
 assert.equal(withCreationBaseValues({...draft,virtues:{Mut:0}}).virtues.Mut,0);
});
test('priorities are shared by price calculation and visible budgets',()=>{
 const body={...engineFixture,creationAllocations:{...engineFixture.creationAllocations,attributes:{physical:3,social:7,mental:5}}};
 const summary=creationBudgetSummary(body);
 assert.equal(summary.attributes.physical.limit,3);assert.equal(summary.attributes.physical.freebieCost,20);assert.equal(summary.attributes.social.remaining,2);assert.equal(summary.attributes.mental.remaining,2);
});
test('malformed Freebie commands are rejected without throwing or accepting prototype categories',()=>{
 for(const purchase of [null,0,'attribute',[],{category:'__proto__',points:1},{category:'attribute',target:42,points:1}])
  assert.equal(validateCharacterDraft('chronik-von-kleve',withCreationBaseValues({...engineFixture,freebiePurchases:[purchase]})).ok,false);
});
test('automatic virtue Freebies do not recalculate already derived starting values',()=>{
 const next=editCreationRating(engineFixture,'virtues','Gewissen',5);
 assert.equal(freebieTotal(next),2);assert.deepEqual(derivedV20Values(next),{humanity:7,willpower:3});
 const undone=editCreationRating(next,'virtues','Gewissen',4);assert.equal(freebieTotal(undone),0);
});
test('approved merits spend Freebies; unapproved costs have no rule effect',()=>{
 assert.equal(freebieTotal({...engineFixture,merits:[{name:'QA',cost:3,approved:false}]}),0);
 assert.equal(freebieTotal({...engineFixture,merits:[{name:'QA',cost:3,approved:true}]}),3);
 assert.equal(validateCharacterDraft('chronik-von-kleve',{...engineFixture,characterState:'review',merits:[{name:'QA',cost:3,approved:false}]}).ok,false);
 assert.equal(validateCharacterDraft('chronik-von-kleve',{...engineFixture,characterState:'review',humanity:10}).ok,false);
});
test('derived creation values can buy and refund extras without touching XP',()=>{
 const next=editDerivedCreationRating(engineFixture,'humanity',8);
 assert.equal(derivedV20Values(next).humanity,8);assert.equal(freebieTotal(next),2);assert.deepEqual(next.xpLedger,[]);
 assert.equal(freebieTotal(editDerivedCreationRating(next,'humanity',7)),0);
 assert.deepEqual(editDerivedCreationRating(engineFixture,'humanity',6),engineFixture);
 assert.equal(freebieTotal(editDerivedCreationRating(engineFixture,'willpower',4)),1);
});
test('XP advances use the captured creation budget and never charge Freebies again',()=>{
 const confirmed={...engineFixture,characterState:'confirmed',creationSnapshot:engineFixture,xpLedger:[{id:'grant',kind:'grant',amount:30,reason:'QA',createdAt:'2026-09-30'}]};
 const upgraded=applyXpPurchase(confirmed,{category:'attribute',target:'Geschick',from:3,to:4});assert.equal(upgraded.ok,true);
 assert.equal(validateCharacterDraft('chronik-von-kleve',upgraded.body).ok,true);assert.equal(xpBalance(upgraded.body),18);assert.equal(freebieTotal(upgraded.body.creationSnapshot),0);
});
test('regular caps and Nosferatu lock apply to XP; unset discipline costs are never free',()=>{
 assert.equal(applyXpPurchase(engineFixture,{category:'attribute',target:'Geschick',from:5,to:6}).ok,false);
 assert.equal(applyXpPurchase({...engineFixture,clan:'Nosferatu'},{category:'attribute',target:'Erscheinungsbild',from:0,to:1}).ok,false);
 assert.equal(xpCost({category:'discipline',from:0,to:1,inClan:true}).ok,false);
});
test('a previously unrated catalog ability can be learned, an invented ability cannot',()=>{
 const body={...engineFixture,xpLedger:[{kind:'grant',amount:10}]};
 const learned=applyXpPurchase(body,{category:'ability',target:'Medizin',from:0,to:1});
 assert.equal(learned.ok,true);assert.equal(learned.cost,3);assert.equal(learned.body.skills.Medizin,1);
 assert.equal(applyXpPurchase(body,{category:'ability',target:'Invented QA',from:0,to:1}).ok,false);
});
test('message recipients override knowledge grants, generic SL access and campaign visibility',()=>{
 const a={id:'a',campaignId:'chronik-von-kleve',gm:false,status:'active',role:'player'};
 const message={id:'m',campaignId:a.campaignId,type:'NOTE',ownerId:'a',visibility:'group',content:{context:'sl-message',senderId:'sl',senderName:'SL',text:'PRIVATE'},gmBody:'',canonStatus:'WORKING'};
 assert.equal(projectEntity(a,message,[]).content.text,'PRIVATE');
 assert.equal(projectEntity({...a,id:'b'},message,[{entity_id:'m',audience:'group',subject_id:a.campaignId,state:'DISCOVERED'}]),null);
 assert.equal(projectEntity({...a,id:'other-sl',gm:true},message,[]),null);
 assert.ok(projectEntity({...a,id:'sl',gm:true},message,[]));
 assert.equal(projectEntity({...a,campaignId:'foreign'},message,[]),null);
});
