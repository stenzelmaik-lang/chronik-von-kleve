import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSessionDraft, sessionSettlementPayload, sessionSettlementComplete } from '../domain/xp-session-desk.ts';
const players=[
{id:'player-a',name:'Helena',status:'active',characters:[{id:'char-a',title:'Figur A',state:'confirmed',archived:false},{id:'old',title:'Alt',state:'confirmed',archived:true}]},
{id:'player-b',name:'Cat',status:'active',characters:[{id:'char-b',title:'Figur B',state:'confirmed',archived:false}]},
{id:'player-c',name:'Gesperrt',status:'blocked',characters:[{id:'char-c',title:'Figur C',state:'confirmed',archived:false}]},
];
test('Default roster starts absent, without free rewards',()=>{
const rows=prepareSessionDraft(players,null);
assert.deepEqual(rows.map(x=>x.characterId),['char-a','char-b']);
assert.equal(rows.every(x=>!x.attended&&x.sessionAmount===0),true);
assert.deepEqual(sessionSettlementPayload('abend-1',rows).entries.map(x=>x.rewards),[[],[]]);
});
test('Valid 5 EP, reject 6 EP and missing reasons',()=>{
const rows=prepareSessionDraft(players,null); rows[0].attended=true;rows[0].sessionAmount=5;
assert.deepEqual(sessionSettlementPayload('abend-1',rows).entries[0].rewards,[{type:'session',amount:5,reason:'Teilnahme und Charakterspiel'}]);
rows[0].sessionAmount=6; assert.throws(()=>sessionSettlementPayload('abend-1',rows),/0 bis 5/);
rows[0].sessionAmount=1;rows[0].sessionReason='x';assert.throws(()=>sessionSettlementPayload('abend-1',rows),/Begründung/);
});
test('Receipt retains and locks booked rewards, replays failed story',()=>{
const receipt={participants:[{characterId:'char-a',attended:true,rewards:[
{type:'session',scopeId:'abend-1',amount:3,reason:'Rollenspiel',status:'booked',ledgerEntryId:'reward:session:a:abend-1'},
{type:'story',scopeId:'bogen-1',amount:2,reason:'Bogen beendet',status:'failed',ledgerEntryId:null},
]}]};
const rows=prepareSessionDraft(players,receipt);
assert.equal(rows[0].sessionLocked,true);assert.equal(rows[0].sessionAmount,3);
assert.deepEqual(sessionSettlementPayload('abend-1',rows).entries[0].rewards,[
{type:'session',amount:3,reason:'Rollenspiel'},
{type:'story',storyId:'bogen-1',amount:2,reason:'Bogen beendet'}]);
});
test('An absent character receives no session reward and booked values cannot change',()=>{
const rows=prepareSessionDraft(players,null);
rows[0].sessionAmount=2;assert.throws(()=>sessionSettlementPayload('abend-1',rows),/abwesend/);
rows[0].attended=true; rows[0].sessionLocked=true;rows[0].bookedSessionAmount=3;rows[0].sessionAmount=1;
assert.throws(()=>sessionSettlementPayload('abend-1',rows),/bereits gebucht/);
});
test('Successful current request is not necessarily a complete historical receipt',()=>{
assert.equal(sessionSettlementComplete({status:'complete',complete:true,receipt:{status:'partial'}}),false);
assert.equal(sessionSettlementComplete({status:'complete',complete:true,receipt:{status:'complete'}}),true);
});
