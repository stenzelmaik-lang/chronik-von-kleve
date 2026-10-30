import test from 'node:test';
import assert from 'node:assert/strict';
import {readVitals,applyVitals,mayOperate,allowedOperations,generationLimits,applyTableVitals,emptyTableVitals,tableVitalsSchema,vitalsCommandSchema,stressBand,VitalsError} from '../domain/character-vitals.ts';
const gm={gm:true,id:'sl'},player={gm:false,id:'a'};
const sheet=(extra={})=>({generation:12,willpower:5,willpowerTemporary:5,blood:11,...extra});
const fails=(fn,status)=>assert.throws(fn,e=>e instanceof VitalsError&&(!status||e.status===status));

test('V20 generation table drives blood maximum and spending per turn (S. 270)',()=>{
 assert.deepEqual(generationLimits(12),{maxTrait:5,bloodMax:11,perTurn:1});
 assert.deepEqual(generationLimits(8),{maxTrait:5,bloodMax:15,perTurn:3});
 assert.equal(generationLimits(15).bloodMax,10,'Thirteenth and higher: 10');
 assert.equal(generationLimits(3),null,'Third generation is undefined in the rulebook');
 const v=readVitals(sheet());assert.equal(v.blood.max,11);assert.equal(v.blood.maxSource,'generation');
 assert.equal(readVitals(sheet({bloodMax:13,bloodPerRound:2})).blood.perTurn,2,'An explicit sheet value wins');
});
test('legacy health level without damage type is kept as unspecified levels',()=>{
 const v=readVitals(sheet({health:{current:'Verwundet'}}));
 assert.deepEqual(v.health.track,['unspecified','unspecified','unspecified','unspecified']);
 assert.equal(v.health.penalty,-2);assert.equal(v.health.level,'Verwundet');
});
test('damage is ordered aggravated over lethal over bashing and keeps health.current in sync',()=>{
 let body=sheet();
 body=applyVitals(body,{op:'damage',type:'bashing',levels:1},gm).body;
 body=applyVitals(body,{op:'damage',type:'aggravated',levels:1},gm).body;
 body=applyVitals(body,{op:'damage',type:'lethal',levels:1},gm).body;
 assert.deepEqual(body.health.track,['aggravated','lethal','bashing']);
 assert.equal(body.health.current,'Schwer verletzt');
});
test('damage beyond Incapacitated: torpor for normal damage, Final Death for aggravated (S. 284 f.)',()=>{
 const full=applyVitals(sheet(),{op:'damage',type:'bashing',levels:7},gm).body;
 assert.equal(full.health.status,'active');assert.equal(full.health.current,'Außer Gefecht');
 assert.equal(applyVitals(full,{op:'damage',type:'lethal',levels:1},gm).body.health.status,'torpor');
 assert.equal(applyVitals(full,{op:'damage',type:'aggravated',levels:1},gm).body.health.status,'final-death');
 assert.equal(applyVitals(sheet({blood:0}),{op:'damage',type:'lethal',levels:7},gm).body.health.status,'torpor','Incapacitated without blood sinks into torpor');
});
test('healing with blood: normal damage first for 1 point, aggravated only by SL for 5 points',()=>{
 let body=applyVitals(sheet(),{op:'damage',type:'aggravated',levels:1},gm).body;
 body=applyVitals(body,{op:'damage',type:'bashing',levels:1},gm).body;
 const healed=applyVitals(body,vitalsCommandSchema.parse({op:'heal.blood'}),player);
 assert.deepEqual(healed.body.health.track,['aggravated']);assert.equal(healed.body.blood,10);
 fails(()=>applyVitals(healed.body,vitalsCommandSchema.parse({op:'heal.blood'}),player));
 fails(()=>applyVitals(healed.body,vitalsCommandSchema.parse({op:'heal.blood',aggravated:true}),player),403);
 const agg=applyVitals(healed.body,vitalsCommandSchema.parse({op:'heal.blood',aggravated:true}),gm);
 assert.deepEqual(agg.body.health.track,[]);assert.equal(agg.body.blood,5);
 fails(()=>applyVitals(sheet({blood:4,health:{track:['aggravated']}}),vitalsCommandSchema.parse({op:'heal.blood',aggravated:true}),gm));
});
test('spending blood respects pool and the per-turn limit for players; willpower cannot go negative',()=>{
 assert.equal(applyVitals(sheet(),{op:'blood.spend',amount:1},player).body.blood,10);
 fails(()=>applyVitals(sheet(),{op:'blood.spend',amount:2},player));
 assert.equal(applyVitals(sheet(),{op:'blood.spend',amount:2},gm).body.blood,9,'SL may book several turns at once');
 fails(()=>applyVitals(sheet({blood:0}),{op:'blood.spend',amount:1},gm));
 fails(()=>applyVitals(sheet({blood:11}),{op:'blood.gain',amount:1},gm));
 fails(()=>applyVitals(sheet({willpowerTemporary:0}),{op:'willpower.spend'},player));
 fails(()=>applyVitals(sheet({willpowerTemporary:5}),{op:'willpower.regain',amount:1},gm));
 fails(()=>applyVitals(sheet({blood:undefined,generation:undefined}),{op:'blood.spend',amount:1},player),409);
});
test('torpor and Final Death block player actions; reset restores the sheet',()=>{
 const torpid=sheet({health:{track:Array(7).fill('lethal'),status:'torpor'}});
 fails(()=>applyVitals(torpid,{op:'blood.spend',amount:1},player),409);
 fails(()=>applyVitals(torpid,{op:'willpower.spend'},player),409);
 fails(()=>applyVitals(sheet({health:{status:'final-death'}}),{op:'willpower.spend'},player),409);
 const reset=applyVitals(torpid,{op:'reset',target:'health'},gm).body;
 assert.deepEqual(reset.health.track,[]);assert.equal(reset.health.status,'active');assert.equal(reset.health.current,'Gesund');
 assert.equal(applyVitals(sheet({willpowerTemporary:1}),{op:'reset',target:'willpower'},gm).body.willpowerTemporary,5);
 assert.equal(applyVitals(sheet({blood:2}),{op:'reset',target:'blood'},gm).body.blood,11);
 fails(()=>applyVitals(sheet(),{op:'set',willpowerTemporary:6},gm));
});
test('control profiles: players only book own spending; SL controls everything',()=>{
 for(const op of ['blood.spend','willpower.spend'])assert.ok(mayOperate('empfohlen',player,'a',op));
 for(const op of ['damage','heal','reset','set','willpower.regain','blood.gain','heal.blood'])assert.ok(!mayOperate('empfohlen',player,'a',op),op);
 assert.ok(!mayOperate('empfohlen',player,'b','blood.spend'),'Never someone else\'s character');
 assert.ok(mayOperate('offen',player,'a','blood.gain'));assert.ok(mayOperate('offen',player,'a','heal.blood'));
 assert.ok(!mayOperate('sl',player,'a','blood.spend'));
 for(const op of allowedOperations('sl',true))assert.ok(mayOperate('sl',gm,'a',op));
});
test('group stress follows the player handout bands; masquerade stays secret unless released',()=>{
 assert.equal(stressBand(3).label,'Alltag');assert.equal(stressBand(4).label,'Angespannte Nerven');assert.equal(stressBand(9).label,'Hochdruck');assert.equal(stressBand(10).label,'Bruchpunkt');
 let s=emptyTableVitals();
 s=applyTableVitals(s,{op:'stress',delta:12},'SL','t1','1');assert.equal(s.stress,10,'Clamped to 10');
 assert.throws(()=>applyTableVitals(s,{op:'stress',delta:1},'SL','t2','2'),VitalsError);
 s=applyTableVitals(s,{op:'masquerade',delta:2},'SL','t3','3');assert.equal(s.masquerade.value,2);assert.equal(s.log[0].secret,true,'Masquerade log is SL-only while hidden');
 s=applyTableVitals(s,{op:'settings',masqueradeMax:1},'SL','t4','4');assert.equal(s.masquerade.value,1,'Lowering the scale clamps the level');
 s=applyTableVitals(s,{op:'settings',share:{characterId:'c1',shared:true}},'SL','t5','5');assert.deepEqual(s.shared,['c1']);
 assert.equal(s.version,4);assert.ok(tableVitalsSchema.safeParse(s).success);
 assert.ok(!tableVitalsSchema.safeParse({...s,extra:1}).success,'Strict schema');
});
