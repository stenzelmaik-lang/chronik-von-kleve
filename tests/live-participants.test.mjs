import test from 'node:test';
import assert from 'node:assert/strict';
import {participantPresence,publicCharacterCard} from '../domain/live-participants.ts';
test('presence uses actual unexpired room connections, not profile existence',()=>{
 const now=100000;
 assert.equal(participantPresence('a',{}, {},now),'disconnected');
 assert.equal(participantPresence('a',{p:{id:'p',memberId:'a',name:'A',seen:now-30000}},{a:true},now),'disconnected');
 assert.equal(participantPresence('a',{p:{id:'p',memberId:'b',name:'B',seen:now}},{},now),'disconnected');
 assert.equal(participantPresence('a',{p:{id:'p',memberId:'a',name:'A',seen:now-29999}},{},now),'connected');
 assert.equal(participantPresence('a',{p:{id:'p',memberId:'a',name:'A',seen:now}},{a:true},now),'afk');
});
test('closing or timing out one tab does not disconnect the other tab',()=>{
 const now=100000,second={id:'tab2',memberId:'a',name:'A',seen:now};
 assert.equal(participantPresence('a',{tab2:second},{},now),'connected');
 assert.equal(participantPresence('a',{tab1:{...second,id:'tab1',seen:now-40000},tab2:second},{a:true},now),'afk');
 assert.equal(participantPresence('a',{tab2:second},{a:false},now),'connected');
 assert.equal(participantPresence('a',{tab2:second},{a:true},now+30001),'disconnected');
});
test('public character view uses explicit group release and block visibility only',()=>{
 const row={id:'c',title:'Public identity',visibility:'private',body:'PRIVATE_BIOGRAPHY',attributes:{secret:5}};
 assert.equal(publicCharacterCard(row,[]),null);
 const card=publicCharacterCard({...row,visibility:'group'},[{kind:'biography',content:'Released description',visibility:'player_visible'},{kind:'biography',content:'SECRET_BIO',visibility:'sl_secret'},{kind:'sl_secrets',content:'SECRET_BLOCK',visibility:'player_visible'}]);
 assert.deepEqual(card,{id:'c',name:'Public identity',descriptions:[{kind:'biography',content:'Released description'}]});
 assert.ok(!JSON.stringify(card).includes('PRIVATE')&&!JSON.stringify(card).includes('SECRET'));
});
